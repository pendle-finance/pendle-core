// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.7.6;
pragma abicoder v2;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IPendleMasterChef {
    struct UserInfo {
        uint256 amount;
        uint256 _ignore1;
    }

    struct PoolInfo {
        IERC20 lpToken;
        uint256 _ignore1;
        uint256 _ignore2;
        uint256 _ignore3;
        address _ignore4;
    }

    function deposit(uint256 _pid, uint256 _amount) external;

    function withdraw(uint256 _pid, uint256 _amount) external;

    function emergencyWithdraw(uint256 pid) external;

    function userInfo(uint256 pid, address user) external view returns (UserInfo calldata);

    function poolInfo(uint256 pid) external view returns (PoolInfo calldata);
}
