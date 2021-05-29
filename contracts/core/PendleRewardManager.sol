// SPDX-License-Identifier: MIT
/*
 * MIT License
 * ===========
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 */
pragma solidity 0.7.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
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
    using SafeMath for uint256;

    bytes32 public immutable override forgeId;
    IPendleForge private forge;
    IERC20 private rewardToken;
    bool public override skippingRewards;

    // we only update the rewards for a yieldTokenHolder if it has been >= updateFrequency[underlyingAsset] blocks
    // since the last time rewards was updated for the yieldTokenHolder (lastUpdatedForYieldHolder[underlyingAsset][expiry])
    mapping(address => uint256) updateFrequency;
    mapping(address => mapping(uint256 => uint256)) lastUpdatedForYieldHolder;

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
            require(
                forge.getYieldBearingToken(underlyingAssets[i]) != address(0),
                "INVALID_UNDERLYING_ASSET"
            );
            updateFrequency[underlyingAssets[i]] = frequencies[i];
        }
        emit UpdateFrequencySet(underlyingAssets, frequencies);
    }

    /**
    Use:
        To skip accounting for rewards altogether, to be set when the incentive programs stop
    Conditions:
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
            rewardToken.transferFrom(_yieldTokenHolder, _user, dueRewards);
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
        if (!_checkNeedUpdateRewards(_underlyingAsset, _expiry)) return;
        address _yieldTokenHolder = forge.yieldTokenHolders(_underlyingAsset, _expiry);
        _updateParamL(_underlyingAsset, _expiry, _yieldTokenHolder);
        lastUpdatedForYieldHolder[_underlyingAsset][_expiry] = block.number;

        RewardData storage rwd = rewardData[_underlyingAsset][_expiry];

        if (rwd.lastParamL[_user] == 0) {
            // ParamL is always >=1, so this user must have gotten OT for the first time,
            // and shouldn't get any rewards
            rwd.lastParamL[_user] = rwd.paramL;
            return;
        }

        IPendleYieldToken ot = data.otTokens(forgeId, _underlyingAsset, _expiry);

        uint256 principal = ot.balanceOf(_user);
        uint256 rewardsAmountPerOT = rwd.paramL.sub(rwd.lastParamL[_user]);

        uint256 rewardsFromOT = principal.mul(rewardsAmountPerOT).div(MULTIPLIER);

        rwd.dueRewards[_user] = rwd.dueRewards[_user].add(rewardsFromOT);
        rwd.lastParamL[_user] = rwd.paramL;
    }

    function _checkNeedUpdateRewards(address _underlyingAsset, uint256 _expiry)
        internal
        view
        returns (bool needUpdate)
    {
        if (skippingRewards) return false;
        needUpdate =
            block.number - lastUpdatedForYieldHolder[_underlyingAsset][_expiry] >=
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
        address yieldTokenHolder
    ) internal {
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
