// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.7.6;
pragma abicoder v2;

import "../abstractV2/PendleLiquidityMiningBaseV2.sol";
import "../../interfaces/IMasterChef.sol";

contract PendleSushiswapComplexLiquidityMining is PendleLiquidityMiningBaseV2 {
    using SafeERC20 for IERC20;
    IMasterChef public immutable masterChef;
    uint256 public immutable pid;

    constructor(
        address _governanceManager,
        address _pausingManager,
        address _whitelist,
        address _pendleTokenAddress,
        address _stakeToken,
        address _yieldToken,
        uint256 _startTime,
        uint256 _epochDuration,
        uint256 _vestingEpochs,
        address _masterChef,
        uint256 _pid
    )
        PendleLiquidityMiningBaseV2(
            _governanceManager,
            _pausingManager,
            _whitelist,
            _pendleTokenAddress,
            _stakeToken,
            _yieldToken,
            _startTime,
            _epochDuration,
            _vestingEpochs
        )
    {
        require(_masterChef != address(0), "ZERO_ADDRESS");
        require(IERC20(_yieldToken).totalSupply() > 0, "INVALID_ERC20");

        masterChef = IMasterChef(_masterChef);
        pid = _pid;
        IERC20(_stakeToken).approve(address(_masterChef), type(uint256).max);
    }

    function setUpEmergencyMode(address spender) external virtual override {
        (, bool emergencyMode) = pausingManager.checkLiqMiningStatus(address(this));
        require(emergencyMode, "NOT_EMERGENCY");

        (address liqMiningEmergencyHandler, , ) = pausingManager.liqMiningEmergencyHandler();
        require(msg.sender == liqMiningEmergencyHandler, "NOT_EMERGENCY_HANDLER");

        masterChef.withdraw(pid, masterChef.userInfo(pid, address(this)).amount);

        IERC20(pendleTokenAddress).safeApprove(spender, type(uint256).max);
        IERC20(stakeToken).safeApprove(spender, type(uint256).max);
        IERC20(yieldToken).approve(spender, type(uint256).max);
    }

    /**
    @dev there is no caching for paramL, unlike V1
    */
    function _checkNeedUpdateParamL() internal virtual override returns (bool) {
        return true;
    }

    /**
    @dev Sushi only allows users to redeem rewards when they stake / withdraw
    */
    function _redeemExternalInterests() internal virtual override {
        masterChef.withdraw(pid, 0);
    }

    /**
    @dev after tokens are pulled in they will be deposited into MasterChef
     */
    function _pullStakeToken(address from, uint256 _amount) internal virtual override {
        IERC20(stakeToken).safeTransferFrom(from, address(this), _amount);
        masterChef.deposit(pid, IERC20(stakeToken).balanceOf(address(this)));
    }

    /**
    @dev tokens will be pulled from MasterChef before being transfered to users. MasterChefV1
    doesn't allow direct transfer
     */
    function _pushStakeToken(address to, uint256 _amount)
        internal
        virtual
        override
        returns (uint256 outAmount)
    {
        uint256 stakeTokenBal = masterChef.userInfo(pid, address(this)).amount;
        outAmount = Math.min(_amount, stakeTokenBal);

        masterChef.withdraw(pid, _amount);
        IERC20(stakeToken).safeTransfer(to, _amount);
    }
}
