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

import "../libraries/FactoryLib.sol";
import "../libraries/MathLib.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "../interfaces/IPendleCompoundForge.sol";
import "../interfaces/IPendleRouter.sol";
import "../interfaces/IPendleForge.sol";
import "../interfaces/IPendleMarketFactory.sol";
import "../interfaces/IPendleMarket.sol";
import "../interfaces/IPendleData.sol";
import "../interfaces/IPendleLpHolder.sol";
import "../core/PendleLpHolder.sol";
import "../interfaces/IPendleLiquidityMining.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "../periphery/Permissions.sol";
import "./abstract/PendleLiquidityMiningBase.sol";

/**
    @dev things that must hold in this contract:
     - If an user's stake information is updated (hence lastTimeUserStakeUpdated is changed),
        then his pending rewards are calculated as well
        (and saved in availableRewardsForEpoch[user][epochId])
 */
contract PendleCompoundLiquidityMining is PendleLiquidityMiningBase {
    using Math for uint256;
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    mapping(uint256 => uint256) private globalLastExchangeRate;

    constructor(
        address _governance,
        address _pendleTokenAddress,
        address _pendleRouter, // The router basically identify our Pendle instance.
        bytes32 _pendleMarketFactoryId,
        bytes32 _pendleForgeId,
        address _underlyingAsset,
        address _baseToken,
        uint256 _startTime,
        uint256 _epochDuration,
        uint256 _vestingEpochs
    )
        PendleLiquidityMiningBase(
            _governance,
            _pendleTokenAddress,
            _pendleRouter,
            _pendleMarketFactoryId,
            _pendleForgeId,
            _underlyingAsset,
            _baseToken,
            _startTime,
            _epochDuration,
            _vestingEpochs
        )
    {}

    function _getExchangeRate() internal returns (uint256) {
        return IPendleCompoundForge(forge).getExchangeRate(underlyingAsset);
    }

    /**
    * Very similar to the function in PendleAaveMarket. Any major differences are likely to be bugs
        Please refer to it for more details
    */
    function _updateDueInterests(uint256 expiry, address user) internal override {
        _updateParamL(expiry);

        ExpiryData storage exd = expiryData[expiry];

        if (exd.lastParamL[user] == 0) {
            exd.lastParamL[user] = exd.paramL;
            return;
        }

        uint256 principal = exd.balances[user];
        uint256 interestValuePerLP = exd.paramL.sub(exd.lastParamL[user]);

        uint256 interestFromLp = principal.mul(interestValuePerLP).div(MULTIPLIER);

        exd.dueInterests[user] = exd.dueInterests[user].add(interestFromLp);
        exd.lastParamL[user] = exd.paramL;
    }

    /**
    * Very similar to the function in PendleAaveMarket. Any major differences are likely to be bugs
        Please refer to it for more details
    */
    function _getFirstTermAndParamR(uint256 expiry, uint256 currentNYield)
        internal
        override
        returns (uint256 firstTerm, uint256 paramR)
    {
        ExpiryData storage exd = expiryData[expiry];
        firstTerm = exd.paramL;
        paramR = currentNYield.sub(exd.lastNYield);
        globalLastExchangeRate[expiry] = _getExchangeRate();
    }

    function _afterAddingNewExpiry(uint256 expiry) internal override {
        expiryData[expiry].paramL = 1; // we only use differences between paramL so we can just set an arbitrary initial number
        globalLastExchangeRate[expiry] = _getExchangeRate();
    }

    /**
    * Very similar to the function in PendleAaveMarket. Any major differences are likely to be bugs
        Please refer to it for more details
    */
    function _getIncomeIndexIncreaseRate(uint256 expiry)
        internal
        override
        returns (uint256 increaseRate)
    {
        return _getExchangeRate().rdiv(globalLastExchangeRate[expiry]) - Math.RONE;
    }
}
