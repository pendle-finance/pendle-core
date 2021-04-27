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

import "../interfaces/IPendleAaveForge.sol";
import "./abstract/PendleForgeBase.sol";

contract PendleAaveForge is PendleForgeBase, IPendleAaveForge {
    using ExpiryUtils for string;
    using SafeMath for uint256;
    using Math for uint256;

    IAaveLendingPoolCore public immutable aaveLendingPoolCore;

    mapping(address => mapping(uint256 => uint256)) public lastNormalisedIncomeBeforeExpiry;
    mapping(address => mapping(uint256 => mapping(address => uint256)))
        public lastNormalisedIncome; //lastNormalisedIncome[underlyingAsset][expiry][account]
    mapping(address => address) private reserveATokenAddress;

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
        address _underlyingAsset,
        uint256 _expiry,
        uint256 redeemedAmount
    ) internal view override returns (uint256 totalAfterExpiry) {
        uint256 currentNormalizedIncome = getReserveNormalizedIncome(_underlyingAsset);
        totalAfterExpiry = currentNormalizedIncome.mul(redeemedAmount).div(
            lastNormalisedIncomeBeforeExpiry[_underlyingAsset][_expiry]
        );
    }

    /**
    @dev this function serves functions that take into account the lastNormalisedIncomeBeforeExpiry
    */
    function getReserveNormalizedIncomeBeforeExpiry(address _underlyingAsset, uint256 _expiry)
        internal
        returns (uint256)
    {
        if (block.timestamp > _expiry) {
            return lastNormalisedIncomeBeforeExpiry[_underlyingAsset][_expiry];
        }

        uint256 normalizedIncome =
            aaveLendingPoolCore.getReserveNormalizedIncome(_underlyingAsset);

        lastNormalisedIncomeBeforeExpiry[_underlyingAsset][_expiry] = normalizedIncome;
        return normalizedIncome;
    }

    /**
    @dev directly get the normalizedIncome from Aave
    */
    function getReserveNormalizedIncome(address _underlyingAsset)
        public
        view
        override
        returns (uint256)
    {
        return aaveLendingPoolCore.getReserveNormalizedIncome(_underlyingAsset);
    }

    function _getYieldBearingToken(address _underlyingAsset) internal override returns (address) {
        if (reserveATokenAddress[_underlyingAsset] == address(0)) {
            reserveATokenAddress[_underlyingAsset] = aaveLendingPoolCore.getReserveATokenAddress(
                _underlyingAsset
            );
            require(
                reserveATokenAddress[_underlyingAsset] != address(0),
                "INVALID_UNDERLYING_ASSET"
            );
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
        uint256 normalizedIncome =
            getReserveNormalizedIncomeBeforeExpiry(_underlyingAsset, _expiry);
        lastNormalisedIncome[_underlyingAsset][_expiry][_account] = normalizedIncome;
        // first time getting XYT
        if (ix == 0) {
            return 0;
        }
        dueInterests = (principal.mul(normalizedIncome).div(ix).sub(principal));

        // if the XYT has expired and user haven't withdrawn yet, there will be compound interest
        if (block.timestamp > _expiry) {
            dueInterests = dueInterests.mul(getReserveNormalizedIncome(_underlyingAsset)).div(
                normalizedIncome
            );
        }
    }

    function _getInterestRateForUser(
        address _underlyingAsset,
        uint256 _expiry,
        address _account
    ) internal view override returns (uint256 rate, bool firstTime) {
        uint256 prev = lastNormalisedIncome[_underlyingAsset][_expiry][_account];
        if (prev != 0) {
            rate = getReserveNormalizedIncome(_underlyingAsset).rdiv(prev) - Math.RONE;
        } else {
            firstTime = true;
        }
    }
}
