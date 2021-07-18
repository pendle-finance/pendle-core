// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.7.6;
pragma abicoder v2;

import "../abstractV2/PendleYieldTokenHolderBaseV2.sol";
import "../../interfaces/IComptroller.sol";

contract PendleCompoundV2YieldTokenHolder is PendleYieldTokenHolderBaseV2 {
    using SafeERC20 for IERC20;
    IComptroller private immutable comptroller;

    constructor(
        address _governanceManager,
        address _forge,
        address _yieldToken,
        address _comptroller,
        uint256 _expiry
    ) PendleYieldTokenHolderBaseV2(_governanceManager, _forge, _yieldToken, _expiry) {
        require(_comptroller != address(0), "ZERO_ADDRESS");
        comptroller = IComptroller(_comptroller);
    }

    // same logic as CompoundV1
    function redeemRewards() external virtual override {
        address[] memory cTokens = new address[](1);
        address[] memory holders = new address[](1);
        cTokens[0] = yieldToken;
        holders[0] = address(this);
        comptroller.claimComp(holders, cTokens, false, true);
    }

    function pushYieldTokens(
        address to,
        uint256 amount,
        uint256 minNYieldAfterPush
    ) external virtual override onlyForge returns (uint256 outAmount) {
        uint256 yieldTokenBal = IERC20(yieldToken).balanceOf(address(this));
        outAmount = Math.min(amount, yieldTokenBal);

        IERC20(yieldToken).safeTransfer(to, outAmount);
        require(yieldTokenBal - outAmount >= minNYieldAfterPush, "INVARIANCE_ERROR");
    }
}
