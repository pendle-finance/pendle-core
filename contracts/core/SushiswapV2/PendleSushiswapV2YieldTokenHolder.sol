// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.7.6;
pragma abicoder v2;

import "../abstractV2/PendleYieldTokenHolderBaseV2.sol";
import "../../interfaces/IMasterChefV2.sol";

// CHECK EVERY SINGLE FUNCTIONS
contract PendleSushiswapV2YieldTokenHolder is PendleYieldTokenHolderBaseV2 {
    using SafeERC20 for IERC20;
    IMasterChefV2 public immutable masterChefV2;
    uint256 public immutable pid;

    constructor(
        address _governanceManager,
        address _forge,
        address _yieldToken,
        address _masterChefV2,
        uint256 _pid,
        uint256 _expiry
    ) PendleYieldTokenHolderBaseV2(_governanceManager, _forge, _yieldToken, _expiry) {
        require(_masterChefV2 != address(0), "ZERO_ADDRESS");
        masterChefV2 = IMasterChefV2(_masterChefV2);
        pid = _pid;
    }

    function setUpEmergencyMode(address spender) external override {
        require(msg.sender == forge, "NOT_FROM_FORGE");
        IERC20(yieldToken).safeApprove(spender, type(uint256).max);
        if (rewardToken != address(0)) {
            IERC20(rewardToken).safeApprove(spender, type(uint256).max);
        }
    }

    function redeemRewards() external virtual override {
        masterChefV2.harvest(pid, address(this));
    }

    function afterReceiveTokens() external virtual override {
        masterChefV2.deposit(pid, IERC20(yieldToken).balanceOf(address(this)), address(this));
    }

    function pushYieldTokens(address to, uint256 amount)
        external
        virtual
        override
        returns (uint256 outAmount)
    {
        uint256 yieldTokenBal = masterChefV2.userInfo(pid, address(this)).amount;
        outAmount = Math.min(amount, yieldTokenBal);
        masterChefV2.withdraw(pid, amount, to);
    }

    function _allowedToWithdraw(address _token) internal view override returns (bool allowed) {
        allowed = _token != yieldToken && _token != rewardToken;
    }
}
