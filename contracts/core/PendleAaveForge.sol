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

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../libraries/ExpiryUtilsLib.sol";
import "../libraries/FactoryLib.sol";
import "../interfaces/IAaveLendingPoolCore.sol";
import "../interfaces/IPendleBaseToken.sol";
import "../interfaces/IPendleData.sol";
import "../interfaces/IPendleForge.sol";
import "../tokens/PendleFutureYieldToken.sol";
import "../tokens/PendleOwnershipToken.sol";
import "../periphery/Permissions.sol";
import "./PendleForgeBase.sol";
import {WadRayMath} from "../libraries/WadRayMath.sol";

contract PendleAaveForge is PendleForgeBase {
    using ExpiryUtils for string;
    using WadRayMath for uint256;

    IAaveLendingPoolCore public immutable aaveLendingPoolCore;

    mapping(address => mapping(uint256 => uint256)) public lastNormalisedIncomeBeforeExpiry;
    mapping(address => mapping(uint256 => mapping(address => uint256)))
        public lastNormalisedIncome; //lastNormalisedIncome[underlyingAsset][expiry][account]

    constructor(
        address _governance,
        IPendleRouter _router,
        IAaveLendingPoolCore _aaveLendingPoolCore,
        bytes32 _forgeId
    ) PendleForgeBase(_governance, _router, _forgeId) {
        require(address(_aaveLendingPoolCore) != address(0), "ZERO_ADDRESS");

        aaveLendingPoolCore = _aaveLendingPoolCore;
    }

    //calculate the (principal + interest) from the last action before expiry to now.
    function _calcTotalAfterExpiry(
        address,
        address _underlyingAsset,
        uint256 _expiry,
        uint256 redeemedAmount
    ) internal view override returns (uint256 totalAfterExpiry) {
        uint256 currentNormalizedIncome =
            aaveLendingPoolCore.getReserveNormalizedIncome(_underlyingAsset);
        totalAfterExpiry = redeemedAmount
            .wadToRay()
            .rayMul(currentNormalizedIncome)
            .rayDiv(lastNormalisedIncomeBeforeExpiry[_underlyingAsset][_expiry])
            .rayToWad();
        console.log(
            "71",
            currentNormalizedIncome,
            lastNormalisedIncomeBeforeExpiry[_underlyingAsset][_expiry]
        );
    }

    function _getYieldBearingToken(address _underlyingAsset)
        internal
        view
        override
        returns (address)
    {
        return aaveLendingPoolCore.getReserveATokenAddress(_underlyingAsset);
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
            normalizedIncome = aaveLendingPoolCore.getReserveNormalizedIncome(_underlyingAsset);
            lastNormalisedIncomeBeforeExpiry[_underlyingAsset][_expiry] = normalizedIncome;
        }
        // console.log("NormalizedIncome & incomeIndex",aaveLendingPool.getReserveNormalizedIncome(_underlyingAsset),_getIndex(_underlyingAsset));
        // first time getting XYT
        if (ix == 0) {
            // console.log("FIRST TIME XYT");
            lastNormalisedIncome[_underlyingAsset][_expiry][_account] = normalizedIncome;
            return 0;
        }
        lastNormalisedIncome[_underlyingAsset][_expiry][_account] = normalizedIncome;

        dueInterests =
            principal.wadToRay().rayMul(normalizedIncome).rayDiv(ix).rayToWad() -
            principal;
        console.log(
            "contractBalance and Interest",
            IERC20(_getYieldBearingToken(_underlyingAsset)).balanceOf(address(this)),
            dueInterests
        );
    }
}
