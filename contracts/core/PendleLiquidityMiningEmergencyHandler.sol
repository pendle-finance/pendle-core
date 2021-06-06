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
pragma abicoder v2;

import "../periphery/PermissionsV2.sol";
import "../interfaces/IPendleMarket.sol";
import "../interfaces/IPendleLiquidityMining.sol";
import "../interfaces/IPendleLpHolder.sol";
import "../interfaces/IPendlePausingManager.sol";
import "../interfaces/IPendleForge.sol";
import "../libraries/MathLib.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

contract PendleLiquidityMiningEmergencyHandler is PermissionsV2 {
    using Math for uint256;
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    struct LiqData {
        IPendleLpHolder lpHolder;
        IERC20 lpToken;
        IERC20 underlyingYieldToken;
        uint256 totalLp;
        mapping(address => bool) haveWithdrawn;
    }

    mapping(address => mapping(uint256 => LiqData)) public liqData;
    IPendlePausingManager public immutable pausingManager;

    modifier oneTimeWithdrawal(address _liqAddr, uint256 _expiry) {
        require(!liqData[_liqAddr][_expiry].haveWithdrawn[msg.sender], "NOTHING_TO_WITHDRAW");
        _;
        liqData[_liqAddr][_expiry].haveWithdrawn[msg.sender] = true;
    }

    constructor(address _governanceManager, address _pausingManager)
        PermissionsV2(_governanceManager)
    {
        require(_pausingManager != address(0), "ZERO_ADDRESS");
        pausingManager = IPendlePausingManager(_pausingManager);
    }

    function setUpEmergencyMode(address _liqAddr, uint256[] calldata _expiries)
        public
        onlyGovernance
    {
        IPendleLiquidityMining liq = IPendleLiquidityMining(_liqAddr);
        liq.setUpEmergencyMode(_expiries, address(this));
        for (uint256 i = 0; i < _expiries.length; i++) {
            LiqData storage lid = liqData[_liqAddr][_expiries[i]];
            lid.lpHolder = IPendleLpHolder(liq.lpHolderForExpiry(_expiries[i]));
            lid.lpToken = IERC20(lid.lpHolder.pendleMarket());
            lid.underlyingYieldToken = IERC20(lid.lpHolder.underlyingYieldToken());
            lid.totalLp = lid.lpToken.balanceOf(address(lid.lpHolder));
        }
    }

    // TODO: Should this function be a batch function?
    /**
    @dev after every withdraw transaction of users, we pretend that their LP are burnt, therefore
    decrease the totalLp of LpHolder. This way, the amount of underlyingYieldToken they receive when
    doing withdraw will always be proportional to amountLpOut/totalLp
    */
    function withdraw(address _liqAddr, uint256 _expiry)
        public
        oneTimeWithdrawal(_liqAddr, _expiry)
    {
        LiqData storage lid = liqData[_liqAddr][_expiry];

        IPendleLiquidityMining liq = IPendleLiquidityMining(_liqAddr);

        uint256 amountLpOut = liq.getBalances(_expiry, msg.sender);
        lid.lpToken.transferFrom(address(lid.lpHolder), msg.sender, amountLpOut);

        uint256 lpProportion = amountLpOut.rdiv(lid.totalLp);
        uint256 amountYieldTokenOut =
            lpProportion.rmul(lid.underlyingYieldToken.balanceOf(address(lid.lpHolder)));
        lid.underlyingYieldToken.transferFrom(
            address(lid.lpHolder),
            msg.sender,
            amountYieldTokenOut
        );

        lid.totalLp = lid.totalLp.sub(amountLpOut);
    }
}
