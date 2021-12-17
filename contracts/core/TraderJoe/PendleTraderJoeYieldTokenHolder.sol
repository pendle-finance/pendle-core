// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.7.6;
pragma abicoder v2;

import "../abstractV2/PendleYieldTokenHolderBaseV2Multi.sol";
import "../../interfaces/IPendleMasterChef.sol";
import "../../libraries/TrioTokensLib.sol";
import "./PendleTraderJoeForge.sol";

contract PendleTraderJoeYieldTokenHolder is PendleYieldTokenHolderBaseV2Multi {
    using TokenUtils for IERC20;
    using SafeMath for uint256;
    using TrioTokensLib for TrioTokens;

    // Unless Joe writes and uses MasterChef V4, this address will be either MCV2 or MCV3
    IPendleMasterChef public masterChef;
    uint32 public pid;

    constructor(
        address _forge,
        address _yieldToken,
        uint256 _expiry,
        address _masterChef,
        uint256 _pid,
        TrioTokens memory _trioRewardTokens
    ) PendleYieldTokenHolderBaseV2Multi(_forge, _yieldToken, _expiry, _trioRewardTokens) {
        masterChef = IPendleMasterChef(_masterChef);
        pid = uint32(_pid);
        IERC20(_yieldToken).safeApprove(_masterChef, type(uint256).max);
    }

    function setUpEmergencyModeV2(address spender, bool useEmergencyWithdraw)
        external
        override
        onlyForge
    {
        // withdraw all yieldToken back (and all rewards at the same time)
        if (useEmergencyWithdraw) masterChef.emergencyWithdraw(pid);
        else masterChef.withdraw(pid, masterChef.userInfo(pid, address(this)).amount);

        IERC20(yieldToken).safeApprove(spender, type(uint256).max);
        trioRewardTokens.infinityApprove(spender);
    }

    function redeemRewards() external virtual override {
        masterChef.withdraw(pid, 0);
        if (address(this).balance != 0) weth.deposit{value: address(this).balance}();
    }

    function afterReceiveTokens(uint256 amount) external virtual override {
        masterChef.deposit(pid, amount);
    }

    function pushYieldTokens(
        address to,
        uint256 amount,
        uint256 minNYieldAfterPush
    ) external virtual override onlyForge {
        uint256 yieldTokenBal = masterChef.userInfo(pid, address(this)).amount;
        require(yieldTokenBal.sub(amount) >= minNYieldAfterPush, "INVARIANCE_ERROR");
        masterChef.withdraw(pid, amount);
        IERC20(yieldToken).safeTransfer(to, amount);
    }

    function migrateMasterChef(address newMasterChef, uint256 newPid) public onlyForge {
        uint256 yieldTokenBal = masterChef.userInfo(pid, address(this)).amount;
        masterChef.withdraw(pid, yieldTokenBal);
        IERC20(yieldToken).safeApprove(address(masterChef), 0);

        pid = uint32(newPid);
        masterChef = IPendleMasterChef(newMasterChef);

        IERC20(yieldToken).safeApprove(address(masterChef), type(uint256).max);
        masterChef.deposit(pid, yieldTokenBal);
    }
}
