// SPDX-License-Identifier: MIT
/*
 * MIT License
 * ===========
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 */
pragma solidity 0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../libraries/ExpiryUtilsLib.sol";
import "../libraries/FactoryLib.sol";
import "../interfaces/IAaveV2LendingPool.sol";
import "../interfaces/IPendleBaseToken.sol";
import "../interfaces/IPendleData.sol";
import "../interfaces/IPendleForge.sol";
import "../tokens/PendleFutureYieldToken.sol";
import "../tokens/PendleOwnershipToken.sol";
import "../periphery/Permissions.sol";
import "./PendleForgeBase.sol";
import {WadRayMath} from "../libraries/WadRayMath.sol";

/**
* @dev READ ME: In AaveV2, there are 2 types of balances: scaled balance & displayed balance
    scaled balance (SBAL) is the balance received when scaledBalanceOf() is called. It is the
        balance value that is actually stored in the contract
    displayed balance (DBAL) is the balance received when balanceOf() is called. It is calculated
        by SBAL * incomeIndex
    Due to fixed point precision error, two different DBAL can have the exact same SBAL.
        For example: 2 DBALs of 10^10 and 10^10-3, at the moment where the incomeIndex =
        5877566951907055216799556412, has the exact same SBAL. => In the future, the two DBAL will
        be equal again if the incomeIndex is appropriate
    This led to the issue where user A transfer 10^10 to user B, then user A's DBAL decreased by
        10^10, but user B's DBAL increased by only 10^10-3. Note that AaveV2's transfer actually
        transfer by SBAL and not DBAL. As a result, the amount of SBAL user B receives will be
        equal to the amount of SBAL that user A transfer.
    Ironically, even if the amounts of SBAL are equal, user B cannot immediately transfer back
        10^10 to user A since AaveV2 requires both the SBAL & DBAL to be >= the amount of SBAL
        & DBAL that B wants to transfer, and it's clear that user B, despite having enough SBAL
        , only have 10^10-3 in DBAL and therefore cannot transfer back
* @dev The smooth function used in this contract aims to resolve the above issue. It finds the
        smallest res that rayDiv(dividen,incomeIndex) = rayDiv(res,incomeIndex). So if multiple
        DBAL correspond to the same value of SBAL, the smallest DBAL will be returned.
    One very important thing to note is that the smooth function, for example smooth(X,Y)=Z,
        doesn't change the amount of SBAL since X/Y = Z/Y, so the amount of SBAL transfered is
        unchanged IF AND ONLY IF the transfer happens immediately (in the same transaction).
    So for the 10^10 transfer above, user B will only acknowledge that he has received
        smooth(10^10,incomeIndex) = 10^10-3, and when the time to pay back comes, user B will only
        pay smooth(10^10-3,incomeIndex2) back. In both transactions, the amount of SBAL that B & A
        will receive are not affected by smooth.
*/
contract PendleAaveV2Forge is PendleForgeBase {
    using ExpiryUtils for string;
    using WadRayMath for uint256;

    IAaveV2LendingPool public immutable aaveLendingPool;

    mapping(address => mapping(uint256 => uint256)) public lastNormalisedIncomeBeforeExpiry;
    mapping(address => mapping(uint256 => mapping(address => uint256)))
        public lastNormalisedIncome; //lastNormalisedIncome[underlyingAsset][expiry][account]
    mapping(address => address) private reserveATokenAddress;

    constructor(
        address _governance,
        IPendleRouter _router,
        IAaveV2LendingPool _aaveLendingPool,
        bytes32 _forgeId
    ) PendleForgeBase(_governance, _router, _forgeId) {
        require(address(_aaveLendingPool) != address(0), "ZERO_ADDRESS");

        aaveLendingPool = _aaveLendingPool;
    }

    function _getYieldBearingToken(address _underlyingAsset) internal override returns (address) {
        if (reserveATokenAddress[_underlyingAsset] == address(0)) {
            reserveATokenAddress[_underlyingAsset] = aaveLendingPool
                .getReserveData(_underlyingAsset)
                .aTokenAddress;
        }
        return reserveATokenAddress[_underlyingAsset];
    }

    function _calcDueInterests(
        uint256 principal,
        address _underlyingAsset,
        uint256 _expiry,
        address _account
    ) internal override returns (uint256 dueInterests) {
        uint256 ix = lastNormalisedIncome[_underlyingAsset][_expiry][_account];
        uint256 normalizedIncome;

        if (block.timestamp >= _expiry) {
            normalizedIncome = lastNormalisedIncomeBeforeExpiry[_underlyingAsset][_expiry];
        } else {
            normalizedIncome = aaveLendingPool.getReserveNormalizedIncome(_underlyingAsset);
            lastNormalisedIncomeBeforeExpiry[_underlyingAsset][_expiry] = normalizedIncome;
        }

        // first time getting XYT
        if (ix == 0) {
            lastNormalisedIncome[_underlyingAsset][_expiry][_account] = normalizedIncome;
            return 0;
        }
        lastNormalisedIncome[_underlyingAsset][_expiry][_account] = normalizedIncome;

        uint256 principalWithDueInterests = principal.rayDiv(ix).rayMul(normalizedIncome);
        principalWithDueInterests = WadRayMath.smooth(principalWithDueInterests, normalizedIncome);

        // theoratically the principal should be smooth too. But due to precision error, it was
        // decided not to do so in order to leave a tiny bit of balance left in the contract
        // in case future transactions from this user needs it (for example, redeem all the OT
        // that he is holding)
        dueInterests = (
            principalWithDueInterests > principal ? principalWithDueInterests - principal : 0
        );
        dueInterests = WadRayMath.smooth(dueInterests, normalizedIncome);
    }

    //calculate the (principal + interest) from the last action before expiry to now.
    function _calcTotalAfterExpiry(
        address,
        address _underlyingAsset,
        uint256 _expiry,
        uint256 redeemedAmount
    ) internal view override returns (uint256 totalAfterExpiry) {
        uint256 currentNormalizedIncome =
            aaveLendingPool.getReserveNormalizedIncome(_underlyingAsset);
        totalAfterExpiry = redeemedAmount
            .rayDiv(lastNormalisedIncomeBeforeExpiry[_underlyingAsset][_expiry])
            .rayMul(currentNormalizedIncome);
        totalAfterExpiry = WadRayMath.smooth(totalAfterExpiry, currentNormalizedIncome);
    }

    function _calcUnderlyingToRedeem(address _underlyingAsset, uint256 _amountToRedeem)
        internal
        view
        override
        returns (uint256 underlyingToRedeem)
    {
        underlyingToRedeem = WadRayMath.smooth(
            _amountToRedeem,
            aaveLendingPool.getReserveNormalizedIncome(_underlyingAsset)
        );
    }

    function _calcAmountToMint(address _underlyingAsset, uint256 _amountToTokenize)
        internal
        view
        override
        returns (uint256 amountToMint)
    {
        amountToMint = WadRayMath.smooth(
            _amountToTokenize,
            aaveLendingPool.getReserveNormalizedIncome(_underlyingAsset)
        );
    }
}
