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

        IERC20(_yieldToken).safeApprove(_forge, type(uint256).max);
        IERC20(_rewardToken).safeApprove(rewardManager, type(uint256).max);
    }

    // Only forge can call this function
    // this will allow a spender to spend the whole balance of the specified tokens
    // the spender should ideally be a contract with logic for users to withdraw out their funds.
    function setUpEmergencyMode(address spender) external virtual override onlyForge {
        IERC20(yieldToken).safeApprove(spender, type(uint256).max);
        IERC20(rewardToken).safeApprove(spender, type(uint256).max);
    }

    function redeemRewards() external virtual override {} // intentionally left empty

    function afterReceiveTokens() external virtual override {} // intentionally left empty

    function pushYieldTokens(address to, uint256 amount)
        external
        virtual
        override
        onlyForge
        returns (uint256 outAmount)
    {
        outAmount = Math.min(amount, IERC20(yieldToken).balanceOf(address(this)));
        IERC20(yieldToken).transfer(to, outAmount);
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
