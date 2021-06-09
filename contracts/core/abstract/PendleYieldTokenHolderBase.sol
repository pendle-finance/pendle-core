// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.7.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "../../interfaces/IPendleYieldTokenHolder.sol";
import "../../periphery/WithdrawableV2.sol";

abstract contract PendleYieldTokenHolderBase is IPendleYieldTokenHolder, WithdrawableV2 {
    using SafeERC20 for IERC20;

    address public immutable override yieldToken;
    address public immutable override forge;
    address public immutable override rewardToken;
    uint256 public immutable override expiry;

    constructor(
        address _governanceManager,
        address _forge,
        address _yieldToken,
        address _rewardToken,
        address _rewardManager,
        uint256 _expiry
    ) PermissionsV2(_governanceManager) {
        require(_yieldToken != address(0) && _rewardToken != address(0), "ZERO_ADDRESS");
        yieldToken = _yieldToken;
        forge = _forge;
        rewardToken = _rewardToken;
        expiry = _expiry;

        IERC20(_yieldToken).safeApprove(_forge, type(uint256).max);
        IERC20(_rewardToken).safeApprove(_rewardManager, type(uint256).max);
    }

    function redeemRewards() external virtual override;

    // Only forge can call this function
    // this will allow a spender to spend the whole balance of the specified tokens
    // the spender should ideally be a contract with logic for users to withdraw out their funds.
    function setUpEmergencyMode(address spender) external override {
        require(msg.sender == forge, "NOT_FROM_FORGE");
        IERC20(yieldToken).safeApprove(spender, type(uint256).max);
        IERC20(rewardToken).safeApprove(spender, type(uint256).max);
    }

    // The governance address will be able to withdraw any tokens except for
    // the yieldToken and the rewardToken
    function _allowedToWithdraw(address _token) internal view override returns (bool allowed) {
        allowed = _token != yieldToken && _token != rewardToken;
    }
}
