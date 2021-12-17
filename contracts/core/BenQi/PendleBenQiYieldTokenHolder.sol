// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.7.6;
pragma abicoder v2;

import "../abstractV2/PendleYieldTokenHolderBaseV2Multi.sol";
import "../../interfaces/IBenQiComptroller.sol";
import "./PendleBenQiForge.sol";
import "../../libraries/TrioTokensLib.sol";

contract PendleBenQiYieldTokenHolder is PendleYieldTokenHolderBaseV2Multi {
    IBenQiComptroller public immutable comptroller;

    constructor(
        address _forge,
        address _yieldToken,
        uint256 _expiry,
        address _comptroller,
        TrioTokens memory _trioRewardTokens
    ) PendleYieldTokenHolderBaseV2Multi(_forge, _yieldToken, _expiry, _trioRewardTokens) {
        comptroller = IBenQiComptroller(_comptroller);
    }

    function redeemRewards() external virtual override {
        address[] memory qiTokens = new address[](1);
        address[] memory holders = new address[](1);
        qiTokens[0] = yieldToken;
        holders[0] = address(this);
        comptroller.claimReward(0, holders, qiTokens, false, true);
        comptroller.claimReward(1, holders, qiTokens, false, true);
        if (address(this).balance != 0) weth.deposit{value: address(this).balance}();
    }
}
