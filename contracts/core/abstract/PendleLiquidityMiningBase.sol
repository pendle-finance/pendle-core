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
import "../../periphery/Permissions.sol";
import "../../periphery/PendleLiquidityMiningNonReentrant.sol";

/**
    @dev things that must hold in this contract:
     - If an account's stake information is updated (hence lastTimeUserStakeUpdated is changed),
        then his pending rewards are calculated as well
        (and saved in availableRewardsForEpoch[user][epochId])
 */
abstract contract PendleLiquidityMiningBase is
    IPendleLiquidityMining,
    Permissions,
    PendleLiquidityMiningNonReentrant
{
    using Math for uint256;
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    struct UserExpiries {
        uint256[] expiries;
        mapping(uint256 => bool) hasExpiry;
    }

    struct EpochData {
        mapping(uint256 => uint256) totalStakeSecondsForExpiry;
        mapping(uint256 => uint256) lastTimeStakeSecondsUpdatedForExpiry;
        mapping(address => mapping(uint256 => uint256)) userStakeSeconds;
        uint256 allocationSettingId;
        bool calculated;
    }

    struct RewardsCalculation {
        uint256 userStakeSeconds;
        uint256 settingId;
        uint256 rewardsForMarket;
        uint256 rewardsPerVestingEpoch;
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
    mapping(uint256 => uint256) public override rewardsForEpoch;
    uint256 public override numberOfEpochs;
    uint256 public override vestingEpochs;
    bool public funded;

    uint256[] public expiries;
    mapping(uint256 => bool) public hasExpiry;
    uint256 private constant ALLOCATION_DENOMINATOR = 1_000_000_000;
    mapping(uint256 => mapping(uint256 => uint256)) public allocationSettings;
    // allocationSettings[settingId][expiry] = rewards portion of a pool for settingId
    uint256 public currentSettingId;
    uint256 public lastEpochWithSettingId;

    // storage for LP interests stuff
    mapping(uint256 => address) public lpHolderForExpiry;
    mapping(uint256 => uint256) internal paramL;
    mapping(uint256 => mapping(address => uint256)) internal lastParamL;
    mapping(uint256 => uint256) public lastNYield;
    uint256 private constant MULTIPLIER = 10**20;

    // balances[account][expiry] is the amount of LP_expiry that the account has staked
    mapping(address => mapping(uint256 => uint256)) public override balances;
    mapping(address => mapping(uint256 => uint256)) public lastTimeUserStakeUpdated;

    /* availableRewardsForEpoch[account][epochId] is the amount of PENDLEs the account
        can withdraw at the beginning of epochId*/
    mapping(address => mapping(uint256 => uint256)) public availableRewardsForEpoch;

    mapping(uint256 => EpochData) private epochs;
    mapping(uint256 => uint256) public currentTotalStakeForExpiry;
    mapping(address => UserExpiries) private userExpiries;

    modifier isFunded() {
        require(funded, "NOT_FUNDED");
        _;
    }

    constructor(
        address _governance,
        address _pendleTokenAddress,
        address _router, // The router basically identify our Pendle instance.
        bytes32 _marketFactoryId,
        bytes32 _forgeId,
        address _underlyingAsset,
        address _baseToken,
        uint256 _startTime,
        uint256 _epochDuration,
        uint256 _vestingEpochs
    ) Permissions(_governance) PendleLiquidityMiningNonReentrant() {
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

    function readUserExpiries(address _account)
        external
        view
        override
        returns (uint256[] memory _expiries)
    {
        _expiries = userExpiries[_account].expiries;
    }

    // fund a few epoches
    // One the last epoch is over, the program is permanently over and cannot be extended anymore
    function fund(uint256[] memory _rewards) external onlyGovernance {
        require(currentSettingId > 0, "NO_ALLOC_SETTING");
        require(_getCurrentEpochId() <= numberOfEpochs, "LAST_EPOCH_OVER"); // we can only fund more if its still ongoing
        uint256 nNewEpoches = _rewards.length;

        uint256 totalFunded;
        for (uint256 i = 0; i < nNewEpoches; i++) {
            totalFunded = totalFunded.add(_rewards[i]);
            rewardsForEpoch[numberOfEpochs + i + 1] = _rewards[i];
        }

        require(totalFunded > 0, "ZERO_FUND");
        funded = true;
        numberOfEpochs = numberOfEpochs.add(nNewEpoches);
        IERC20(pendleTokenAddress).safeTransferFrom(msg.sender, address(this), totalFunded);
    }

    /**
    @notice set a new allocation setting, which will be applied from the next Epoch onwards
    @dev  all the epochs from lastEpochWithSettingId+1 to current epoch will follow the previous
    allocation setting
    @dev We must set the very first allocation setting before the start of epoch 1,
            otherwise epoch 1 will not have any allocation setting!
        In that case, we will not be able to set any allocation and hence its not possible to
            fund the contract as well
        => We should just throw this contract away, and funds are SAFU!
    @dev the length of _expiries array should be small, 2 or 3
     */
    function setAllocationSetting(
        uint256[] calldata _expiries,
        uint256[] calldata _allocationNominators
    ) external onlyGovernance {
        require(_expiries.length == _allocationNominators.length, "INVALID_ALLOCATION");
        if (currentSettingId == 0) {
            require(block.timestamp < startTime, "LATE_FIRST_ALLOCATION");
        }

        uint256 curEpoch = _getCurrentEpochId();
        for (uint256 i = lastEpochWithSettingId + 1; i <= curEpoch; i++) {
            // save the epochSettingId for the epochs before the current epoch
            epochs[i].allocationSettingId = currentSettingId;
        }
        lastEpochWithSettingId = curEpoch;
        currentSettingId++;

        uint256 sumAllocationNominators;
        for (uint256 _i = 0; _i < _expiries.length; _i++) {
            allocationSettings[currentSettingId][_expiries[_i]] = _allocationNominators[_i];
            sumAllocationNominators = sumAllocationNominators.add(_allocationNominators[_i]);
        }
        require(sumAllocationNominators == ALLOCATION_DENOMINATOR, "INVALID_ALLOCATION");
    }

    function stake(uint256 expiry, uint256 amount)
        external
        override
        isFunded
        nonReentrant
        returns (address newLpHoldingContractAddress)
    {
        uint256 curEpoch = _getCurrentEpochId();
        require(curEpoch > 0, "NOT_STARTED");
        require(curEpoch <= numberOfEpochs, "INCENTIVES_PERIOD_OVER");
        _updateStakeAndRewardsBeforeStakeChange(msg.sender, expiry);

        address xyt = address(data.xytTokens(forgeId, underlyingAsset, expiry));
        address marketAddress = data.getMarket(marketFactoryId, xyt, baseToken);
        require(xyt != address(0), "XYT_NOT_FOUND");
        require(marketAddress != address(0), "MARKET_NOT_FOUND");

        if (!hasExpiry[expiry]) {
            newLpHoldingContractAddress = _addNewExpiry(expiry, xyt, marketAddress);
        }

        if (!userExpiries[msg.sender].hasExpiry[expiry]) {
            userExpiries[msg.sender].expiries.push(expiry);
            userExpiries[msg.sender].hasExpiry[expiry] = true;
        }
        // _pullLpToken must happens before currentTotalStakeForExpiry and balances are updated
        _pullLpToken(marketAddress, expiry, amount);

        balances[msg.sender][expiry] = balances[msg.sender][expiry].add(amount);
        currentTotalStakeForExpiry[expiry] = currentTotalStakeForExpiry[expiry].add(amount);
    }

    function withdraw(uint256 expiry, uint256 amount) external override nonReentrant isFunded {
        uint256 curEpoch = _getCurrentEpochId();
        require(curEpoch > 0, "NOT_STARTED");
        require(balances[msg.sender][expiry] >= amount, "INSUFFICIENT_BALANCE");

        _updateStakeAndRewardsBeforeStakeChange(msg.sender, expiry);
        // _pushLpToken must happens before currentTotalStakeForExpiry and balances are updated
        _pushLpToken(expiry, amount);

        balances[msg.sender][expiry] = balances[msg.sender][expiry].sub(amount);
        currentTotalStakeForExpiry[expiry] = currentTotalStakeForExpiry[expiry].sub(amount);
    }

    function claimRewards() external override nonReentrant returns (uint256[] memory rewards) {
        uint256 curEpoch = _getCurrentEpochId(); //!!! what if currentEpoch > final epoch?
        require(curEpoch > 0, "NOT_STARTED");

        rewards = new uint256[](vestingEpochs);
        for (uint256 i = 0; i < userExpiries[msg.sender].expiries.length; i++) {
            uint256 expiry = userExpiries[msg.sender].expiries[i];
            rewards[0] = _updateStakeAndRewardsBeforeStakeChange(msg.sender, expiry);
        }
        for (uint256 i = 1; i < vestingEpochs; i++) {
            rewards[i] = rewards[i].add(availableRewardsForEpoch[msg.sender][curEpoch.add(i)]);
        }
    }

    function claimLpInterests() external override nonReentrant returns (uint256 interests) {
        for (uint256 i = 0; i < userExpiries[msg.sender].expiries.length; i++) {
            interests = interests.add(
                _settleLpInterests(userExpiries[msg.sender].expiries[i], msg.sender)
            );
        }
    }

    // internal functions

    function _updateStakeAndRewardsBeforeStakeChange(address _account, uint256 _expiry)
        internal
        returns (uint256 _rewardsWithdrawableNow)
    {
        _updateStakeDataForExpiry(_expiry);
        _rewardsWithdrawableNow = _settlePendingRewards(_account, _expiry);
        lastTimeUserStakeUpdated[_account][_expiry] = block.timestamp;
    }

    /**
    @notice update the following stake data for the current epoch:
        - epochs[current epoch].totalStakeSecondsForExpiry
        - epochs[current epoch].lastTimeStakeSecondsUpdatedForExpiry
    @dev If this is the very first transaction involving this expiry, then need to update for the
    previous epoch as well. If the previous didn't have any transactions at all, (and hence was not
    updated at all), we need to update it and check the previous previous ones, and so on..
    @dev must be called right before every _settlePendingRewards()
    @dev this is the only function that updates lastTimeUserStakeUpdated
    @dev other functions must make sure that currentTotalStakeForExpiry could be assumed
        to stay exactly the same since lastTimeUserStakeUpdated until now;
     */
    function _updateStakeDataForExpiry(uint256 expiry) internal {
        uint256 _curEpoch = _getCurrentEpochId();

        // loop through all epochs in descending order
        for (uint256 i = Math.min(_curEpoch, numberOfEpochs); i > 0; i--) {
            uint256 epochEndTime = startTime.add(i.mul(epochDuration));
            uint256 lastUpdatedForEpoch = epochs[i].lastTimeStakeSecondsUpdatedForExpiry[expiry];

            if (lastUpdatedForEpoch == epochEndTime) {
                break; // its already updated until this epoch, our job here is done
            }

            if (lastUpdatedForEpoch == 0) {
                /* we have not run this function for this epoch, and can assume that
                currentTotalStakeForExpiry[expiry] was staked from the beginning of this epoch,
                so we just use the start of the epoch as lastUpdatedForEpoch */
                lastUpdatedForEpoch = epochEndTime.sub(epochDuration);
            }

            uint256 newLastUpdated = Math.min(block.timestamp, epochEndTime);

            epochs[i].totalStakeSecondsForExpiry[expiry] = epochs[i].totalStakeSecondsForExpiry[
                expiry
            ]
                .add(
                currentTotalStakeForExpiry[expiry].mul(newLastUpdated.sub(lastUpdatedForEpoch))
            );
            epochs[i].lastTimeStakeSecondsUpdatedForExpiry[expiry] = newLastUpdated;
        }
    }

    /**
    @notice Check if the user is entitled for any new rewards and transfer them to users.
        The rewards are calculated since the last time rewards was calculated for him,
        I.e. Since the last time his stake was "updated"
        I.e. Since lastTimeUserStakeUpdated[account]
    @dev The user's stake since lastTimeUserStakeUpdated[user] until now = balances[user][expiry]
    @dev After this function, the following should be updated correctly up to this point:
            - availableRewardsForEpoch[account][all epochs]
            - epochs[all epochs].userStakeSeconds
     */
    function _settlePendingRewards(address account, uint256 expiry)
        internal
        returns (uint256 _rewardsWithdrawableNow)
    {
        // account has not staked this LP_expiry before, no need to do anything
        if (lastTimeUserStakeUpdated[account][expiry] == 0) {
            return 0;
        }

        uint256 _curEpoch = _getCurrentEpochId();
        uint256 _endEpoch;
        uint256 _startEpoch = _epochOfTimestamp(lastTimeUserStakeUpdated[account][expiry]);
        // if its after the end of the programme, only count until the last epoch

        /*
        calculate the rewards in the current block. All blocks before this will be calculated
        in the for-loop after this if-else
        */
        if (_curEpoch > numberOfEpochs) {
            _endEpoch = numberOfEpochs.add(1);
        } else {
            _endEpoch = _curEpoch;

            // current epoch is still within the liq mining programme.
            // We need to update userStakeSeconds for this epoch, until the current timestamp
            if (_startEpoch < _curEpoch) {
                /* if the last time we ran this funciton was in a previous epoch,
                then we just count the seconds elapsed this epoch */
                epochs[_curEpoch].userStakeSeconds[account][expiry] = balances[account][expiry]
                    .mul(_epochRelativeTime(block.timestamp));
                // last action of user is in a previous epoch
                // tlast -> now the user hasn't changed their amount of Lp
            } else {
                uint256 timeElapsed =
                    block.timestamp.sub(lastTimeUserStakeUpdated[account][expiry]);
                // last action of user is in this epoch
                epochs[_curEpoch].userStakeSeconds[account][expiry] = epochs[_curEpoch]
                    .userStakeSeconds[account][expiry]
                    .add(balances[account][expiry].mul(timeElapsed));
            }
        }

        /* Go through epochs that were over
        to update epochs[..].userStakeSeconds and epochs[..].availableRewardsForEpoch
        */
        for (uint256 epochId = _startEpoch; epochId < _endEpoch; epochId++) {
            RewardsCalculation memory vars;
            vars.userStakeSeconds = calUserStakeSeconds(account, expiry, _startEpoch, epochId);

            epochs[epochId].userStakeSeconds[account][expiry] = vars.userStakeSeconds;

            vars.settingId = epochId > lastEpochWithSettingId
                ? currentSettingId
                : epochs[epochId].allocationSettingId;

            vars.rewardsForMarket = rewardsForEpoch[epochId]
                .mul(allocationSettings[vars.settingId][expiry])
                .div(ALLOCATION_DENOMINATOR);

            if (epochs[epochId].totalStakeSecondsForExpiry[expiry] == 0) {
                /*
                Handle special case when no-one stake/unstake for this expiry during the epoch
                I.e. Everyone staked before the start of the epoch and hold through the end
                as such, totalStakeSecondsForExpiry is still not updated, and is zero.
                we will just update it to currentTotalStakeForExpiry[expiry] * epochDuration
                */
                if (currentTotalStakeForExpiry[expiry] == 0) {
                    /* in the extreme extreme case of zero staked LPs for this expiry even now,
                    => nothing to do from this epoch onwards */
                    break;
                }

                // no one does anything in this epoch => totalStakeSecondsForExpiry = full epoch
                epochs[epochId].totalStakeSecondsForExpiry[expiry] = currentTotalStakeForExpiry[
                    expiry
                ]
                    .mul(epochDuration);
            }
            vars.rewardsPerVestingEpoch = vars
                .rewardsForMarket
                .mul(vars.userStakeSeconds)
                .div(epochs[epochId].totalStakeSecondsForExpiry[expiry])
                .div(vestingEpochs);

            // Now we distribute this rewards over the vestingEpochs starting from e + 1
            for (uint256 vestingE = epochId + 1; vestingE <= epochId + vestingEpochs; vestingE++) {
                availableRewardsForEpoch[account][vestingE] = availableRewardsForEpoch[account][
                    vestingE
                ]
                    .add(vars.rewardsPerVestingEpoch);
            }
        }

        for (uint256 epochId = 2; epochId <= _curEpoch; epochId++) {
            if (availableRewardsForEpoch[account][epochId] > 0) {
                _rewardsWithdrawableNow = _rewardsWithdrawableNow.add(
                    availableRewardsForEpoch[account][epochId]
                );
                availableRewardsForEpoch[account][epochId] = 0;
            }
        }
        IERC20(pendleTokenAddress).safeTransfer(account, _rewardsWithdrawableNow);
    }

    function calUserStakeSeconds(
        address account,
        uint256 expiry,
        uint256 _startEpoch,
        uint256 _epochId
    ) internal view returns (uint256 userStakeSeconds) {
        if (_epochId == _startEpoch) {
            // if its the epoch where user staked,
            // the user staked from lastTimeUserStakeUpdated[expiry] until end of that epoch
            uint256 secondsStakedThisEpochSinceLastUpdate =
                epochDuration.sub(_epochRelativeTime(lastTimeUserStakeUpdated[account][expiry]));
            // number of remaining seconds in this startEpoch (since the last action of user)
            userStakeSeconds = epochs[_epochId].userStakeSeconds[account][expiry].add(
                secondsStakedThisEpochSinceLastUpdate.mul(balances[account][expiry])
            );
        } else {
            userStakeSeconds = epochDuration.mul(balances[account][expiry]);
        }
    }

    function _pullLpToken(
        address marketAddress,
        uint256 expiry,
        uint256 amount
    ) internal {
        _settleLpInterests(expiry, msg.sender);
        IERC20(marketAddress).safeTransferFrom(msg.sender, lpHolderForExpiry[expiry], amount);
    }

    function _pushLpToken(uint256 expiry, uint256 amount) internal {
        _settleLpInterests(expiry, msg.sender);
        PendleLpHolder(lpHolderForExpiry[expiry]).sendLp(msg.sender, amount);
    }

    function _settleLpInterests(uint256 expiry, address account)
        internal
        returns (uint256 dueInterests)
    {
        PendleLpHolder(lpHolderForExpiry[expiry]).claimLpInterests();
        // calculate interest related params
        _updateParamL(expiry);

        uint256 interestValuePerLP = _getInterestValuePerLP(expiry, account);
        if (interestValuePerLP == 0) return 0;

        dueInterests = balances[account][expiry].mul(interestValuePerLP).div(MULTIPLIER);
        if (dueInterests == 0) return 0;
        lastNYield[expiry] = lastNYield[expiry].sub(dueInterests);
        PendleLpHolder(lpHolderForExpiry[expiry]).sendInterests(account, dueInterests);
    }

    // this function should be called whenver the total amount of LP_expiry changes
    // or when someone claim LP interests
    // it will update:
    //    - paramL[expiry]
    //    - lastNYield[expiry]
    //    - normalizedIncome[expiry]
    function _updateParamL(uint256 expiry) internal {
        require(hasExpiry[expiry], "INVALID_EXPIRY");

        address xyt = address(data.xytTokens(forgeId, underlyingAsset, expiry));
        uint256 currentNYield =
            IERC20(IPendleYieldToken(xyt).underlyingYieldToken()).balanceOf(
                lpHolderForExpiry[expiry]
            );

        (uint256 firstTerm, uint256 paramR) = _getFirstTermAndParamR(expiry, currentNYield);

        uint256 secondTerm;
        if (paramR != 0 && currentTotalStakeForExpiry[expiry] != 0) {
            secondTerm = paramR.mul(MULTIPLIER).div(currentTotalStakeForExpiry[expiry]);
        }

        // Update new states
        paramL[expiry] = firstTerm.add(secondTerm);
        lastNYield[expiry] = currentNYield;
    }

    function _addNewExpiry(
        uint256 expiry,
        address xyt,
        address marketAddress
    ) internal returns (address newLpHoldingContractAddress) {
        expiries.push(expiry);
        hasExpiry[expiry] = true;
        address underlyingYieldToken = IPendleYieldToken(xyt).underlyingYieldToken();
        newLpHoldingContractAddress = Factory.createContract(
            type(PendleLpHolder).creationCode,
            abi.encodePacked(marketAddress, marketFactory.router(), underlyingYieldToken),
            abi.encode(marketAddress, marketFactory.router(), underlyingYieldToken)
        );
        lpHolderForExpiry[expiry] = newLpHoldingContractAddress;
        _afterAddingNewExpiry(expiry);
    }

    function _getData() internal view override returns (IPendleData) {
        return data;
    }

    // 1-indexed
    function _getCurrentEpochId() internal view returns (uint256) {
        return _epochOfTimestamp(block.timestamp);
    }

    function _epochOfTimestamp(uint256 t) internal view returns (uint256) {
        if (t < startTime) return 0;
        return t.sub(startTime).div(epochDuration).add(1);
    }

    function _epochRelativeTime(uint256 t) internal view returns (uint256) {
        return t.sub(startTime).mod(epochDuration);
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
}
