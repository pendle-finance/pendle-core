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

import "../interfaces/IPendleData.sol";
import "../interfaces/IPendleMarket.sol";
import "../interfaces/IPendleForge.sol";
import "../interfaces/IPendleCompoundForge.sol";
import "../interfaces/IPendleMarketFactory.sol";
import "../interfaces/IPendleYieldToken.sol";
import "../tokens/PendleBaseToken.sol";
import "./abstract/PendleMarketBase.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

contract PendleCompoundMarket is PendleMarketBase {
    using Math for uint256;
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    uint256 private globalLastExchangeRate;

    constructor(
        address _forge,
        address _xyt,
        address _token,
        uint256 _expiry
    ) PendleMarketBase(_forge, _xyt, _token, _expiry) {}

    function _getExchangeRate() internal returns (uint256) {
        return IPendleCompoundForge(forge).getExchangeRate(underlyingAsset);
    }

    function _afterBootstrap() internal override {
        paramL = 1;
        globalLastExchangeRate = _getExchangeRate();
    }

    function _getInterestValuePerLP(address account)
        internal
        override
        returns (uint256 interestValuePerLP)
    {
        if (lastParamL[account] == 0) {
            interestValuePerLP = 0;
        } else {
            interestValuePerLP = paramL.sub(lastParamL[account]);
        }
        lastParamL[account] = paramL;
    }

    function _getFirstTermAndParamR(uint256 currentNYield)
        internal
        override
        returns (uint256 firstTerm, uint256 paramR)
    {
        firstTerm = paramL;
        paramR = currentNYield.sub(lastNYield);
        globalLastExchangeRate = _getExchangeRate();
    }

    function _getIncomeIndexIncreaseRate() internal override returns (uint256 increaseRate) {
        return _getExchangeRate().rdiv(globalLastExchangeRate) - Math.RONE;
    }
}
