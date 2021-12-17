// SPDX-License-Identifier: BUSL-1.1
// solhint-disable ordering
pragma solidity 0.7.6;
pragma abicoder v2;

import "../../interfaces/IPendleYieldTokenHolderV2.sol";
import "../../interfaces/IPendleForge.sol";
import "../../libraries/MathLib.sol";
import "../../libraries/TrioTokensLib.sol";
import "../../libraries/TokenUtilsLib.sol";

/// @dev this contract is very similar to BaseV2, just without inheriting from WithdrawableV2
contract PendleYieldTokenHolderBaseV2Multi is IPendleYieldTokenHolderV2 {
    using TokenUtils for IERC20;
    using SafeMath for uint256;
    using TrioTokensLib for TrioTokens;

    // solhint-disable-next-line
    address public constant override rewardToken = address(0); // no longer in use
    address public override yieldToken;
    address public override forge;
    TrioTokens public trioRewardTokens;
    uint256 public override expiry;
    IWETH internal weth;

    modifier onlyForge() {
        require(msg.sender == address(forge), "ONLY_FORGE");
        _;
    }

    constructor(
        address _forge,
        address _yieldToken,
        uint256 _expiry,
        TrioTokens memory _trioRewardTokens
    ) {
        _trioRewardTokens.verify();
        yieldToken = _yieldToken;
        forge = _forge;
        expiry = _expiry;
        trioRewardTokens = _trioRewardTokens;
        weth = IPendleForge(_forge).router().weth();
        trioRewardTokens.infinityApprove(address(IPendleForge(_forge).rewardManager()));
    }

    receive() external payable {}

    function setUpEmergencyMode(address) external pure override {
        revert("FUNCTION_DEPRECIATED");
    }

    // Only forge can call this function
    // this will allow a spender to spend the whole balance of the specified tokens
    // the spender should ideally be a contract with logic for users to withdraw out their funds.
    function setUpEmergencyModeV2(address spender, bool) external virtual override onlyForge {
        // by default we store all the tokens inside this contract, so just approve
        IERC20(yieldToken).safeApprove(spender, type(uint256).max);
        trioRewardTokens.infinityApprove(spender);
    }

    /// @dev by default the token doesn't have any rewards
    function redeemRewards() external virtual override {}

    /// @dev by default we will keep all tokens in this contract, so no further actions necessary
    function afterReceiveTokens(uint256 amount) external virtual override {}

    function pushYieldTokens(
        address to,
        uint256 amount,
        uint256 minNYieldAfterPush
    ) external virtual override onlyForge {
        uint256 yieldTokenBal = IERC20(yieldToken).balanceOf(address(this));
        require(yieldTokenBal.sub(amount) >= minNYieldAfterPush, "INVARIANCE_ERROR");
        IERC20(yieldToken).safeTransfer(to, amount);
    }
}
