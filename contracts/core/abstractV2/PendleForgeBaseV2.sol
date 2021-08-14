// SPDX-License-Identifier: BUSL-1.1
// solhint-disable ordering
pragma solidity 0.7.6;
pragma abicoder v2;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "../../libraries/ExpiryUtilsLib.sol";
import "../../interfaces/IPendleBaseToken.sol";
import "../../interfaces/IPendleData.sol";
import "../../interfaces/IPendleForgeV2.sol";
import "../../interfaces/IPendleRewardManager.sol";
import "../../interfaces/IPendleYieldContractDeployer.sol";
import "../../interfaces/IPendleYieldContractDeployerV2.sol";
import "../../interfaces/IPendleYieldTokenHolderV2.sol";
import "../../periphery/WithdrawableV2.sol";
import "../../libraries/MathLib.sol";
import "../../libraries/TokenUtilsLib.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice Common contract base for a forge implementation.
/// @dev Each specific forge implementation will need to override necessary virtual functions
abstract contract PendleForgeBaseV2 is IPendleForgeV2, WithdrawableV2, ReentrancyGuard {
    using ExpiryUtils for string;
    using SafeMath for uint256;
    using Math for uint256;
    using SafeERC20 for IERC20;

    struct PendleTokens {
        IPendleYieldToken xyt;
        IPendleYieldToken ot;
    }

    // the container here will contain any data needed by tokens. Fields of type that are not
    // uin256 will be upcasted to uint256 and downcasted when use
    struct TokenInfo {
        bool registered;
        uint256[] container;
    }

    IPendleRouter public immutable override router;
    IPendleData public immutable override data;
    bytes32 public immutable override forgeId;
    IERC20 public immutable override rewardToken;
    IPendleRewardManager public immutable override rewardManager;
    IPendleYieldContractDeployer public immutable override yieldContractDeployer;
    IPendlePausingManager public immutable pausingManager;

    mapping(address => mapping(uint256 => mapping(address => uint256)))
        public
        override dueInterests;

    mapping(address => mapping(uint256 => uint256)) public totalFee;
    mapping(address => mapping(uint256 => address)) public override yieldTokenHolders; // yieldTokenHolders[underlyingAsset][expiry]
    mapping(address => TokenInfo) public tokenInfo;

    string private constant OT = "OT";
    string private constant XYT = "YT";

    event RegisterTokens(bytes32 forgeId, address underlyingAsset, uint256[] container);

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
        // In the case there is no rewardToken, a valid ERC20 token must still be passed in for
        // compatibility reasons
        TokenUtils.requireERC20(_rewardToken);
        router = _router;
        forgeId = _forgeId;
        IPendleData _dataTemp = IPendleRouter(_router).data();
        data = _dataTemp;
        rewardToken = IERC20(_rewardToken);
        rewardManager = IPendleRewardManager(_rewardManager);
        yieldContractDeployer = IPendleYieldContractDeployer(_yieldContractDeployer);
        pausingManager = _dataTemp.pausingManager();
    }

    /**
    @dev INVARIANT: All write functions must go through this check.
    All XYT/OT transfers must go through this check as well. As such, XYT/OT transfers are also paused
    */
    function checkNotPaused(address _underlyingAsset, uint256 _expiry) internal virtual {
        (bool paused, ) = pausingManager.checkYieldContractStatus(
            forgeId,
            _underlyingAsset,
            _expiry
        );
        require(!paused, "YIELD_CONTRACT_PAUSED");
    }

    /**
    @dev function has been depreciated but must still be left here to conform with the interface
    */
    function setUpEmergencyMode(
        address,
        uint256,
        address
    ) external pure override {
        revert("FUNCTION_DEPRECIATED");
    }

    /**
    @dev  Only the forgeEmergencyHandler can call this function, when its in emergencyMode this
    will allow a spender to spend the whole balance of the specified tokens of the yieldTokenHolder contract
    @dev the spender should ideally be a contract with logic for users to withdraw out their funds
    @param extraFlag an optional flag for any forges which need an additional flag (like SushiComplex
    which allows either normal withdraw or emergencyWithdraw)
    */
    function setUpEmergencyModeV2(
        address _underlyingAsset,
        uint256 _expiry,
        address spender,
        bool extraFlag
    ) external virtual override {
        (, bool emergencyMode) = pausingManager.checkYieldContractStatus(
            forgeId,
            _underlyingAsset,
            _expiry
        );
        require(emergencyMode, "NOT_EMERGENCY");
        (address forgeEmergencyHandler, , ) = pausingManager.forgeEmergencyHandler();
        require(msg.sender == forgeEmergencyHandler, "NOT_EMERGENCY_HANDLER");
        IPendleYieldTokenHolderV2(yieldTokenHolders[_underlyingAsset][_expiry])
            .setUpEmergencyModeV2(spender, extraFlag);
    }

    /**
    @dev each element in the _underlyingAssets array will have one auxillary array in _tokenInfos
    to store necessary data.
    @dev only governance can call this. In V2 we no longer allow users to self-register new tokens
    */
    function registerTokens(address[] calldata _underlyingAssets, uint256[][] calldata _tokenInfos)
        external
        virtual
        onlyGovernance
    {
        require(_underlyingAssets.length == _tokenInfos.length, "LENGTH_MISMATCH");
        for (uint256 i = 0; i < _underlyingAssets.length; ++i) {
            TokenInfo storage info = tokenInfo[_underlyingAssets[i]];
            require(!info.registered, "EXISTED_TOKENS");
            verifyToken(_underlyingAssets[i], _tokenInfos[i]);
            info.registered = true;
            info.container = _tokenInfos[i];
            emit RegisterTokens(forgeId, _underlyingAssets[i], _tokenInfos[i]);
        }
    }

    /**
    @dev this function should be implemented on a best effort basis, since we only call from
    governance anyway
    */
    function verifyToken(address _underlyingAsset, uint256[] calldata _tokenInfo) public virtual;

    /**
    @notice to create a newYieldContract
    @dev Conditions:
        * only call by Router
        * the yield contract for this pair of _underlyingAsset & _expiry must not exist yet (checked on Router)
    */
    function newYieldContracts(address _underlyingAsset, uint256 _expiry)
        external
        virtual
        override
        onlyRouter
        returns (address ot, address xyt)
    {
        checkNotPaused(_underlyingAsset, _expiry);
        address yieldToken = getYieldBearingToken(_underlyingAsset);

        uint8 underlyingAssetDecimals = IPendleYieldToken(_underlyingAsset).decimals();

        // Deploy the OT contract -> XYT contract -> yieldTokenHolder
        ot = yieldContractDeployer.forgeOwnershipToken(
            _underlyingAsset,
            OT.concat(IPendleBaseToken(yieldToken).name(), _expiry, " "),
            OT.concat(IPendleBaseToken(yieldToken).symbol(), _expiry, "-"),
            underlyingAssetDecimals,
            _expiry
        );

        xyt = yieldContractDeployer.forgeFutureYieldToken(
            _underlyingAsset,
            XYT.concat(IPendleBaseToken(yieldToken).name(), _expiry, " "),
            XYT.concat(IPendleBaseToken(yieldToken).symbol(), _expiry, "-"),
            underlyingAssetDecimals,
            _expiry
        );

        // Because we have to conform with the IPendleForge interface, we must store
        // YieldContractDeployerV2 as V1, then upcast here
        yieldTokenHolders[_underlyingAsset][_expiry] = IPendleYieldContractDeployerV2(
            address(yieldContractDeployer)
        ).deployYieldTokenHolder(yieldToken, _expiry, tokenInfo[_underlyingAsset].container);

        data.storeTokens(forgeId, ot, xyt, _underlyingAsset, _expiry);

        emit NewYieldContracts(forgeId, _underlyingAsset, _expiry, ot, xyt, yieldToken);
    }

    /**
    @notice To redeem the underlying asset & due interests after the XYT has expired
    @dev Conditions:
        * only be called by Router
        * only callable after XYT has expired (checked on Router)
    */
    function redeemAfterExpiry(
        address _user,
        address _underlyingAsset,
        uint256 _expiry
    ) external virtual override onlyRouter returns (uint256 redeemedAmount) {
        checkNotPaused(_underlyingAsset, _expiry);
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
        _pushYieldToken(_underlyingAsset, _expiry, _user, redeemedAmount);

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
    @notice To redeem the underlying asset & due interests before the expiry of the XYT.
    In this case, for each OT used to redeem, there must be an XYT (of the same yield contract)
    @dev  Conditions:
        * only be called by Router
        * only callable if the XYT hasn't expired
    */
    function redeemUnderlying(
        address _user,
        address _underlyingAsset,
        uint256 _expiry,
        uint256 _amountToRedeem
    ) external virtual override onlyRouter returns (uint256 redeemedAmount) {
        checkNotPaused(_underlyingAsset, _expiry);
        PendleTokens memory tokens = _getTokens(_underlyingAsset, _expiry);

        tokens.ot.burn(_user, _amountToRedeem);
        tokens.xyt.burn(_user, _amountToRedeem);

        /*
        * calc the amount of underlying asset for OT + the amount of dueInterests for XYT
        * dueInterests for XYT has been updated during the process of burning XYT, so we skip
        updating dueInterests in the _beforeTransferDueInterests function
        */
        redeemedAmount = _calcUnderlyingToRedeem(_underlyingAsset, _amountToRedeem).add(
            _beforeTransferDueInterests(tokens, _underlyingAsset, _expiry, _user, true)
        );

        // transfer back to the user
        _pushYieldToken(_underlyingAsset, _expiry, _user, redeemedAmount);

        // Notice for anyone taking values from this event:
        //   The redeemedAmount includes the interest due to the XYT held
        //   to get the exact yieldToken redeemed from OT+XYT, we need to deduct the
        //   (amount +forgeFeeAmount) of interests settled that was emitted in the
        //   DueInterestsSettled event emitted earlier in this same transaction
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
    @notice To redeem the due interests. This function can always be called regardless of whether
        the XYT has expired or not
    @dev Conditions:
        * only be called by Router
    */
    function redeemDueInterests(
        address _user,
        address _underlyingAsset,
        uint256 _expiry
    ) external virtual override onlyRouter returns (uint256 amountOut) {
        checkNotPaused(_underlyingAsset, _expiry);
        PendleTokens memory tokens = _getTokens(_underlyingAsset, _expiry);

        // update the dueInterests of the user before we transfer out
        amountOut = _beforeTransferDueInterests(tokens, _underlyingAsset, _expiry, _user, false);

        _pushYieldToken(_underlyingAsset, _expiry, _user, amountOut);
    }

    /**
    @notice To update the dueInterests for users(before their balances of XYT changes)
    @dev This must be called before any transfer / mint/ burn action of XYT
        (and this has been implemented in the beforeTokenTransfer of the PendleFutureYieldToken)
    @dev Conditions:
        * Can only be called by the respective XYT contract, before transferring XYTs
    */
    function updateDueInterests(
        address _underlyingAsset,
        uint256 _expiry,
        address _user
    ) external virtual override onlyXYT(_underlyingAsset, _expiry) nonReentrant {
        checkNotPaused(_underlyingAsset, _expiry);
        PendleTokens memory tokens = _getTokens(_underlyingAsset, _expiry);
        uint256 principal = tokens.xyt.balanceOf(_user);
        _updateDueInterests(principal, _underlyingAsset, _expiry, _user);
    }

    /**
    @notice To redeem the rewards (COMP, StkAAVE, SUSHI,...) for users(before their balances of OT changes)
    @dev This must be called before any transfer / mint/ burn action of OT
        (and this has been implemented in the beforeTokenTransfer of the PendleOwnershipToken)
    @dev Conditions:
        * Can only be called by the respective OT contract, before transferring OTs
    Note:
        This function is just a proxy to call to rewardManager
    */
    function updatePendingRewards(
        address _underlyingAsset,
        uint256 _expiry,
        address _user
    ) external virtual override onlyOT(_underlyingAsset, _expiry) nonReentrant {
        checkNotPaused(_underlyingAsset, _expiry);
        rewardManager.updatePendingRewards(_underlyingAsset, _expiry, _user);
    }

    /**
    @notice To mint OT & XYT given that the user has transferred in _amountToTokenize of yieldToken
    @dev The newly minted OT & XYT can be minted to somebody else different from the user who transfer the aToken/cToken in
    @dev Conditions:
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
        virtual
        override
        onlyRouter
        returns (
            address ot,
            address xyt,
            uint256 amountTokenMinted
        )
    {
        checkNotPaused(_underlyingAsset, _expiry);

        // surely if any users call tokenizeYield, they will have to call this function
        IPendleYieldTokenHolderV2(yieldTokenHolders[_underlyingAsset][_expiry]).afterReceiveTokens(
            _amountToTokenize
        );

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
    @notice To withdraw the forgeFee
    @dev Conditions:
        * Should only be called by Governance
        * This function must be the only way to withdrawForgeFee
    */
    function withdrawForgeFee(address _underlyingAsset, uint256 _expiry)
        external
        virtual
        override
        onlyGovernance
    {
        checkNotPaused(_underlyingAsset, _expiry);
        //ping to update interest up to now
        _updateForgeFee(_underlyingAsset, _expiry, 0);
        uint256 _totalFee = totalFee[_underlyingAsset][_expiry];
        totalFee[_underlyingAsset][_expiry] = 0;

        address treasuryAddress = data.treasury();
        _pushYieldToken(_underlyingAsset, _expiry, treasuryAddress, _totalFee);
        emit ForgeFeeWithdrawn(forgeId, _underlyingAsset, _expiry, _totalFee);
    }

    function getYieldBearingToken(address _underlyingAsset)
        public
        virtual
        override
        returns (address);

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
    ) internal virtual returns (uint256 amountOut) {
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
    @dev Must be the only way to transfer yieldToken out
    @dev summary of invariance logic:
    - This is the only function where the underlying yield tokens are transfered out
    - After this function executes (at the end of the .pushYieldTokens() function), we require that
    there must be enough yield tokens left to entertain all OT holders redeeming
    - As such, protocol users are always assured that they can redeem back their underlying yield tokens
    - Further note: this pushYieldTokens function relies on the same calc functions
    (_calcUnderlyingToRedeem and _calcTotalAfterExpiry) as the functions that called pushYieldTokens.
    Why it is safe to do that? Because to drain funds, hackers need to compromise the calc functions to
    return a very large result (hence large _amount in this function) but in the same transaction,
    they also need to compromise the very same calc function to return a very small result (to fool
    the contract that all the underlyingAsset of OTs are still intact). Doing these 2
    compromises in one single transaction is much harder than doing just one
    */
    function _pushYieldToken(
        address _underlyingAsset,
        uint256 _expiry,
        address _user,
        uint256 _amount
    ) internal virtual {
        if (_amount == 0) return;
        PendleTokens memory tokens = _getTokens(_underlyingAsset, _expiry);
        uint256 otBalance = tokens.ot.totalSupply();
        uint256 minNYieldAfterPush = block.timestamp < _expiry
            ? _calcUnderlyingToRedeem(_underlyingAsset, otBalance)
            : _calcTotalAfterExpiry(_underlyingAsset, _expiry, otBalance);
        IPendleYieldTokenHolderV2(yieldTokenHolders[_underlyingAsset][_expiry]).pushYieldTokens(
            _user,
            _amount,
            minNYieldAfterPush
        );
    }

    function _getTokens(address _underlyingAsset, uint256 _expiry)
        internal
        view
        virtual
        returns (PendleTokens memory _tokens)
    {
        (_tokens.ot, _tokens.xyt) = data.getPendleYieldTokens(forgeId, _underlyingAsset, _expiry);
    }

    // There shouldn't be any fund in here
    // hence governance is allowed to withdraw anything from here.
    function _allowedToWithdraw(address) internal pure virtual override returns (bool allowed) {
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
    @notice To update the amount of forgeFee (taking into account the compound interest effect)
    @dev To be called whenever the forge collect fees, or before withdrawing the fee
    @param _feeAmount the new fee that this forge just collected
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

    function _calcUnderlyingToRedeem(address, uint256 _amountToRedeem)
        internal
        virtual
        returns (uint256 underlyingToRedeem);

    function _calcAmountToMint(address, uint256 _amountToTokenize)
        internal
        virtual
        returns (uint256 amountToMint);
}
