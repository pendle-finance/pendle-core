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

import "../interfaces/IAaveV2LendingPool.sol";
import "../interfaces/IPendleAaveForge.sol";
import "./abstract/PendleForgeBase.sol";

/**
* @dev This contract will be very similar to AaveForge. Any major differences between the two
are likely to be bugs
*/
contract PendleAaveV2Forge is PendleForgeBase, IPendleAaveForge {
    using ExpiryUtils for string;
    using SafeMath for uint256;
    using Math for uint256;

    IAaveV2LendingPool public immutable aaveLendingPool;

    mapping(address => mapping(uint256 => uint256)) public lastNormalisedIncomeBeforeExpiry;
    mapping(address => uint256) public lastNormalisedIncomeForProtocolFee;
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
    else, functions can just call the pool directly
    */
    function getReserveNormalizedIncomeBeforeExpiry(address _underlyingAsset, uint256 _expiry)
        internal
        returns (uint256)
    {
        if (block.timestamp > _expiry) {
            return lastNormalisedIncomeBeforeExpiry[_underlyingAsset][_expiry];
        }

        uint256 normalizedIncome = aaveLendingPool.getReserveNormalizedIncome(_underlyingAsset);

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
        return aaveLendingPool.getReserveNormalizedIncome(_underlyingAsset);
    }

    function _getYieldBearingToken(address _underlyingAsset) internal override returns (address) {
        if (reserveATokenAddress[_underlyingAsset] == address(0)) {
            reserveATokenAddress[_underlyingAsset] = aaveLendingPool
                .getReserveData(_underlyingAsset)
                .aTokenAddress;
            require(
                reserveATokenAddress[_underlyingAsset] != address(0),
                "INVALID_UNDERLYING_ASSET"
            );
        }
        return reserveATokenAddress[_underlyingAsset];
    }

    function _updateDueInterests(
        uint256 _principal,
        address _underlyingAsset,
        uint256 _expiry,
        address _account
    ) internal override {
        uint256 lastIncome = lastNormalisedIncome[_underlyingAsset][_expiry][_account];
        uint256 normIncomeBeforeExpiry =
            getReserveNormalizedIncomeBeforeExpiry(_underlyingAsset, _expiry);
        uint256 normIncomeNow =
            block.timestamp > _expiry
                ? getReserveNormalizedIncome(_underlyingAsset)
                : normIncomeBeforeExpiry;

        // first time getting XYT
        if (lastIncome == 0) {
            lastNormalisedIncome[_underlyingAsset][_expiry][_account] = normIncomeNow;
            return;
        }

        uint256 interestFromXyt;

        if (normIncomeBeforeExpiry >= lastIncome) {
            // There are still unclaimed interests from XYT
            interestFromXyt = _principal.mul(normIncomeBeforeExpiry).div(lastIncome).sub(
                _principal
            );

            // the interestFromXyt has only been calculated until normIncomeBeforeExpiry
            // we need to calculate the compound interest of it from normIncomeBeforeExpiry -> now
            interestFromXyt = interestFromXyt.mul(normIncomeNow).div(normIncomeBeforeExpiry);
        }

        dueInterests[_underlyingAsset][_expiry][_account] = dueInterests[_underlyingAsset][
            _expiry
        ][_account]
            .mul(normIncomeNow)
            .div(lastIncome)
            .add(interestFromXyt);

        lastNormalisedIncome[_underlyingAsset][_expiry][_account] = normIncomeNow;
    }

    function _accrueProtocolFee(address _underlyingAsset, uint256 _protocolFee) internal override {
        uint256 currentNormalizedIncome = getReserveNormalizedIncome(_underlyingAsset);
        if (lastNormalisedIncomeForProtocolFee[_underlyingAsset] == 0) {
            lastNormalisedIncomeForProtocolFee[_underlyingAsset] = currentNormalizedIncome;
        }
        accruedProtocolFee[_underlyingAsset] = accruedProtocolFee[_underlyingAsset]
            .mul(currentNormalizedIncome)
            .div(lastNormalisedIncomeForProtocolFee[_underlyingAsset])
            .add(_protocolFee);
        lastNormalisedIncomeForProtocolFee[_underlyingAsset] = currentNormalizedIncome;
    }
}
