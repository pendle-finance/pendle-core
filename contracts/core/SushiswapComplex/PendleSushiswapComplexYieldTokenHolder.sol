// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.7.6;
pragma abicoder v2;

import "../abstractV2/PendleYieldTokenHolderBaseV2.sol";
import "../../interfaces/IMasterChef.sol";

contract PendleSushiswapComplexYieldTokenHolder is PendleYieldTokenHolderBaseV2 {
    using SafeERC20 for IERC20;
    IMasterChef public immutable masterChef;
    uint256 public immutable pid;

    constructor(
        address _governanceManager,
        address _forge,
        address _yieldToken,
        uint256 _expiry,
        address _masterChef,
        uint256 _pid
    ) PendleYieldTokenHolderBaseV2(_governanceManager, _forge, _yieldToken, _expiry) {
        require(_masterChef != address(0), "ZERO_ADDRESS");
        masterChef = IMasterChef(_masterChef);
        pid = _pid;
        IERC20(_yieldToken).safeApprove(_masterChef, type(uint256).max);
    }

    function setUpEmergencyMode(address spender) external override onlyForge {
        // withdraw all yieldToken back (and all rewards at the same time)
        masterChef.withdraw(pid, masterChef.userInfo(pid, address(this)).amount);
        IERC20(yieldToken).safeApprove(spender, type(uint256).max);
        IERC20(rewardToken).safeApprove(spender, type(uint256).max);
    }

    /**
    @dev MasterChefV1 doesn't allow redeeming rewards separately, so here it will do withdraw 0
    */
    function redeemRewards() external virtual override {
        masterChef.withdraw(pid, 0);
    }

    /**
    @dev deposit the tokens into MasterChef
    */
    function afterReceiveTokens(uint256 amount) external virtual override {
        masterChef.deposit(pid, amount);
    }

    function pushYieldTokens(
        address to,
        uint256 amount,
        uint256 minNYieldAfterPush
    ) external virtual override onlyForge returns (uint256 outAmount) {
        uint256 yieldTokenBal = masterChef.userInfo(pid, address(this)).amount;
        outAmount = Math.min(amount, yieldTokenBal);
        require(yieldTokenBal - outAmount >= minNYieldAfterPush, "INVARIANCE_ERROR");

        masterChef.withdraw(pid, outAmount);
        IERC20(yieldToken).safeTransfer(to, outAmount);
    }
}
