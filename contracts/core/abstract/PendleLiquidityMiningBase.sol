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

import "../../libraries/FactoryLib.sol";
import "../../libraries/MathLib.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "../../interfaces/IPendleRouter.sol";
import "../../interfaces/IPendleForge.sol";
import "../../interfaces/IPendleAaveForge.sol";
import "../../interfaces/IPendleMarketFactory.sol";
import "../../interfaces/IPendleMarket.sol";
import "../../interfaces/IPendleData.sol";
import "../../interfaces/IPendleLpHolder.sol";
import "../../core/PendleLpHolder.sol";
import "../../interfaces/IPendleLiquidityMining.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../../periphery/Permissions.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
@dev things that must hold in this contract:
 - If an account's stake information is updated (hence lastTimeUserStakeUpdated is changed),
    then his pending rewards are calculated as well
    (and saved in availableRewardsForEpoch[user][epochId])
@dev We define 1 Unit = 1 LP stake in contract 1 second. For example, 20 LP stakes 30 secs will create 600 units for the user
@dev Basically the logic of distributing rewards is very simple: For each epoch, we calculate how many units that each user
has contributed in this epoch. The rewards will be distributed proportionately based on that number
@dev IMPORTANT: All markets with the same triplets of (marketFactoryId,XYT,baseToken) will share the same LiqMining contract
I.e: All the markets using the same LiqMining contract are only different from each other by their expiries
@dev CORE LOGIC: So in a single LiqMining contract:
* the rewards will be distributed among different expiries by ratios set by Governance
* In a single expiry, the reward will be distributed by the ratio of units (explained above)
*/
abstract contract PendleLiquidityMiningBase is
    IPendleLiquidityMining,
    Permissions,
    ReentrancyGuard
{
    using Math for uint256;
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    struct UserExpiries {
        uint256[] expiries;
        mapping(uint256 => bool) hasExpiry;
    }

    struct EpochData {
        // total units for different expiries in this epoch
        mapping(uint256 => uint256) stakeUnitsForExpiry;
        // the last time in this epoch that we updated the stakeUnits for this expiry
        mapping(uint256 => uint256) lastUpdatedForExpiry;
        /* availableRewardsForEpoch[account][epochId] is the amount of PENDLEs the account can withdraw
        at the beginning of epochId*/
        mapping(address => uint256) availableRewardsForUser;
        // number of units an user has contributed in this epoch & expiry
        mapping(address => mapping(uint256 => uint256)) stakeUnitsForUser;
        // the reward setting to use
        uint256 settingId;
        // totalRewards for this epoch
        uint256 totalRewards;
    }

    // For each expiry, we will have one struct
    struct ExpiryData {
        // the last time the units of an user was updated in this expiry
        mapping(address => uint256) lastTimeUserStakeUpdated; // map account => time
        // the last epoch the user claimed rewards. After the rewards an epoch has been claimed, there won't be any
        // additional rewards in that epoch for the user to claim
        mapping(address => uint256) lastEpochClaimed;
        // total amount of LP in this expiry (to use for units calculation)
        uint256 totalStakeLP;
        // lpHolder contract for this expiry
        address lpHolder;
        // the LP balances for each user in this expiry
        mapping(address => uint256) balances;
        // variables for lp interest calculations
        uint256 lastNYield;
        uint256 paramL;
        mapping(address => uint256) lastParamL;
    }

    struct LatestSetting {
        uint256 id;
        uint256 firstEpochToApply;
    }

    IPendleRouter public router;
    IPendleMarketFactory public marketFactory;
    IPendleData public data;
    address public override pendleTokenAddress;
    bytes32 public override forgeId;
    address internal forge;
    bytes32 public override marketFactoryId;

    address public override underlyingAsset;
    address public override baseToken;
    uint256 public override startTime;
    uint256 public override epochDuration;
    uint256 public override numberOfEpochs;
    uint256 public override vestingEpochs;
    bool public funded;

    uint256[] public allExpiries;
    uint256 private constant ALLOCATION_DENOMINATOR = 1_000_000_000;
    uint256 private constant MULTIPLIER = 10**20;

    // allocationSettings[settingId][expiry] = rewards portion of a pool for settingId
    mapping(uint256 => mapping(uint256 => uint256)) public allocationSettings;
    LatestSetting public latestSetting;

    mapping(uint256 => ExpiryData) internal expiryData;
    mapping(uint256 => EpochData) private epochData;
    mapping(address => UserExpiries) private userExpiries;

    modifier isFunded() {
        require(funded, "NOT_FUNDED");
        _;
    }

    constructor(
        address _governance,
        address _pendleTokenAddress,
        address _router,
        bytes32 _marketFactoryId,
        bytes32 _forgeId,
        address _underlyingAsset,
        address _baseToken,
        uint256 _startTime,
        uint256 _epochDuration,
        uint256 _vestingEpochs
    ) Permissions(_governance) {
        require(_startTime > block.timestamp, "START_TIME_OVER");
        require(IERC20(_pendleTokenAddress).totalSupply() > 0, "INVALID_ERC20");
        require(IERC20(_underlyingAsset).totalSupply() > 0, "INVALID_ERC20");
        require(IERC20(_baseToken).totalSupply() > 0, "INVALID_ERC20");
        require(_vestingEpochs > 0, "INVALID_VESTING_EPOCHS");

        pendleTokenAddress = _pendleTokenAddress;
        router = IPendleRouter(_router);
        data = router.data();

        require(
            data.getMarketFactoryAddress(_marketFactoryId) != address(0),
            "INVALID_MARKET_FACTORY_ID"
        );
        require(data.getForgeAddress(_forgeId) != address(0), "INVALID_FORGE_ID");

        marketFactory = IPendleMarketFactory(data.getMarketFactoryAddress(_marketFactoryId));
        forge = data.getForgeAddress(_forgeId);
        marketFactoryId = _marketFactoryId;
        forgeId = _forgeId;
        underlyingAsset = _underlyingAsset;
        baseToken = _baseToken;
        startTime = _startTime;
        epochDuration = _epochDuration;
        vestingEpochs = _vestingEpochs;
    }

    /**
     * @notice fund new epochs
     * @dev Once the last epoch is over, the program is permanently override
     * @dev the settings must be set before epochs can be funded
        => if funded=true, means that epochs have been funded & have already has valid allocation settings
     * conditions:
        * Must only be called by governance
     */
    function fund(uint256[] memory _rewards) external override onlyGovernance {
        // Can only be fund if there is already a setting
        require(latestSetting.id > 0, "NO_ALLOC_SETTING");
        // Once the program is over, cannot fund
        require(_getCurrentEpochId() <= numberOfEpochs, "LAST_EPOCH_OVER");

        uint256 nNewEpochs = _rewards.length;
        uint256 totalFunded;
        // all the funding will be used for new epochs
        for (uint256 i = 0; i < nNewEpochs; i++) {
            totalFunded = totalFunded.add(_rewards[i]);
            epochData[numberOfEpochs + i + 1].totalRewards = _rewards[i];
        }

        require(totalFunded > 0, "ZERO_FUND");
        funded = true;
        numberOfEpochs = numberOfEpochs.add(nNewEpochs);
        IERC20(pendleTokenAddress).safeTransferFrom(msg.sender, address(this), totalFunded);
    }

    /**
    @notice top up rewards for any funded future epochs (but not to create new epochs)
    * conditions:
        * Must only be called by governance
        * The contract must have been funded already
    */
    function topUpRewards(uint256[] memory _epochIds, uint256[] memory _rewards)
        external
        override
        onlyGovernance
        isFunded
    {
        require(latestSetting.id > 0, "NO_ALLOC_SETTING");
        require(_epochIds.length == _rewards.length, "INVALID_ARRAYS");

        uint256 curEpoch = _getCurrentEpochId();
        uint256 endEpoch = numberOfEpochs;
        uint256 totalTopUp;

        for (uint256 i = 0; i < _epochIds.length; i++) {
            require(curEpoch < _epochIds[i] && _epochIds[i] <= endEpoch, "INVALID_EPOCH_ID");
            totalTopUp = totalTopUp.add(_rewards[i]);
            epochData[_epochIds[i]].totalRewards = epochData[_epochIds[i]].totalRewards.add(
                _rewards[i]
            );
        }

        require(totalTopUp > 0, "ZERO_FUND");
        IERC20(pendleTokenAddress).safeTransferFrom(msg.sender, address(this), totalTopUp);
    }

    /**
    @notice set a new allocation setting, which will be applied from the next epoch onwards
    @dev  all the epochData from latestSetting.firstEpochToApply+1 to current epoch will follow the previous
    allocation setting
    @dev We must set the very first allocation setting before the start of epoch 1,
            otherwise epoch 1 will not have any allocation setting!
        In that case, we will not be able to set any allocation and hence its not possible to
            fund the contract as well
        => We should just throw this contract away, and funds are SAFU!
    @dev the length of _expiries array is expected to be small, 2 or 3
    @dev it's intentional that we don't check the existence of expiries
     */
    function setAllocationSetting(
        uint256[] calldata _expiries,
        uint256[] calldata _allocationNumerators
    ) external onlyGovernance {
        require(_expiries.length == _allocationNumerators.length, "INVALID_ALLOCATION");
        if (latestSetting.id == 0) {
            require(block.timestamp < startTime, "LATE_FIRST_ALLOCATION");
        }

        uint256 curEpoch = _getCurrentEpochId();
        // set the settingId for past epochs
        for (uint256 i = latestSetting.firstEpochToApply; i <= curEpoch; i++) {
            epochData[i].settingId = latestSetting.id;
        }

        // create a new setting that will be applied from the next epoch onwards
        latestSetting.firstEpochToApply = curEpoch + 1;
        latestSetting.id++;

        uint256 sumAllocationNumerators;
        for (uint256 _i = 0; _i < _expiries.length; _i++) {
            allocationSettings[latestSetting.id][_expiries[_i]] = _allocationNumerators[_i];
            sumAllocationNumerators = sumAllocationNumerators.add(_allocationNumerators[_i]);
        }
        require(sumAllocationNumerators == ALLOCATION_DENOMINATOR, "INVALID_ALLOCATION");
    }

    /**
     * @notice Use to stake their LPs to a specific expiry
     * @param newLpHoldingContractAddress will be /= 0 in case a new lpHolder contract is deployed
    Conditions:
        * only be called if the contract has been funded
        * must have Reentrancy protection
        * only be called if 0 < current epoch <= numberOfEpochs
    Note:
        * Even if an expiry currently has zero rewards allocated to it, we still allow users to stake their
        LP in
     */
    function stake(uint256 expiry, uint256 amount)
        external
        override
        isFunded
        nonReentrant
        returns (address newLpHoldingContractAddress)
    {
        ExpiryData storage exd = expiryData[expiry];
        uint256 curEpoch = _getCurrentEpochId();
        require(curEpoch > 0, "NOT_STARTED");
        require(curEpoch <= numberOfEpochs, "INCENTIVES_PERIOD_OVER");

        address xyt = address(data.xytTokens(forgeId, underlyingAsset, expiry));
        address marketAddress = data.getMarket(marketFactoryId, xyt, baseToken);
        require(xyt != address(0), "XYT_NOT_FOUND");
        require(marketAddress != address(0), "MARKET_NOT_FOUND");

        // there is no lpHolder for this expiry yet, we will create one
        if (exd.lpHolder == address(0)) {
            newLpHoldingContractAddress = _addNewExpiry(expiry, xyt, marketAddress);
        }

        if (!userExpiries[msg.sender].hasExpiry[expiry]) {
            userExpiries[msg.sender].expiries.push(expiry);
            userExpiries[msg.sender].hasExpiry[expiry] = true;
        }

        _pullLpToken(marketAddress, expiry, amount);
    }

    /**
     * @notice Use to withdraw their LP from a specific expiry
    Conditions:
        * only be called if the contract has been funded.
        * must have Reentrancy protection
        * only be called if 0 < current epoch (always can withdraw)
     */
    function withdraw(uint256 expiry, uint256 amount) external override nonReentrant isFunded {
        uint256 curEpoch = _getCurrentEpochId();
        require(curEpoch > 0, "NOT_STARTED");

        ExpiryData storage exd = expiryData[expiry];
        require(exd.balances[msg.sender] >= amount, "INSUFFICIENT_BALANCE");

        _pushLpToken(expiry, amount);
    }

    /**
     * @notice use to claim PENDLE rewards
    Conditions:
        * only be called if the contract has been funded.
        * must have Reentrancy protection
        * only be called if 0 < current epoch (always can withdraw)
        * Anyone can call it (and claim it for any other user)
     */
    function claimRewards(uint256 expiry, address account)
        external
        override
        isFunded
        nonReentrant
        returns (uint256 rewards)
    {
        uint256 curEpoch = _getCurrentEpochId();
        require(curEpoch > 0, "NOT_STARTED");

        // _settlePendingRewards is the function that really push the rewards out
        rewards = _settlePendingRewards(expiry, account);
    }

    /**
     * @notice use to claim lpInterest
    Conditions:
        * must have Reentrancy protection
        * Anyone can call it (and claim it for any other user)
     */
    function claimLpInterests(uint256 expiry, address account)
        external
        override
        nonReentrant
        returns (uint256 interests)
    {
        // _settleLpInterests is the function that really push the interest out
        interests = _settleLpInterests(expiry, account);
    }

    function totalRewardsForEpoch(uint256 epochId)
        external
        view
        override
        returns (uint256 rewards)
    {
        rewards = epochData[epochId].totalRewards;
    }

    function readUserExpiries(address _account)
        external
        view
        override
        returns (uint256[] memory _expiries)
    {
        _expiries = userExpiries[_account].expiries;
    }

    function balances(uint256 expiry, address user) external view override returns (uint256) {
        return expiryData[expiry].balances[user];
    }

    function lpHolderForExpiry(uint256 expiry) external view override returns (address) {
        return expiryData[expiry].lpHolder;
    }

    /**
    @notice update the following stake data for the current epoch:
        - epochData[_curEpoch].stakeUnitsForExpiry
        - epochData[_curEpoch].lastUpdatedForExpiry
    @dev If this is the very first transaction involving this expiry, then need to update for the
    previous epoch as well. If the previous didn't have any transactions at all, (and hence was not
    updated at all), we need to update it and check the previous previous ones, and so on..
    @dev must be called right before every _settlePendingRewards()
    @dev this is the only function that updates lastTimeUserStakeUpdated & stakeUnitsForExpiry
    @dev other functions must make sure that totalStakeLPForExpiry could be assumed
        to stay exactly the same since lastTimeUserStakeUpdated until now;
    @dev to be called only by _settlePendingRewards
     */
    function _updateStakeDataForExpiry(uint256 expiry) internal {
        uint256 _curEpoch = _getCurrentEpochId();

        // loop through all epochData in descending order
        for (uint256 i = Math.min(_curEpoch, numberOfEpochs); i > 0; i--) {
            uint256 epochEndTime = _endTimeOfEpoch(i);
            uint256 lastUpdatedForEpoch = epochData[i].lastUpdatedForExpiry[expiry];

            if (lastUpdatedForEpoch == epochEndTime) {
                break; // its already updated until this epoch, our job here is done
            }

            // if the epoch hasn't been fully updated yet, we will update it
            // just add the amount of units contributed by users since lastUpdatedForEpoch -> now
            // by calling _calcUnitsStakeInEpoch
            epochData[i].stakeUnitsForExpiry[expiry] = epochData[i].stakeUnitsForExpiry[expiry]
                .add(
                _calcUnitsStakeInEpoch(expiryData[expiry].totalStakeLP, lastUpdatedForEpoch, i)
            );
            // If the epoch has ended, lastUpdated = epochEndTime
            // If not yet, lastUpdated = block.timestamp (aka now)
            epochData[i].lastUpdatedForExpiry[expiry] = Math.min(block.timestamp, epochEndTime);
        }
    }

    /**
    @notice Transfer any pending rewards to users
        The rewards are calculated since the last time rewards was calculated for him,
        I.e. Since the last time his stake was "updated"
        I.e. Since lastTimeUserStakeUpdated[account]
    @dev The user's stake since lastTimeUserStakeUpdated[user] until now = balances[user][expiry]
    @dev After this function, the following should be updated correctly up to this point:
            - availableRewardsForEpoch[account][all epochData]
            - epochData[all epochData].stakeUnitsForUser
    @dev Must be called before the amount of LP tokens changes or when claim rewards
    Note: Bear in mind that every single time the amount of LP changes (for the entire market, for any user),
    this function must & will be called
     */
    function _settlePendingRewards(uint256 expiry, address account)
        internal
        returns (uint256 _rewardsWithdrawableNow)
    {
        _updateStakeDataForExpiry(expiry);
        ExpiryData storage exd = expiryData[expiry];

        // account has not staked this LP_expiry before, no need to do anything
        if (exd.lastTimeUserStakeUpdated[account] == 0) {
            exd.lastTimeUserStakeUpdated[account] = block.timestamp;
            return 0;
        }

        uint256 _curEpoch = _getCurrentEpochId();
        uint256 _endEpoch = Math.min(numberOfEpochs, _curEpoch);

        // if _curEpoch<=numberOfEpochs
        // => the endEpoch hasn't ended yet (since endEpoch=curEpoch)
        bool _isEndEpochOver = (_curEpoch > numberOfEpochs);

        uint256 _startEpoch = _epochOfTimestamp(exd.lastTimeUserStakeUpdated[account]);

        /* Go through all epochs until now
        to update stakeUnitsForUser and availableRewardsForEpoch
        */
        for (uint256 epochId = _startEpoch; epochId <= _endEpoch; epochId++) {
            if (epochData[epochId].stakeUnitsForExpiry[expiry] == 0 && exd.totalStakeLP == 0) {
                /* in the extreme extreme case of zero staked LPs for this expiry even now,
                    => nothing to do from this epoch onwards */
                break;
            }

            // updating stakeUnits for users. The logic of this is similar to that of _updateStakeDataForExpiry
            // Please refer to _updateStakeDataForExpiry for more details
            epochData[epochId].stakeUnitsForUser[account][expiry] = epochData[epochId]
                .stakeUnitsForUser[account][expiry]
                .add(
                _calcUnitsStakeInEpoch(
                    exd.balances[account],
                    exd.lastTimeUserStakeUpdated[account],
                    epochId
                )
            );

            // all epochs prior to the endEpoch must have ended
            // if epochId == _endEpoch, we must check if the epoch has ended or not
            if (epochId == _endEpoch && !_isEndEpochOver) {
                break;
            }

            // Now this epoch has ended, users can claim rewards now

            // @Long: this can never happen because:
            // * if exd.totalStakeLP==0 => will break by conditions above
            // * else: it can only happen if startOfEpoch == now, but in this case it means that
            //      the epoch is not over yet, so !_isEndEpochOver == false
            require(epochData[epochId].stakeUnitsForExpiry[expiry] != 0, "INTERNAL_ERROR");

            // calc the amount of rewards the user is eligible to receive from this epoch
            uint256 rewardsPerVestingEpoch =
                _calcAmountRewardsForUserInEpoch(expiry, account, epochId);

            // Now we distribute this rewards over the vestingEpochs starting from epochId + 1
            // to epochId + vestingEpochs
            for (uint256 i = epochId + 1; i <= epochId + vestingEpochs; i++) {
                epochData[i].availableRewardsForUser[account] = epochData[i]
                    .availableRewardsForUser[account]
                    .add(rewardsPerVestingEpoch);
            }
        }

        exd.lastTimeUserStakeUpdated[account] = block.timestamp;
        // push the rewards out
        _rewardsWithdrawableNow = _pushRewardsWithdrawableNow(expiry, account);
    }

    /**
     * @notice use to push all the claimable rewards for the user in this expiry
     * @dev will only be called by _settlePendingRewards
     */
    function _pushRewardsWithdrawableNow(uint256 _expiry, address _account)
        internal
        returns (uint256 rewardsWithdrawableNow)
    {
        uint256 _lastEpoch = Math.min(_getCurrentEpochId(), numberOfEpochs);
        // for loop start from lastEpochClaimed since there is possibility that the user receives
        // more rewards in that epoch (if last time he claimed the epoch hadn't ended yet)
        for (uint256 i = expiryData[_expiry].lastEpochClaimed[_account]; i <= _lastEpoch; i++) {
            if (epochData[i].availableRewardsForUser[_account] > 0) {
                rewardsWithdrawableNow = rewardsWithdrawableNow.add(
                    epochData[i].availableRewardsForUser[_account]
                );
                epochData[i].availableRewardsForUser[_account] = 0;
            }
        }

        expiryData[_expiry].lastEpochClaimed[_account] = _lastEpoch;
        if (rewardsWithdrawableNow != 0) {
            IERC20(pendleTokenAddress).safeTransfer(_account, rewardsWithdrawableNow);
        }
    }

    // calc the amount of rewards the user is eligible to receive from this epoch
    // but we will return the amount per vestingEpoch instead
    function _calcAmountRewardsForUserInEpoch(
        uint256 expiry,
        address account,
        uint256 epochId
    ) internal view returns (uint256 rewardsPerVestingEpoch) {
        uint256 stakeUnitsForUser = epochData[epochId].stakeUnitsForUser[account][expiry];

        uint256 settingId =
            epochId >= latestSetting.firstEpochToApply
                ? latestSetting.id
                : epochData[epochId].settingId;

        uint256 rewardsForThisExpiry =
            epochData[epochId].totalRewards.mul(allocationSettings[settingId][expiry]).div(
                ALLOCATION_DENOMINATOR
            );

        rewardsPerVestingEpoch = rewardsForThisExpiry
            .mul(stakeUnitsForUser)
            .div(epochData[epochId].stakeUnitsForExpiry[expiry])
            .div(vestingEpochs);
    }

    /**
     * @notice returns the stakeUnits in the _epochId(th) epoch of an user if he stake from _startTime to now
     * @dev to calculate durationStakeThisEpoch:
     *   user will stake from _startTime -> _endTime, while the epoch last from _startTimeOfEpoch -> _endTimeOfEpoch
     *   => the stakeDuration of user will be min(_endTime,_endTimeOfEpoch) - max(_startTime,_startTimeOfEpoch)
     */
    function _calcUnitsStakeInEpoch(
        uint256 lpAmount,
        uint256 _startTime,
        uint256 _epochId
    ) internal view returns (uint256 stakeUnitsForUser) {
        uint256 _endTime = block.timestamp;

        uint256 _l = Math.max(_startTime, _startTimeOfEpoch(_epochId));
        uint256 _r = Math.min(_endTime, _endTimeOfEpoch(_epochId));
        uint256 durationStakeThisEpoch = (_l >= _r ? 0 : _r - _l);

        return lpAmount.mul(durationStakeThisEpoch);
    }

    function _pullLpToken(
        address marketAddress,
        uint256 expiry,
        uint256 amount
    ) internal {
        _settlePendingRewards(expiry, msg.sender);
        _settleLpInterests(expiry, msg.sender);

        // transferring LP in must happens before totalStakeLPForExpiry and balances are updated
        IERC20(marketAddress).safeTransferFrom(msg.sender, expiryData[expiry].lpHolder, amount);

        ExpiryData storage exd = expiryData[expiry];
        exd.balances[msg.sender] = exd.balances[msg.sender].add(amount);
        exd.totalStakeLP = exd.totalStakeLP.add(amount);
    }

    function _pushLpToken(uint256 expiry, uint256 amount) internal {
        _settlePendingRewards(expiry, msg.sender);
        _settleLpInterests(expiry, msg.sender);

        // sendLp must happens before totalStakeLPForExpiry and balances are updated
        IPendleLpHolder(expiryData[expiry].lpHolder).sendLp(msg.sender, amount);

        ExpiryData storage exd = expiryData[expiry];
        exd.balances[msg.sender] = exd.balances[msg.sender].sub(amount);
        exd.totalStakeLP = exd.totalStakeLP.sub(amount);
    }

    /**
     * @dev even if exd.balances[account]==0, this function must still be called
     */
    function _settleLpInterests(uint256 expiry, address account)
        internal
        returns (uint256 dueInterests)
    {
        ExpiryData storage exd = expiryData[expiry];

        if (account == address(exd.lpHolder)) return 0;

        _updateParamL(expiry);

        uint256 interestValuePerLP = _getInterestValuePerLP(expiry, account);
        if (interestValuePerLP == 0) return 0;

        dueInterests = exd.balances[account].mul(interestValuePerLP).div(MULTIPLIER);
        if (dueInterests == 0) return 0;

        exd.lastNYield = exd.lastNYield.sub(dueInterests);
        IPendleLpHolder(exd.lpHolder).sendInterests(account, dueInterests);
    }

    function checkNeedUpdateParamL(uint256 expiry) internal returns (bool) {
        if (expiryData[expiry].totalStakeLP == 0) {
            return false;
        }
        if (_getIncomeIndexIncreaseRate(expiry) > data.interestUpdateRateDeltaForMarket()) {
            return true;
        }
        return false;
    }

    /**
     * @dev all LP interests related functions are almost identical to markets' functions
     */
    function _updateParamL(uint256 expiry) internal {
        ExpiryData storage exd = expiryData[expiry];
        require(exd.lpHolder != address(0), "INVALID_EXPIRY");

        if (!checkNeedUpdateParamL(expiry)) {
            return;
        }

        IPendleLpHolder(exd.lpHolder).claimLpInterests();

        IERC20 underlyingYieldToken =
            IERC20(
                IPendleYieldToken(data.xytTokens(forgeId, underlyingAsset, expiry))
                    .underlyingYieldToken()
            );

        uint256 currentNYield = underlyingYieldToken.balanceOf(exd.lpHolder);
        (uint256 firstTerm, uint256 paramR) = _getFirstTermAndParamR(expiry, currentNYield);

        // exd.totalStakeLP has been checked to be != 0
        uint256 secondTerm = paramR.mul(MULTIPLIER).div(exd.totalStakeLP);

        // Update new states
        exd.paramL = firstTerm.add(secondTerm);
        exd.lastNYield = currentNYield;
    }

    function _addNewExpiry(
        uint256 expiry,
        address xyt,
        address marketAddress
    ) internal returns (address newLpHoldingContractAddress) {
        allExpiries.push(expiry);
        address underlyingYieldToken = IPendleYieldToken(xyt).underlyingYieldToken();
        newLpHoldingContractAddress = Factory.createContract(
            type(PendleLpHolder).creationCode,
            abi.encodePacked(marketAddress, marketFactory.router(), underlyingYieldToken),
            abi.encode(marketAddress, marketFactory.router(), underlyingYieldToken)
        );
        expiryData[expiry].lpHolder = newLpHoldingContractAddress;
        _afterAddingNewExpiry(expiry);
    }

    // 1-indexed
    function _getCurrentEpochId() internal view returns (uint256) {
        return _epochOfTimestamp(block.timestamp);
    }

    function _epochOfTimestamp(uint256 t) internal view returns (uint256) {
        if (t < startTime) return 0;
        return t.sub(startTime).div(epochDuration).add(1);
    }

    function _startTimeOfEpoch(uint256 t) internal view returns (uint256) {
        // epoch id starting from 1
        return startTime + (t - 1) * epochDuration;
    }

    function _endTimeOfEpoch(uint256 t) internal view returns (uint256) {
        // epoch id starting from 1
        return startTime + (t) * epochDuration;
    }

    function _getInterestValuePerLP(uint256 expiry, address account)
        internal
        virtual
        returns (uint256 interestValuePerLP);

    function _getFirstTermAndParamR(uint256 expiry, uint256 currentNYield)
        internal
        virtual
        returns (uint256 firstTerm, uint256 paramR);

    function _afterAddingNewExpiry(uint256 expiry) internal virtual;

    function _getIncomeIndexIncreaseRate(uint256 expiry)
        internal
        virtual
        returns (uint256 increaseRate);
}
