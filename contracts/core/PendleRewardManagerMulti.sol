// solhint-disable ordering
// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.7.6;
pragma abicoder v2;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../periphery/WithdrawableV2.sol";
import "../interfaces/IPendleYieldTokenHolderV2.sol";
import "../interfaces/IPendleForgeV2.sol";
import "../interfaces/IPendleYieldToken.sol";
import "../interfaces/IPendleRewardManagerMulti.sol";
import "../interfaces/IUniswapV2Pair.sol";
import "../libraries/OTPoolsLib.sol";

/**
@dev this contract is mostly the same to PendleRewardManager
*/
contract PendleRewardManagerMulti is IPendleRewardManagerMulti, WithdrawableV2, ReentrancyGuard {
    struct RewardData {
        TrioUints paramL;
        TrioUints lastRewardBalance;
        mapping(address => TrioUints) lastParamL;
        mapping(address => TrioUints) dueRewards;
    }

    using SafeMath for uint256;
    using TrioTokensLib for TrioTokens;
    using TrioTokensLib for TrioUints;

    bytes32 public immutable forgeId;
    IPendleForgeV2 public forge;

    // we only update the rewards for a yieldTokenHolder if it has been >= updateFrequency[underlyingAsset] blocks
    // since the last time rewards was updated for the yieldTokenHolder (lastUpdatedForYieldTokenHolder[underlyingAsset][expiry])
    mapping(address => uint256) public updateFrequency;
    mapping(address => mapping(uint256 => uint256)) public lastUpdatedForYieldTokenHolder;
    bool public skippingRewards;

    // This MULTIPLIER is to scale the real paramL value up, to preserve precision
    uint256 public constant MULTIPLIER = 1e20;
    IPendleData public data;
    IPendleRouter public router;

    OTPoolsCheckData public otPoolCheckData;

    // rewardData[underlyingAsset][expiry] stores the information related
    // to the rewards stored in the corresponding PendleYieldTokenHolder
    // as well as information needed to calculate rewards for each user (lastParamL)
    mapping(address => mapping(uint256 => RewardData)) public rewardData;
    mapping(address => TrioTokens) public rewardTokensForAsset;

    modifier isValidOT(address _underlyingAsset, uint256 _expiry) {
        require(data.isValidOT(forgeId, _underlyingAsset, _expiry), "INVALID_OT");
        _;
    }

    modifier onlyForge() {
        require(msg.sender == address(forge), "ONLY_FORGE");
        _;
    }

    constructor(
        address _governanceManager,
        bytes32 _forgeId,
        OTPoolsCheckData memory _otPoolCheckData
    ) PermissionsV2(_governanceManager) {
        forgeId = _forgeId;
        otPoolCheckData = _otPoolCheckData;
    }

    function initialize(address _forgeAddress) external {
        require(msg.sender == initializer, "FORBIDDEN");
        require(address(_forgeAddress) != address(0), "ZERO_ADDRESS");

        forge = IPendleForgeV2(_forgeAddress);
        require(forge.forgeId() == forgeId, "FORGE_ID_MISMATCH");
        initializer = address(0);
        data = forge.data();
        router = forge.router();
    }

    function readRewardData(
        address _underlyingAsset,
        uint256 _expiry,
        address user
    )
        external
        view
        returns (
            TrioUints memory paramL,
            TrioUints memory lastRewardBalance,
            TrioUints memory lastParamL,
            TrioUints memory dueRewards
        )
    {
        RewardData storage rwd = rewardData[_underlyingAsset][_expiry];
        paramL = rwd.paramL;
        lastRewardBalance = rwd.lastRewardBalance;
        lastParamL = rwd.lastParamL[user];
        dueRewards = rwd.dueRewards[user];
    }

    /**
    Use:
        To set how often rewards should be updated for yieldTokenHolders of an underlyingAsset
    Conditions:
        * The underlyingAsset must already exist in the forge
        * Must be called by governance
    */
    function setUpdateFrequency(
        address[] calldata underlyingAssets,
        uint256[] calldata frequencies
    ) external onlyGovernance {
        require(underlyingAssets.length == frequencies.length, "ARRAY_LENGTH_MISMATCH");
        for (uint256 i = 0; i < underlyingAssets.length; i++) {
            // make sure the underlyingAsset exists in the forge
            // since this call will revert otherwise
            forge.getYieldBearingToken(underlyingAssets[i]);
            updateFrequency[underlyingAssets[i]] = frequencies[i];
        }
        emit UpdateFrequencySet(underlyingAssets, frequencies);
    }

    /**
    Use:
        To set how often rewards should be updated for yieldTokenHolders of an underlyingAsset
    Conditions:
        * The underlyingAsset must already exist in the forge
        * Must be called by governance
    */
    function setSkippingRewards(bool _skippingRewards) external onlyGovernance {
        skippingRewards = _skippingRewards;
        emit SkippingRewardsSet(_skippingRewards);
    }

    /**
    Use:
        To claim the COMP/StkAAVE for any OT holder.
        Newly accrued rewards are equally accrued to all OT holders in the process.
    Conditions:
        * Can be called by anyone, to claim for anyone
    INVARIANTs:
        * this function must be called before any action that changes the OT balance of user
          * To ensure this, we call this function in the _beforeTokenTransfer hook of the OT token contract (indirectly through the forge)
    */
    function redeemRewards(
        address _underlyingAsset,
        uint256 _expiry,
        address _user
    )
        external
        override
        isValidOT(_underlyingAsset, _expiry)
        nonReentrant
        returns (TrioUints memory dueRewards)
    {
        dueRewards = _beforeTransferPendingRewards(_underlyingAsset, _expiry, _user);

        address _yieldTokenHolder = forge.yieldTokenHolders(_underlyingAsset, _expiry);
        address to = OTPoolsLib.isSushiKyberPool(_user, otPoolCheckData) ? _governance() : _user;

        rewardTokensForAsset[_underlyingAsset].safeTransferFrom(_yieldTokenHolder, to, dueRewards);

        emit RedeemRewards(_user, dueRewards);
    }

    /**
    @notice Update the pending rewards for an user
    @dev This must be called before any transfer / mint/ burn action of OT
        (and this has been implemented in the beforeTokenTransfer of the PendleOwnershipToken)
    Conditions:
        * Can only be called by forge
    */
    function updatePendingRewards(
        address _underlyingAsset,
        uint256 _expiry,
        address _user
    ) external onlyForge nonReentrant {
        _updatePendingRewards(_underlyingAsset, _expiry, _user);
    }

    /**
    @notice Manually updateParamL, which is to update the rewards accounting for a particular (underlyingAsset, expiry)
          This transaction can be called by anyone who wants to spend the gas to make sure the rewards from Aave/Compound is claimed and distributed
          to the current timestamp, by-passing the caching mechanism
    */
    function updateParamLManual(address _underlyingAsset, uint256 _expiry) external nonReentrant {
        _updateParamL(_underlyingAsset, _expiry, true);
    }

    function registerNewUnderlyingAsset(address _underlyingAsset, TrioTokens memory _rewardTokens)
        external
        override
        onlyForge
        nonReentrant
    {
        require(rewardTokensForAsset[_underlyingAsset].allZero(), "ASSET_WAS_REGISTERED");
        _rewardTokens.verify();
        rewardTokensForAsset[_underlyingAsset] = _rewardTokens;
    }

    function readRewardTokensForAsset(address _underlyingAsset)
        external
        view
        override
        returns (TrioTokens memory tokens)
    {
        tokens = rewardTokensForAsset[_underlyingAsset];
    }

    /**
    @notice To be called before the pending rewards of any users is redeemed
    */
    function _beforeTransferPendingRewards(
        address _underlyingAsset,
        uint256 _expiry,
        address _user
    ) internal returns (TrioUints memory amountOut) {
        _updatePendingRewards(_underlyingAsset, _expiry, _user);

        RewardData storage rwd = rewardData[_underlyingAsset][_expiry];

        amountOut = rwd.dueRewards[_user];
        rwd.dueRewards[_user] = TrioUints(0, 0, 0);

        rwd.lastRewardBalance = rwd.lastRewardBalance.sub(amountOut);
        emit DueRewardsSettled(forgeId, _underlyingAsset, _expiry, amountOut, _user);
    }

    /**
    * Very similar to updateLpInterests in PendleCompoundLiquidityMining. Any major differences are likely to be bugs
        Please refer to it for more details
    */
    function _updatePendingRewards(
        address _underlyingAsset,
        uint256 _expiry,
        address _user
    ) internal {
        // - When skippingRewards is set, _updateParamL() will not update anything (implemented in _checkNeedUpdateParamL)
        // - We will still need to update the rewards for the user no matter what, because their last transaction might be
        //    before skippingRewards is turned on
        _updateParamL(_underlyingAsset, _expiry, false);

        RewardData storage rwd = rewardData[_underlyingAsset][_expiry];
        TrioUints memory userLastParamL = rwd.lastParamL[_user];

        if (userLastParamL.allZero()) {
            // ParamL is always >=1, so this user must have gotten OT for the first time,
            // and shouldn't get any rewards
            rwd.lastParamL[_user] = rwd.paramL;
            return;
        }

        if (userLastParamL.eq(rwd.paramL)) {
            // - User's lastParamL is the latest param L, dont need to update anything
            // - When skippingRewards is turned on and paramL always stays the same,
            //     this function will terminate here for most users
            //     (except for the ones who have not updated rewards until the current paramL)
            return;
        }

        IPendleYieldToken ot = data.otTokens(forgeId, _underlyingAsset, _expiry);

        uint256 principal = ot.balanceOf(_user);
        TrioUints memory rewardsAmountPerOT = rwd.paramL.sub(userLastParamL);

        TrioUints memory rewardsFromOT = rewardsAmountPerOT.mul(principal).div(MULTIPLIER);
        rwd.dueRewards[_user] = rwd.dueRewards[_user].add(rewardsFromOT);
        rwd.lastParamL[_user] = rwd.paramL;
    }

    // we only need to update param L, if it has been more than updateFrequency[_underlyingAsset] blocks
    function _checkNeedUpdateParamL(
        address _underlyingAsset,
        uint256 _expiry,
        bool _manualUpdate
    ) internal view returns (bool needUpdate) {
        if (skippingRewards) return false;
        if (_manualUpdate) return true; // always update if its a manual update
        needUpdate =
            block.number - lastUpdatedForYieldTokenHolder[_underlyingAsset][_expiry] >=
            updateFrequency[_underlyingAsset];
    }

    /**
    * Very similar to updateLpInterests in PendleCompoundLiquidityMining. Any major differences are likely to be bugs
        Please refer to it for more details
    * This function must be called only by updatePendingRewards
    */
    function _updateParamL(
        address _underlyingAsset,
        uint256 _expiry,
        bool _manualUpdate // if its a manual update called by updateParamLManual(), always update
    ) internal {
        if (!_checkNeedUpdateParamL(_underlyingAsset, _expiry, _manualUpdate)) return;
        address yieldTokenHolder = forge.yieldTokenHolders(_underlyingAsset, _expiry);
        require(yieldTokenHolder != address(0), "INVALID_YIELD_TOKEN_HOLDER");

        RewardData storage rwd = rewardData[_underlyingAsset][_expiry];
        if (rwd.paramL.allZero()) {
            // paramL always starts from 1, to make sure that if a user's lastParamL is 0,
            // they must be getting OT for the very first time, and we will know it in _updatePendingRewards()
            rwd.paramL = TrioUints(1, 1, 1);
        }

        // First, claim any pending COMP/StkAAVE rewards to the YieldTokenHolder
        IPendleYieldTokenHolderV2(yieldTokenHolder).redeemRewards();

        IPendleYieldToken ot = data.otTokens(forgeId, _underlyingAsset, _expiry);

        TrioUints memory currentRewardBal = rewardTokensForAsset[_underlyingAsset].balanceOf(
            yieldTokenHolder
        );

        // * firstTerm is always paramL. But we are still doing this way to make it consistent
        // in the way that we calculate interests/rewards, across Market, LiquidityMining and RewardManager
        // * paramR is basically the new amount of rewards that came in since the last time we called _updateParamL
        (TrioUints memory firstTerm, TrioUints memory paramR) = _getFirstTermAndParamR(
            _underlyingAsset,
            _expiry,
            currentRewardBal
        );

        uint256 totalOT = ot.totalSupply();

        // secondTerm is basically the amount of new rewards per LP
        TrioUints memory secondTerm;
        if (totalOT != 0) {
            secondTerm = paramR.mul(MULTIPLIER).div(totalOT);
        }

        // Update new states
        rwd.paramL = firstTerm.add(secondTerm);
        rwd.lastRewardBalance = currentRewardBal;
        lastUpdatedForYieldTokenHolder[_underlyingAsset][_expiry] = block.number;
    }

    function _getFirstTermAndParamR(
        address _underlyingAsset,
        uint256 _expiry,
        TrioUints memory currentRewardBal
    ) internal view returns (TrioUints memory firstTerm, TrioUints memory paramR) {
        RewardData storage rwd = rewardData[_underlyingAsset][_expiry];
        firstTerm = rwd.paramL;
        paramR = currentRewardBal.sub(rwd.lastRewardBalance);
    }

    // There shouldn't be any fund in here
    // hence governance is allowed to withdraw anything from here.
    function _allowedToWithdraw(address) internal pure override returns (bool allowed) {
        allowed = true;
    }
}
