// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.7.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../periphery/WithdrawableV2.sol";
import "../interfaces/IPendleYieldTokenHolder.sol";
import "../interfaces/IPendleRewardManager.sol";
import "../interfaces/IPendleForge.sol";
import "../interfaces/IPendleYieldToken.sol";

/**
@notice for each Forge deployed, there will be a corresponding PendleRewardManager contract,
    which manages the COMP/StkAAVE rewards accrued in the PendleYieldTokenHolder contracts created by the Forge
    for each yield contract.
@dev the logic of distributing rewards is very similar to that of PendleCompoundMarket & PendleCompoundLiquidityMining
    Any major differences are likely to be bugs
*/
contract PendleRewardManager is IPendleRewardManager, WithdrawableV2, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    bytes32 public immutable override forgeId;
    IPendleForge private forge;
    IERC20 private rewardToken;

    // we only update the rewards for a yieldTokenHolder if it has been >= updateFrequency[underlyingAsset] blocks
    // since the last time rewards was updated for the yieldTokenHolder (lastUpdatedForYieldTokenHolder[underlyingAsset][expiry])
    mapping(address => uint256) updateFrequency;
    mapping(address => mapping(uint256 => uint256)) lastUpdatedForYieldTokenHolder;
    bool public skippingRewards;

    // This MULTIPLIER is to scale the real paramL value up, to preserve precision
    uint256 private constant MULTIPLIER = 1e20;
    IPendleData private data;
    IPendleRouter private router;

    struct RewardData {
        uint256 paramL;
        uint256 lastRewardBalance;
        mapping(address => uint256) lastParamL;
        mapping(address => uint256) dueRewards;
    }

    // rewardData[underlyingAsset][expiry] stores the information related
    // to the rewards stored in the corresponding PendleYieldTokenHolder
    // as well as information needed to calculate rewards for each user (lastParamL)
    mapping(address => mapping(uint256 => RewardData)) private rewardData;

    modifier isValidOT(address _underlyingAsset, uint256 _expiry) {
        require(data.isValidOT(forgeId, _underlyingAsset, _expiry), "INVALID_OT");
        _;
    }

    modifier onlyForge() {
        require(msg.sender == address(forge), "ONLY_FORGE");
        _;
    }

    constructor(address _governanceManager, bytes32 _forgeId) PermissionsV2(_governanceManager) {
        forgeId = _forgeId;
    }

    function initialize(address _forgeAddress) external {
        require(msg.sender == initializer, "FORBIDDEN");
        require(address(_forgeAddress) != address(0), "ZERO_ADDRESS");

        forge = IPendleForge(_forgeAddress);
        require(forge.forgeId() == forgeId, "FORGE_ID_MISMATCH");
        initializer = address(0);
        rewardToken = forge.rewardToken();
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
            uint256 paramL,
            uint256 lastRewardBalance,
            uint256 lastParamL,
            uint256 dueRewards
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
    ) external override onlyGovernance {
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
    function setSkippingRewards(bool _skippingRewards) external override onlyGovernance {
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
        returns (uint256 dueRewards)
    {
        dueRewards = _beforeTransferPendingRewards(_underlyingAsset, _expiry, _user);

        address _yieldTokenHolder = forge.yieldTokenHolders(_underlyingAsset, _expiry);
        if (dueRewards != 0) {
            // The yieldTokenHolder already approved this reward manager contract to spend max uint256
            rewardToken.safeTransferFrom(_yieldTokenHolder, _user, dueRewards);
        }
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
    ) external override onlyForge nonReentrant {
        _updatePendingRewards(_underlyingAsset, _expiry, _user);
    }

    /**
    @notice Manually updateParamL, which is to update the rewards accounting for a particular (underlyingAsset, expiry)
          This transaction can be called by anyone who wants to spend the gas to make sure the rewards from Aave/Compound is claimed and distributed
          to the current timestamp, by-passing the caching mechanism
    */
    function updateParamLManual(address _underlyingAsset, uint256 _expiry)
        external
        override
        nonReentrant
    {
        _updateParamL(_underlyingAsset, _expiry, true);
    }

    /**
    @notice To be called before the pending rewards of any users is redeemed
    */
    function _beforeTransferPendingRewards(
        address _underlyingAsset,
        uint256 _expiry,
        address _user
    ) internal returns (uint256 amountOut) {
        _updatePendingRewards(_underlyingAsset, _expiry, _user);

        RewardData storage rwd = rewardData[_underlyingAsset][_expiry];

        amountOut = rwd.dueRewards[_user];
        rwd.dueRewards[_user] = 0;

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
        uint256 userLastParamL = rwd.lastParamL[_user];
        if (userLastParamL == 0) {
            // ParamL is always >=1, so this user must have gotten OT for the first time,
            // and shouldn't get any rewards
            rwd.lastParamL[_user] = rwd.paramL;
            return;
        }

        if (userLastParamL == rwd.paramL) {
            // - User's lastParamL is the latest param L, dont need to update anything
            // - When skippingRewards is turned on and paramL always stays the same,
            //     this function will terminate here for most users
            //     (except for the ones who have not updated rewards until the current paramL)
            return;
        }

        IPendleYieldToken ot = data.otTokens(forgeId, _underlyingAsset, _expiry);

        uint256 principal = ot.balanceOf(_user);
        uint256 rewardsAmountPerOT = rwd.paramL.sub(userLastParamL);

        uint256 rewardsFromOT = principal.mul(rewardsAmountPerOT).div(MULTIPLIER);

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
        if (rwd.paramL == 0) {
            // paramL always starts from 1, to make sure that if a user's lastParamL is 0,
            // they must be getting OT for the very first time, and we will know it in _updatePendingRewards()
            rwd.paramL = 1;
        }

        // First, claim any pending COMP/StkAAVE rewards to the YieldTokenHolder
        IPendleYieldTokenHolder(yieldTokenHolder).redeemRewards();

        IPendleYieldToken ot = data.otTokens(forgeId, _underlyingAsset, _expiry);

        uint256 currentRewardBalance = rewardToken.balanceOf(yieldTokenHolder);

        // * firstTerm is always paramL. But we are still doing this way to make it consistent
        // in the way that we calculate interests/rewards, across Market, LiquidityMining and RewardManager
        // * paramR is basically the new amount of rewards that came in since the last time we called _updateParamL
        (uint256 firstTerm, uint256 paramR) =
            _getFirstTermAndParamR(_underlyingAsset, _expiry, currentRewardBalance);

        uint256 totalOT = ot.totalSupply();

        // secondTerm is basically the amount of new rewards per LP
        uint256 secondTerm;
        if (totalOT != 0) {
            secondTerm = paramR.mul(MULTIPLIER).div(totalOT);
        }

        // Update new states
        rwd.paramL = firstTerm.add(secondTerm);
        rwd.lastRewardBalance = currentRewardBalance;
        lastUpdatedForYieldTokenHolder[_underlyingAsset][_expiry] = block.number;
    }

    function _getFirstTermAndParamR(
        address _underlyingAsset,
        uint256 _expiry,
        uint256 currentRewardBalance
    ) internal view returns (uint256 firstTerm, uint256 paramR) {
        RewardData storage rwd = rewardData[_underlyingAsset][_expiry];
        firstTerm = rwd.paramL;
        paramR = currentRewardBalance.sub(rwd.lastRewardBalance);
    }

    // There shouldn't be any fund in here
    // hence governance is allowed to withdraw anything from here.
    function _allowedToWithdraw(address) internal pure override returns (bool allowed) {
        allowed = true;
    }
}
