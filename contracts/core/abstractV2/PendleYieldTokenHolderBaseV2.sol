// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.7.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "../../interfaces/IPendleYieldTokenHolderV2.sol";
import "../../interfaces/IPendleForge.sol";
import "../../periphery/WithdrawableV2.sol";
import "../../libraries/MathLib.sol";

contract PendleYieldTokenHolderBaseV2 is IPendleYieldTokenHolderV2, WithdrawableV2 {
    using SafeERC20 for IERC20;
    using Math for uint256;
    using SafeMath for uint256;

    address public immutable override yieldToken;
    address public immutable override forge;
    address public override rewardToken; // no immutable to save bytecode size
    uint256 public override expiry; // no immutable to save bytecode size

    modifier onlyForge() {
        require(msg.sender == address(forge), "ONLY_FORGE");
        _;
    }

    constructor(
        address _governanceManager,
        address _forge,
        address _yieldToken,
        uint256 _expiry
    ) PermissionsV2(_governanceManager) {
        address _rewardToken = address(IPendleForge(_forge).rewardToken());
        address rewardManager = address(IPendleForge(_forge).rewardManager());

        yieldToken = _yieldToken;
        forge = _forge;
        rewardToken = _rewardToken;
        expiry = _expiry;

        IERC20(_rewardToken).safeApprove(rewardManager, type(uint256).max);
    }

    /**
    @dev function has been depreciated but must still be left here to conform with the interface
    */
    function setUpEmergencyMode(address) external pure override {
        revert("FUNCTION_DEPRECIATED");
    }

    // Only forge can call this function
    // this will allow a spender to spend the whole balance of the specified tokens
    // the spender should ideally be a contract with logic for users to withdraw out their funds.
    function setUpEmergencyModeV2(address spender, bool) external virtual override onlyForge {
        // by default we store all the tokens inside this contract, so just approve
        IERC20(yieldToken).safeApprove(spender, type(uint256).max);
        IERC20(rewardToken).safeApprove(spender, type(uint256).max);
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

    // The governance address will be able to withdraw any tokens except for
    // the yieldToken and the rewardToken
    function _allowedToWithdraw(address _token)
        internal
        view
        virtual
        override
        returns (bool allowed)
    {
        allowed = _token != yieldToken && _token != rewardToken;
    }
}
