// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IRewarder {
    function onJoeReward(address user, uint256 newLpAmount) external;

    function pendingTokens(address user) external view returns (uint256 pending);

    function rewardToken() external view returns (IERC20);
}
