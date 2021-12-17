// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.7.6;
pragma abicoder v2;

import "..//abstractV2/PendleLiquidityMiningBaseV2Multi.sol";
import "../../interfaces/IPendleMasterChef.sol";
import "../../libraries/TokenUtilsLib.sol";

contract PendleJoeLPLiquidityMining is PendleLiquidityMiningBaseV2Multi {
    using PairTokensLib for PairUints;
    using PairTokensLib for PairTokens;
    using TokenUtils for IERC20;

    IPendleMasterChef public immutable masterChef;
    uint256 public immutable pid;

    constructor(
        ConstructorArgs memory args,
        address _masterChef,
        uint256 _pid
    ) PendleLiquidityMiningBaseV2Multi(args) {
        require(_masterChef != address(0), "ZERO_ADDRESS");
        require(
            address(IPendleMasterChef(_masterChef).poolInfo(_pid).lpToken) == args.stakeToken,
            "INVALID_TOKEN_INFO"
        );

        masterChef = IPendleMasterChef(_masterChef);
        pid = _pid;
        IERC20(args.stakeToken).safeApprove(address(_masterChef), type(uint256).max);
    }

    function setUpEmergencyMode(address spender, bool useEmergencyWithdraw)
        external
        virtual
        override
    {
        (, bool emergencyMode) = pausingManager.checkLiqMiningStatus(address(this));
        require(emergencyMode, "NOT_EMERGENCY");

        (address liqMiningEmergencyHandler, , ) = pausingManager.liqMiningEmergencyHandler();
        require(msg.sender == liqMiningEmergencyHandler, "NOT_EMERGENCY_HANDLER");

        if (useEmergencyWithdraw) {
            masterChef.emergencyWithdraw(pid);
        } else {
            masterChef.withdraw(pid, masterChef.userInfo(pid, address(this)).amount);
        }

        //pulling our rewardTokens back
        rewardTokens.safeTransferFrom(
            rewardTokensHolder,
            address(this),
            rewardTokens.balanceOf(rewardTokensHolder)
        );
        rewardTokens.infinityApprove(spender);
        IERC20(stakeToken).safeApprove(spender, type(uint256).max);
        yieldTokens.infinityApprove(spender);
    }

    /**
    @dev there is no caching for paramL, unlike V1
    */
    function _checkNeedUpdateParamL() internal virtual override returns (bool) {
        return true;
    }

    /**
    @dev Joe only allows users to redeem rewards when they stake / withdraw
    */
    function _redeemExternalInterests() internal virtual override {
        masterChef.withdraw(pid, 0);
        if (address(this).balance != 0) weth.deposit{value: address(this).balance}();
    }

    /**
    @dev after tokens are pulled in they will be deposited into MasterChef
     */
    function _pullStakeToken(address from, uint256 amount) internal virtual override {
        IERC20(stakeToken).safeTransferFrom(from, address(this), amount);
        masterChef.deposit(pid, amount);
    }

    /**
    @dev tokens will be pulled from MasterChef before being transfered to users. MasterChefV1
    doesn't allow direct transfer
     */
    function _pushStakeToken(address to, uint256 amount) internal virtual override {
        masterChef.withdraw(pid, amount);
        IERC20(stakeToken).safeTransfer(to, amount);
    }
}
