// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.7.6;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "../../libraries/ExpiryUtilsLib.sol";
import "../../interfaces/IPendleBaseToken.sol";
import "../../interfaces/IPendleData.sol";
import "../../interfaces/IPendleForge.sol";
import "../../interfaces/IPendleRewardManager.sol";
import "../../interfaces/IPendleYieldContractDeployer.sol";
import "../../interfaces/IPendleYieldTokenHolder.sol";
import "../../periphery/WithdrawableV2.sol";
import "../../libraries/MathLib.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice Common contract base for a forge implementation.
/// @dev Each specific forge implementation will need to implement the virtual functions
abstract contract PendleForgeBase is IPendleForge, WithdrawableV2, ReentrancyGuard {
    using ExpiryUtils for string;
    using SafeMath for uint256;
    using Math for uint256;
    using SafeERC20 for IERC20;

    struct PendleTokens {
        IPendleYieldToken xyt;
        IPendleYieldToken ot;
    }

    IPendleRouter public immutable override router;
    IPendleData public immutable override data;
    bytes32 public immutable override forgeId;
    IERC20 public immutable override rewardToken; // COMP/StkAAVE
    IPendleRewardManager public immutable override rewardManager;
    IPendleYieldContractDeployer public immutable override yieldContractDeployer;
    IPendlePausingManager public immutable pausingManager;

    mapping(address => mapping(uint256 => mapping(address => uint256)))
        public
        override dueInterests;

    mapping(address => mapping(uint256 => uint256)) public totalFee;
    mapping(address => mapping(uint256 => address)) public override yieldTokenHolders; // yieldTokenHolders[underlyingAsset][expiry]

    string private constant OT = "OT";
    string private constant XYT = "YT";

    modifier onlyXYT(address _underlyingAsset, uint256 _expiry) {
        require(
            msg.sender == address(data.xytTokens(forgeId, _underlyingAsset, _expiry)),
            "ONLY_YT"
        );
        _;
    }

    modifier onlyOT(address _underlyingAsset, uint256 _expiry) {
        require(
            msg.sender == address(data.otTokens(forgeId, _underlyingAsset, _expiry)),
            "ONLY_OT"
        );
        _;
    }

    modifier onlyRouter() {
        require(msg.sender == address(router), "ONLY_ROUTER");
        _;
    }

    constructor(
        address _governanceManager,
        IPendleRouter _router,
        bytes32 _forgeId,
        address _rewardToken,
        address _rewardManager,
        address _yieldContractDeployer
    ) PermissionsV2(_governanceManager) {
        require(address(_router) != address(0), "ZERO_ADDRESS");
        require(_forgeId != 0x0, "ZERO_BYTES");

        router = _router;
        forgeId = _forgeId;
        IPendleData _dataTemp = IPendleRouter(_router).data();
        data = _dataTemp;
        rewardToken = IERC20(_rewardToken);
        rewardManager = IPendleRewardManager(_rewardManager);
        yieldContractDeployer = IPendleYieldContractDeployer(_yieldContractDeployer);
        pausingManager = _dataTemp.pausingManager();
    }

    // INVARIANT: All write functions must go through this check.
    // All XYT/OT transfers must go through this check as well. As such, XYT/OT transfers are also paused
    function checkNotPaused(address _underlyingAsset, uint256 _expiry) internal {
        (bool paused, ) =
            pausingManager.checkYieldContractStatus(forgeId, _underlyingAsset, _expiry);
        require(!paused, "YIELD_CONTRACT_PAUSED");
    }

    // Only the forgeEmergencyHandler can call this function, when its in emergencyMode
    // this will allow a spender to spend the whole balance of the specified tokens of the yieldTokenHolder contract
    // the spender should ideally be a contract with logic for users to withdraw out their funds.
    function setUpEmergencyMode(
        address _underlyingAsset,
        uint256 _expiry,
        address spender
    ) external override {
        (, bool emergencyMode) =
            pausingManager.checkYieldContractStatus(forgeId, _underlyingAsset, _expiry);
        require(emergencyMode, "NOT_EMERGENCY");
        (address forgeEmergencyHandler, , ) = pausingManager.forgeEmergencyHandler();
        require(msg.sender == forgeEmergencyHandler, "NOT_EMERGENCY_HANDLER");
        IPendleYieldTokenHolder(yieldTokenHolders[_underlyingAsset][_expiry]).setUpEmergencyMode(
            spender
        );
    }

    /**
    Use:
        To create a newYieldContract
    Conditions:
        * only call by Router
        * the yield contract for this pair of _underlyingAsset & _expiry must not exist yet (checked on Router)
    */
    function newYieldContracts(address _underlyingAsset, uint256 _expiry)
        external
        override
        onlyRouter
        returns (address ot, address xyt)
    {
        checkNotPaused(_underlyingAsset, _expiry);
        address yieldToken = _getYieldBearingToken(_underlyingAsset);
        uint8 yieldTokenDecimals = IPendleYieldToken(yieldToken).decimals();

        // require(yieldToken != address(0), "INVALID_ASSET"); Guaranteed by _getYieldBearingToken

        // Deploy the OT contract -> XYT contract -> yieldTokenHolder
        ot = yieldContractDeployer.forgeOwnershipToken(
            _underlyingAsset,
            OT.concat(IPendleBaseToken(yieldToken).name(), _expiry, " "),
            OT.concat(IPendleBaseToken(yieldToken).symbol(), _expiry, "-"),
            yieldTokenDecimals,
            _expiry
        );

        xyt = yieldContractDeployer.forgeFutureYieldToken(
            _underlyingAsset,
            XYT.concat(IPendleBaseToken(yieldToken).name(), _expiry, " "),
            XYT.concat(IPendleBaseToken(yieldToken).symbol(), _expiry, "-"),
            yieldTokenDecimals,
            _expiry
        );

        yieldTokenHolders[_underlyingAsset][_expiry] = yieldContractDeployer
            .deployYieldTokenHolder(yieldToken, _expiry);

        data.storeTokens(forgeId, ot, xyt, _underlyingAsset, _expiry);

        emit NewYieldContracts(forgeId, _underlyingAsset, _expiry, ot, xyt, yieldToken);
    }

    /**
    Use:
        * To redeem the underlying asset & due interests after the XYT has expired
    Conditions:
        * only be called by Router
        * only callable after XYT has expired (checked on Router)
        * If _transferOutRate != RONE, there should be a forwardYieldToken call outside
    Consideration:
        * Why not use redeemUnderlying? Because redeemAfterExpiry doesn't require XYT (which has zero value now).
            Users just need OT to redeem
    */
    function redeemAfterExpiry(
        address _user,
        address _underlyingAsset,
        uint256 _expiry
    ) external override onlyRouter returns (uint256 redeemedAmount) {
        checkNotPaused(_underlyingAsset, _expiry);
        IERC20 yieldToken = IERC20(_getYieldBearingToken(_underlyingAsset));
        PendleTokens memory tokens = _getTokens(_underlyingAsset, _expiry);
        uint256 expiredOTamount = tokens.ot.balanceOf(_user);
        require(expiredOTamount > 0, "NOTHING_TO_REDEEM");

        // burn ot only, since users don't need xyt to redeem this
        tokens.ot.burn(_user, expiredOTamount);

        // calc the value of the OT after since it expired (total of its underlying value + dueInterests since expiry)
        // no forge fee is charged on redeeming OT. Forge fee is only charged on redeeming XYT
        redeemedAmount = _calcTotalAfterExpiry(_underlyingAsset, _expiry, expiredOTamount);

        // redeem the interest of any XYT (of the same underlyingAsset+expiry) that the user is having
        redeemedAmount = redeemedAmount.add(
            _beforeTransferDueInterests(tokens, _underlyingAsset, _expiry, _user, false)
        );

        // transfer back to the user
        redeemedAmount = _safeTransfer(
            yieldToken,
            _underlyingAsset,
            _expiry,
            _user,
            redeemedAmount
        );

        // Notice for anyone taking values from this event:
        //   The redeemedAmount includes the interest due to any XYT held
        //   to get the exact yieldToken redeemed from OT, we need to deduct the (amount +forgeFeeAmount) of interests
        //   settled that was emitted in the DueInterestsSettled event emitted earlier in this same transaction
        emit RedeemYieldToken(
            forgeId,
            _underlyingAsset,
            _expiry,
            expiredOTamount,
            redeemedAmount,
            _user
        );
    }

    /**
    Use:
        * To redeem the underlying asset & due interests before the expiry of the XYT. In this case, for each OT used
        to redeem, there must be an XYT (of the same yield contract)
    Conditions:
        * only be called by Router
        * only callable if the XYT hasn't expired
    */
    function redeemUnderlying(
        address _user,
        address _underlyingAsset,
        uint256 _expiry,
        uint256 _amountToRedeem
    ) external override onlyRouter returns (uint256 redeemedAmount) {
        checkNotPaused(_underlyingAsset, _expiry);
        PendleTokens memory tokens = _getTokens(_underlyingAsset, _expiry);

        IERC20 yieldToken = IERC20(_getYieldBearingToken(_underlyingAsset));

        tokens.ot.burn(_user, _amountToRedeem);
        tokens.xyt.burn(_user, _amountToRedeem);

        /*
        * calc the amount of underlying asset for OT + the amount of dueInterests for XYT
        * dueInterests for XYT has been updated during the process of burning XYT, so we skip updating dueInterests in
            the _beforeTransferDueInterests function
        */
        redeemedAmount = _calcUnderlyingToRedeem(_underlyingAsset, _amountToRedeem).add(
            _beforeTransferDueInterests(tokens, _underlyingAsset, _expiry, _user, true)
        );

        // transfer the amountTransferOut back to the user
        redeemedAmount = _safeTransfer(
            yieldToken,
            _underlyingAsset,
            _expiry,
            _user,
            redeemedAmount
        );

        // Notice for anyone taking values from this event:
        //   The redeemedAmount includes the interest due to the XYT held
        //   to get the exact yieldToken redeemed from OT+XYT, we need to deduct the (amount +forgeFeeAmount) of interests
        //   settled that was emitted in the DueInterestsSettled event emitted earlier in this same transaction
        emit RedeemYieldToken(
            forgeId,
            _underlyingAsset,
            _expiry,
            _amountToRedeem,
            redeemedAmount,
            _user
        );

        return redeemedAmount;
    }

    /**
    Use:
        * To redeem the due interests. This function can always be called regardless of whether the XYT has expired or not
    Conditions:
        * only be called by Router
    */
    function redeemDueInterests(
        address _user,
        address _underlyingAsset,
        uint256 _expiry
    ) external override onlyRouter returns (uint256 amountOut) {
        checkNotPaused(_underlyingAsset, _expiry);
        PendleTokens memory tokens = _getTokens(_underlyingAsset, _expiry);
        IERC20 yieldToken = IERC20(_getYieldBearingToken(_underlyingAsset));

        // update the dueInterests of the user before we transfer out
        amountOut = _beforeTransferDueInterests(tokens, _underlyingAsset, _expiry, _user, false);

        amountOut = _safeTransfer(yieldToken, _underlyingAsset, _expiry, _user, amountOut);
    }

    /**
    Use:
        * To update the dueInterests for users(before their balances of XYT changes)
        * This must be called before any transfer / mint/ burn action of XYT
        (and this has been implemented in the beforeTokenTransfer of the PendleFutureYieldToken)
    Conditions:
        * Can only be called by the respective XYT contract, before transferring XYTs
    */
    function updateDueInterests(
        address _underlyingAsset,
        uint256 _expiry,
        address _user
    ) external override onlyXYT(_underlyingAsset, _expiry) nonReentrant {
        checkNotPaused(_underlyingAsset, _expiry);
        PendleTokens memory tokens = _getTokens(_underlyingAsset, _expiry);
        uint256 principal = tokens.xyt.balanceOf(_user);
        _updateDueInterests(principal, _underlyingAsset, _expiry, _user);
    }

    /**
    Use:
        * To redeem the rewards (COMP and StkAAVE) for users(before their balances of OT changes)
        * This must be called before any transfer / mint/ burn action of OT
        (and this has been implemented in the beforeTokenTransfer of the PendleOwnershipToken)
    Conditions:
        * Can only be called by the respective OT contract, before transferring OTs
    Note:
        This function is just a proxy to call to rewardManager
    */
    function updatePendingRewards(
        address _underlyingAsset,
        uint256 _expiry,
        address _user
    ) external override onlyOT(_underlyingAsset, _expiry) nonReentrant {
        checkNotPaused(_underlyingAsset, _expiry);
        rewardManager.updatePendingRewards(_underlyingAsset, _expiry, _user);
    }

    /**
    Use:
        * To mint OT & XYT given that the user has transferred in _amountToTokenize of aToken/cToken
        * The newly minted OT & XYT can be minted to somebody else different from the user who transfer the aToken/cToken in
    Conditions:
        * Should only be called by Router
        * The yield contract (OT & XYT) must not be expired yet (checked at Router)
    */
    function mintOtAndXyt(
        address _underlyingAsset,
        uint256 _expiry,
        uint256 _amountToTokenize,
        address _to
    )
        external
        override
        onlyRouter
        returns (
            address ot,
            address xyt,
            uint256 amountTokenMinted
        )
    {
        checkNotPaused(_underlyingAsset, _expiry);
        PendleTokens memory tokens = _getTokens(_underlyingAsset, _expiry);

        amountTokenMinted = _calcAmountToMint(_underlyingAsset, _amountToTokenize);

        // updatePendingRewards will be called in mint
        tokens.ot.mint(_to, amountTokenMinted);

        // updateDueInterests will be called in mint
        tokens.xyt.mint(_to, amountTokenMinted);

        emit MintYieldTokens(
            forgeId,
            _underlyingAsset,
            _expiry,
            _amountToTokenize,
            amountTokenMinted,
            _to
        );
        return (address(tokens.ot), address(tokens.xyt), amountTokenMinted);
    }

    /**
    Use:
        * To withdraw the forgeFee
    Conditions:
        * Should only be called by Governance
        * This function must be the only way to withdrawForgeFee
    Consideration:
        * Although this function can be called directly, it doesn't have ReentrancyGuard since it can only be called by governance
    */
    function withdrawForgeFee(address _underlyingAsset, uint256 _expiry)
        external
        override
        onlyGovernance
    {
        checkNotPaused(_underlyingAsset, _expiry);
        IERC20 yieldToken = IERC20(_getYieldBearingToken(_underlyingAsset));

        //ping to update interest up to now
        _updateForgeFee(_underlyingAsset, _expiry, 0);
        uint256 _totalFee = totalFee[_underlyingAsset][_expiry];
        totalFee[_underlyingAsset][_expiry] = 0;

        address treasuryAddress = data.treasury();
        _totalFee = _safeTransfer(
            yieldToken,
            _underlyingAsset,
            _expiry,
            treasuryAddress,
            _totalFee
        );
        emit ForgeFeeWithdrawn(forgeId, _underlyingAsset, _expiry, _totalFee);
    }

    function getYieldBearingToken(address _underlyingAsset) external override returns (address) {
        return _getYieldBearingToken(_underlyingAsset);
    }

    /**
    @notice To be called before the dueInterest of any users is redeemed.
    @param _skipUpdateDueInterests: this is set to true, if there was already a call to _updateDueInterests() in this transaction
    INVARIANT: there must be a transfer of the interests (amountOut) to the user after this function is called
    */
    function _beforeTransferDueInterests(
        PendleTokens memory _tokens,
        address _underlyingAsset,
        uint256 _expiry,
        address _user,
        bool _skipUpdateDueInterests
    ) internal returns (uint256 amountOut) {
        uint256 principal = _tokens.xyt.balanceOf(_user);

        if (!_skipUpdateDueInterests) {
            _updateDueInterests(principal, _underlyingAsset, _expiry, _user);
        }

        amountOut = dueInterests[_underlyingAsset][_expiry][_user];
        dueInterests[_underlyingAsset][_expiry][_user] = 0;

        uint256 forgeFee = data.forgeFee();
        uint256 forgeFeeAmount;
        /*
         * Collect the forgeFee
         * INVARIANT: all XYT interest payout must go through this line
         */
        if (forgeFee > 0) {
            forgeFeeAmount = amountOut.rmul(forgeFee);
            amountOut = amountOut.sub(forgeFeeAmount);
            _updateForgeFee(_underlyingAsset, _expiry, forgeFeeAmount);
        }

        emit DueInterestsSettled(
            forgeId,
            _underlyingAsset,
            _expiry,
            amountOut,
            forgeFeeAmount,
            _user
        );
    }

    /**
    Use:
        * Must be the only way to transfer aToken/cToken out
    Consideration:
        * Due to mathematical precision, in some extreme cases, the forge may lack a few wei of tokens to transfer back
            That's why there is a call to minimize the amount to transfer out with the balance of the contract
        * Nonetheless, because we are collecting some forge fee, so it's expected that all users will receive the full
        amount of aToken/cToken (and we will receive a little less than the correct amount)
    */
    function _safeTransfer(
        IERC20 _yieldToken,
        address _underlyingAsset,
        uint256 _expiry,
        address _user,
        uint256 _amount
    ) internal returns (uint256) {
        address yieldTokenHolder = yieldTokenHolders[_underlyingAsset][_expiry];
        _amount = Math.min(_amount, _yieldToken.balanceOf(yieldTokenHolder));
        if (_amount == 0) return 0;
        _yieldToken.safeTransferFrom(yieldTokenHolder, _user, _amount);
        return _amount;
    }

    function _getTokens(address _underlyingAsset, uint256 _expiry)
        internal
        view
        returns (PendleTokens memory _tokens)
    {
        (_tokens.ot, _tokens.xyt) = data.getPendleYieldTokens(forgeId, _underlyingAsset, _expiry);
    }

    // There shouldn't be any fund in here
    // hence governance is allowed to withdraw anything from here.
    function _allowedToWithdraw(address) internal pure override returns (bool allowed) {
        allowed = true;
    }

    /// INVARIANT: after _updateDueInterests is called, dueInterests[][][] must already be
    /// updated with all the due interest for the user, until exactly the current timestamp (no caching whatsoever)
    /// Refer to updateDueInterests function for more info
    function _updateDueInterests(
        uint256 _principal,
        address _underlyingAsset,
        uint256 _expiry,
        address _user
    ) internal virtual;

    /**
    Use:
        * To update the amount of forgeFee (taking into account the compound interest effect)
        * To be called whenever the forge collect fees, or before withdrawing the fee
    * @param _feeAmount the new fee that this forge just collected
    */
    function _updateForgeFee(
        address _underlyingAsset,
        uint256 _expiry,
        uint256 _feeAmount
    ) internal virtual;

    /// calculate the (principal + interest) from the last action before expiry to now.
    function _calcTotalAfterExpiry(
        address _underlyingAsset,
        uint256 _expiry,
        uint256 redeemedAmount
    ) internal virtual returns (uint256 totalAfterExpiry);

    /// Calc the amount of underlying asset to redeem. Default is 1 OT -> 1 yieldToken, except for Compound
    function _calcUnderlyingToRedeem(address, uint256 _amountToRedeem)
        internal
        virtual
        returns (uint256 underlyingToRedeem)
    {
        underlyingToRedeem = _amountToRedeem;
    }

    /// Calc the amount of OT & XYT to mint. Default is 1 yieldToken -> 1 OT & 1 XYT, except for Compound
    function _calcAmountToMint(address, uint256 _amountToTokenize)
        internal
        virtual
        returns (uint256 amountToMint)
    {
        amountToMint = _amountToTokenize;
    }

    /// Get the address of the yieldBearingToken from Aave/Compound
    function _getYieldBearingToken(address _underlyingAsset) internal virtual returns (address);
}
