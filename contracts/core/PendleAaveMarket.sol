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
import "../interfaces/IPendleAaveForge.sol";
import "../interfaces/IPendleMarketFactory.sol";
import "../interfaces/IPendleYieldToken.sol";
import "../tokens/PendleBaseToken.sol";
import "../libraries/MathLib.sol";
import "./abstract/PendleMarketBase.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

contract PendleAaveMarket is PendleMarketBase {
    using Math for uint256;
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    uint256 private globalLastNormalizedIncome;
    mapping(address => uint256) private userLastNormalizedIncome;

    constructor(
        address _forge,
        address _xyt,
        address _token,
        uint256 _expiry
    ) PendleMarketBase(_forge, _xyt, _token, _expiry) {}

    /// @notice get normalized income per unit of asset from aave (through forge function)
    function _getReserveNormalizedIncome() internal returns (uint256) {
        return IPendleAaveForge(forge).getReserveNormalizedIncome(underlyingAsset);
    }

    /// @notice actions after market is bootstrapped (now is updating the global normalized income)
    function _afterBootstrap() internal override {
        globalLastNormalizedIncome = _getReserveNormalizedIncome();
    }

    /// @notice calc the accured interest per lp token
    function _getInterestValuePerLP(address account)
        internal
        override
        returns (uint256 interestValuePerLP)
    {
        // if userLastNormalizedIncome is 0 then it's certain that this is the first time the user stakes
        // since globalLastNormalizedIncome is always > 0
        if (userLastNormalizedIncome[account] == 0) {
            interestValuePerLP = 0;
        } else {
            interestValuePerLP = paramL.subMax0(
                lastParamL[account].mul(globalLastNormalizedIncome).div(
                    userLastNormalizedIncome[account]
                )
            );
        }

        userLastNormalizedIncome[account] = globalLastNormalizedIncome;
        lastParamL[account] = paramL;
    }

    /**
    @dev this can only be called by _updateParamL
    */
    function _getFirstTermAndParamR(uint256 currentNYield)
        internal
        override
        returns (uint256 firstTerm, uint256 paramR)
    {
        uint256 currentNormalizedIncome = _getReserveNormalizedIncome();
        firstTerm = paramL.mul(currentNormalizedIncome).div(globalLastNormalizedIncome);

        uint256 ix = lastNYield.mul(currentNormalizedIncome).div(globalLastNormalizedIncome);
        paramR = (currentNYield >= ix ? currentNYield - ix : 0);

        globalLastNormalizedIncome = currentNormalizedIncome;
    }

    /// @notice calc increase rate of normalized income
    function _getIncomeIndexIncreaseRate() internal override returns (uint256 increaseRate) {
        return _getReserveNormalizedIncome().rdiv(globalLastNormalizedIncome) - Math.RONE;
    }
}
