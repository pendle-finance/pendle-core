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

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "../interfaces/IPendleLpHolder.sol";
import "../interfaces/IPendleRouter.sol";
import "../periphery/WithdrawableV2.sol";

contract PendleLpHolder is IPendleLpHolder, WithdrawableV2 {
    using SafeERC20 for IERC20;

    address private immutable pendleLiquidityMining;
    address public immutable override underlyingYieldToken;
    address public immutable override pendleMarket;
    address private immutable router;

    modifier onlyLiquidityMining() {
        require(msg.sender == pendleLiquidityMining, "ONLY_LIQUIDITY_MINING");
        _;
    }

    constructor(
        address _governanceManager,
        address _pendleMarket,
        address _router,
        address _underlyingYieldToken
    ) PermissionsV2(_governanceManager) {
        require(
            _pendleMarket != address(0) &&
                _router != address(0) &&
                _underlyingYieldToken != address(0),
            "ZERO_ADDRESS"
        );
        pendleMarket = _pendleMarket;
        router = _router;
        pendleLiquidityMining = msg.sender;
        underlyingYieldToken = _underlyingYieldToken;
    }

    function sendLp(address user, uint256 amount) external override onlyLiquidityMining {
        IERC20(pendleMarket).safeTransfer(user, amount);
    }

    function sendInterests(address user, uint256 amount) external override onlyLiquidityMining {
        IERC20(underlyingYieldToken).safeTransfer(user, amount);
    }

    function redeemLpInterests() external override onlyLiquidityMining {
        IPendleRouter(router).redeemLpInterests(pendleMarket, address(this));
    }

    // governance address is allowed to withdraw tokens except for
    // the yield token and the LPs staked here
    function _allowedToWithdraw(address _token) internal view override returns (bool allowed) {
        allowed = _token != underlyingYieldToken && _token != pendleMarket;
    }

    // Only liquidityMining contract can call this function
    // this will allow a spender to spend the whole balance of the specified token
    // the spender should ideally be a contract with logic for users to withdraw out their funds.
    function setUpEmergencyMode(address spender) external override onlyLiquidityMining {
        IERC20(underlyingYieldToken).safeApprove(spender, type(uint256).max);
        IERC20(pendleMarket).safeApprove(spender, type(uint256).max);
    }
}
