// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.7.6;
pragma abicoder v2;

import "../interfaces/IPendleMasterChef.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/IWETH.sol";

import "../libraries/TrioTokensLib.sol";
import "../libraries/TokenUtilsLib.sol";

contract MockPendleTraderJoeRewardRedeemer is IPendleMasterChef {
    using TokenUtils for IERC20;
    using SafeMath for uint256;
    using TrioTokensLib for TrioTokens;

    address public immutable yieldTokenHolderAddr;
    IERC20 public immutable lpToken;
    TrioTokens public rewardTokens;
    IPendleMasterChef public immutable masterChef;
    uint32 public immutable pid;
    IWETH public immutable weth;

    modifier onlyYieldTokenHolder() {
        require(msg.sender == yieldTokenHolderAddr, "NOT_YIELD_TOKEN_HOLDER");
        _;
    }

    modifier onlyValidPid(uint256 _pid) {
        require(pid == _pid, "INVALID_PID");
        _;
    }

    constructor(
        address _yieldTokenHolderAddr,
        IERC20 _lpToken,
        IPendleMasterChef _masterChef,
        uint32 _pid,
        uint256[] memory _rewardTokens,
        IWETH _weth
    ) {
        require(
            address(_masterChef.poolInfo(_pid).lpToken) == address(_lpToken),
            "INVALID_TOKEN_INFO"
        );
        require(_rewardTokens.length == 3, "INVALID_TOKEN_INFO");
        lpToken = _lpToken;
        masterChef = _masterChef;
        pid = _pid;
        yieldTokenHolderAddr = _yieldTokenHolderAddr;
        rewardTokens = TrioTokens(
            address(_rewardTokens[0]),
            address(_rewardTokens[1]),
            address(_rewardTokens[2])
        );
        weth = _weth;
        _lpToken.safeApprove(address(_masterChef), type(uint256).max);
    }

    receive() external payable {}

    function deposit(uint256 _pid, uint256 amount)
        public
        override
        onlyYieldTokenHolder
        onlyValidPid(_pid)
    {
        lpToken.safeTransferFrom(yieldTokenHolderAddr, address(this), amount);
        afterReceiveTokens(amount);
    }

    function afterReceiveTokens(uint256 amount) public {
        masterChef.deposit(pid, amount);
    }

    function withdraw(uint256 _pid, uint256 amount)
        public
        override
        onlyYieldTokenHolder
        onlyValidPid(_pid)
    {
        masterChef.withdraw(pid, amount);
        if (address(this).balance != 0) weth.deposit{value: address(this).balance}();
        if (amount > 0) lpToken.safeTransfer(yieldTokenHolderAddr, amount);
        _returnRewardTokens();
    }

    function emergencyWithdraw(uint256 _pid)
        public
        override
        onlyYieldTokenHolder
        onlyValidPid(_pid)
    {
        masterChef.emergencyWithdraw(pid);
        lpToken.safeTransfer(yieldTokenHolderAddr, lpToken.balanceOf(address(this)));
        _returnRewardTokens();
    }

    function userInfo(uint256, address) public view override returns (UserInfo memory) {
        return masterChef.userInfo(pid, address(this));
    }

    function poolInfo(uint256) public view override returns (PoolInfo memory) {
        return masterChef.poolInfo(pid);
    }

    function _returnRewardTokens() internal {
        rewardTokens.safeTransfer(yieldTokenHolderAddr, rewardTokens.balanceOf(address(this)));
    }
}
