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

import "../libraries/FactoryLib.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "../interfaces/IPendleRouter.sol";
import "../interfaces/IPendleForge.sol";
import "../interfaces/IPendleMarketFactory.sol";
import "../interfaces/IPendleMarket.sol";
import "../interfaces/IPendleData.sol";
import "../interfaces/IPendleLpHolder.sol";
import "../core/PendleLpHolder.sol";
import "../interfaces/IPendleLiquidityMining.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../periphery/Permissions.sol";

// import "hardhat/console.sol";

/**
    @dev things that must hold in this contract:
     - If an account's stake information is updated (hence lastTimeUserStakeUpdated is changed),
        then his pending rewards are calculated as well
        (and saved in availableRewardsForEpoch[user][epochId])
 */
contract PendleLiquidityMining is IPendleLiquidityMining, Permissions, ReentrancyGuard {
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
        // userStakeSeconds[user][expiry] = the stake * seconds for the user for LP_expiry
        /*
        mapping(uint256 => uint256) baseTokenReserve;
        baseTokenReserve[expiry] = baseToken reserve of the market for LP_expiry
        */
        /* uint256 totalBaseTokenReserve; // sum of all baseTokenReserve */
        bool calculated;
        uint256 allocationSettingId;
    }

    /* IPendleData public pendleData; */
    IPendleRouter public pendleRouter;
    IPendleMarketFactory public pendleMarketFactory;
    IPendleData public pendleData;
    address public override pendleAddress;
    bytes32 public override forgeId;
    bytes32 public override marketFactoryId;

    address public override underlyingAsset;
    address public override baseToken;
    uint256 public override startTime;
    uint256 public override epochDuration;
    uint256 public override rewardsPerEpoch;
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
    mapping(uint256 => uint256) public globalIncomeIndexForExpiry;
    mapping(uint256 => mapping(address => uint256)) public lastGlobalIncomeIndexForExpiry;
    mapping(uint256 => uint256) public lastUnderlyingYieldTokenBalance;
    uint256 private constant GLOBAL_INCOME_INDEX_MULTIPLIER = 10**30;

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
        address _pendleAddress,
        address _pendleRouter, // The router basically identify our Pendle instance.
        bytes32 _pendleMarketFactoryId,
        bytes32 _pendleForgeId,
        address _underlyingAsset,
        address _baseToken,
        uint256 _startTime,
        uint256 _epochDuration,
        uint256 _rewardsPerEpoch,
        uint256 _numberOfEpochs,
        uint256 _vestingEpochs
    ) Permissions(_governance) {
        require(_startTime > block.timestamp, "START_TIME_OVER");
        require(IERC20(_pendleAddress).totalSupply() > 0, "INVALID_ERC20");
        require(IERC20(_underlyingAsset).totalSupply() > 0, "INVALID_ERC20");
        require(IERC20(_baseToken).totalSupply() > 0, "INVALID_ERC20");
        require(_numberOfEpochs > 0, "INVALID_NO_OF_EPOCHS");
        require(_vestingEpochs > 0, "INVALID_VESTING_EPOCHS");
        pendleAddress = _pendleAddress;
        pendleRouter = IPendleRouter(_pendleRouter);
        pendleData = pendleRouter.data();
        require(
            pendleData.getMarketFactoryAddress(_pendleMarketFactoryId) != address(0),
            "INVALID_MARKET_FACTORY_ID"
        );
        require(pendleData.getForgeAddress(_pendleForgeId) != address(0), "INVALID_FORGE_ID");

        pendleMarketFactory = IPendleMarketFactory(
            pendleData.getMarketFactoryAddress(_pendleMarketFactoryId)
        );
        marketFactoryId = _pendleMarketFactoryId;
        forgeId = _pendleForgeId;

        underlyingAsset = _underlyingAsset;
        baseToken = _baseToken;
        startTime = _startTime;
        epochDuration = _epochDuration;
        rewardsPerEpoch = _rewardsPerEpoch;
        numberOfEpochs = _numberOfEpochs;
        vestingEpochs = _vestingEpochs;
    }

    function readUserExpiries(address user)
        public
        view
        override
        returns (uint256[] memory _expiries)
    {
        _expiries = userExpiries[user].expiries;
    }

    function fund() public {
        require(!funded, "ALREADY_FUNDED");
        require(currentSettingId > 0, "NO_ALLOC_SETTING");
        funded = true;
        IERC20(pendleAddress).safeTransferFrom(
            msg.sender,
            address(this),
            rewardsPerEpoch.mul(numberOfEpochs)
        );
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
     */
    function setAllocationSetting(
        uint256[] calldata _expiries,
        uint256[] calldata allocationNominators
    ) public onlyGovernance {
        // not many expiries, about 2-3 max
        uint256 _currentE = _currentEpoch();
        if (currentSettingId == 0) {
            require(block.timestamp < startTime, "LATE_FIRST_ALLOCATION");
        }
        for (uint256 _epoch = lastEpochWithSettingId.add(1); _epoch <= _currentE; _epoch++) {
            // save the epochSettingId for the epochs before the current epoch
            epochs[_epoch].allocationSettingId = currentSettingId;
        }
        lastEpochWithSettingId = _currentE;
        currentSettingId++;
        uint256 sumAllocationNominators;
        require(_expiries.length == allocationNominators.length, "INVALID_ALLOCATION");
        for (uint256 _i = 0; _i < _expiries.length; _i++) {
            allocationSettings[currentSettingId][_expiries[_i]] = allocationNominators[_i];
            sumAllocationNominators = sumAllocationNominators.add(allocationNominators[_i]);
        }
        require(sumAllocationNominators == ALLOCATION_DENOMINATOR, "INVALID_ALLOCATION");
    }

    function stake(uint256 expiry, uint256 amount)
        public
        override
        isFunded
        nonReentrant
        returns (address newLpHoldingContract)
    {
        uint256 _epoch = _currentEpoch();
        require(_epoch > 0, "NOT_STARTED");
        require(_epoch <= numberOfEpochs, "INCENTIVES_PERIOD_OVER");
        _updateStakeAndRewardsBeforeStakeChange(msg.sender, expiry, _epoch);

        address xyt = address(pendleData.xytTokens(forgeId, underlyingAsset, expiry));
        address marketAddress = pendleData.getMarket(marketFactoryId, xyt, baseToken);
        require(xyt != address(0), "XYT_NOT_FOUND");
        require(marketAddress != address(0), "MARKET_NOT_FOUND");

        if (!hasExpiry[expiry]) {
            newLpHoldingContract = _addNewExpiry(expiry, xyt, marketAddress);
        }

        if (!userExpiries[msg.sender].hasExpiry[expiry]) {
            userExpiries[msg.sender].expiries.push(expiry);
            userExpiries[msg.sender].hasExpiry[expiry] = true;
        }
        // get the LPs
        _pullLpToken(marketAddress, expiry, amount);

        balances[msg.sender][expiry] = balances[msg.sender][expiry].add(amount);
        currentTotalStakeForExpiry[expiry] = currentTotalStakeForExpiry[expiry].add(amount);
    }

    function withdraw(uint256 expiry, uint256 amount) public override nonReentrant isFunded {
        uint256 _epoch = _currentEpoch();
        require(_epoch > 0, "NOT_STARTED");
        require(balances[msg.sender][expiry] >= amount, "INSUFFICIENT_BALANCE");
        _updateStakeAndRewardsBeforeStakeChange(msg.sender, expiry, _epoch);

        // _pushLpToken must happens before currentTotalStakeForExpiry and balances are updated
        _pushLpToken(expiry, amount);

        balances[msg.sender][expiry] = balances[msg.sender][expiry].sub(amount);
        currentTotalStakeForExpiry[expiry] = currentTotalStakeForExpiry[expiry].sub(amount);
    }

    function claimRewards() public override nonReentrant returns (uint256[] memory rewards) {
        uint256 _epoch = _currentEpoch(); //!!! what if currentEpoch > final epoch?
        require(_epoch > 0, "NOT_STARTED");

        rewards = new uint256[](vestingEpochs);
        for (uint256 i = 0; i < userExpiries[msg.sender].expiries.length; i++) {
            uint256 expiry = userExpiries[msg.sender].expiries[i];
            rewards[0] = _updateStakeAndRewardsBeforeStakeChange(msg.sender, expiry, _epoch);
        }
        for (uint256 e = 1; e < vestingEpochs; e++) {
            rewards[e] = rewards[e].add(availableRewardsForEpoch[msg.sender][_epoch.add(e)]);
        }
    }

    function claimLpInterests() public override nonReentrant returns (uint256 _interests) {
        for (uint256 i = 0; i < userExpiries[msg.sender].expiries.length; i++) {
            _interests = _interests.add(
                _settleLpInterests(userExpiries[msg.sender].expiries[i], msg.sender)
            );
        }
    }

    // internal functions

    // 1-indexed
    function _currentEpoch() internal view returns (uint256) {
        return _epochOfTimestamp(block.timestamp);
    }

    function _epochOfTimestamp(uint256 t) internal view returns (uint256) {
        if (t < startTime) return 0;
        return t.sub(startTime).div(epochDuration).add(1);
    }

    function _epochRelativeTime(uint256 t) internal view returns (uint256) {
        return t.sub(startTime).mod(epochDuration);
    }

    function _updateStakeAndRewardsBeforeStakeChange(
        address account,
        uint256 expiry,
        uint256 currentEpoch
    ) internal returns (uint256 _rewardsWithdrawableNow) {
        _updateStakeDataForExpiry(expiry, currentEpoch);
        _rewardsWithdrawableNow = _settlePendingRewards(account, expiry, currentEpoch);
        lastTimeUserStakeUpdated[account][expiry] = block.timestamp;
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
    function _updateStakeDataForExpiry(uint256 expiry, uint256 _currentE) internal {
        uint256 _epoch = _currentE;

        if (_currentE > numberOfEpochs) {
            _epoch = numberOfEpochs;
        }
        while (_epoch > 0) {
            uint256 endOfEpoch = startTime.add(_epoch.mul(epochDuration));
            uint256 lastUpdatedForEpoch =
                epochs[_epoch].lastTimeStakeSecondsUpdatedForExpiry[expiry];
            if (lastUpdatedForEpoch == endOfEpoch) {
                break; // its already updated until this epoch, our job here is done
            }

            if (lastUpdatedForEpoch == 0) {
                /* we have not run this function for this epoch, and can assume that
                currentTotalStakeForExpiry[expiry] was staked from the beginning of this epoch,
                so we just use the start of the epoch as lastUpdatedForEpoch */
                lastUpdatedForEpoch = endOfEpoch.sub(epochDuration);
            }
            uint256 newLastUpdated = endOfEpoch;
            if (_epoch == _currentE) {
                newLastUpdated = block.timestamp;
            }

            epochs[_epoch].totalStakeSecondsForExpiry[expiry] = epochs[_epoch]
                .totalStakeSecondsForExpiry[expiry]
                .add(
                currentTotalStakeForExpiry[expiry].mul(newLastUpdated.sub(lastUpdatedForEpoch))
            );
            epochs[_epoch].lastTimeStakeSecondsUpdatedForExpiry[expiry] = newLastUpdated;
            _epoch = _epoch.sub(1);
        }
    }

    struct RewardsCalculation {
        uint256 userStakeSeconds;
        uint256 settingId;
        uint256 rewardsForMarket;
        uint256 rewardsPerVestingEpoch;
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
    function _settlePendingRewards(
        address account,
        uint256 expiry,
        uint256 _currentE
    ) internal returns (uint256 _rewardsWithdrawableNow) {
        // account has not staked this LP_expiry before, no need to do anything
        if (lastTimeUserStakeUpdated[account][expiry] == 0) {
            return 0;
        }

        uint256 _endEpoch;
        uint256 _startEpoch = _epochOfTimestamp(lastTimeUserStakeUpdated[account][expiry]);
        // if its after the end of the programme, only count until the last epoch
        /*
        calculate the rewards in the current block. All blocks before this will be calculated
        in the for-loop after this if-else
        */
        if (_currentE > numberOfEpochs) {
            _endEpoch = numberOfEpochs.add(1);
        } else {
            _endEpoch = _currentE;

            // current epoch is still within the liq mining programme.
            // We need to update userStakeSeconds for this epoch, until the current timestamp
            if (_startEpoch < _currentE) {
                /* if the last time we ran this funciton was in a previous epoch,
                then we just count the seconds elapsed this epoch */
                epochs[_currentE].userStakeSeconds[account][expiry] = balances[account][expiry]
                    .mul(_epochRelativeTime(block.timestamp));
                // last action of user is in a previous epoch
                // tlast -> now the user hasn't changed their amount of Lp
            } else {
                uint256 timeElapsed =
                    block.timestamp.sub(lastTimeUserStakeUpdated[account][expiry]);
                // last action of user is in this epoch
                epochs[_currentE].userStakeSeconds[account][expiry] = epochs[_currentE]
                    .userStakeSeconds[account][expiry]
                    .add(balances[account][expiry].mul(timeElapsed));
            }
        }

        uint256 e;

        /* Go through epochs that were over
        to update epochs[..].userStakeSeconds and epochs[..].availableRewardsForEpoch
        */
        for (e = _startEpoch; e < _endEpoch; e++) {
            //// Update epochs[e].userStakeSeconds
            RewardsCalculation memory vars;
            vars.userStakeSeconds = 0; // making it explicit for readability
            if (e == _startEpoch) {
                // if its the epoch where user staked,
                // the user staked from lastTimeUserStakeUpdated[expiry] until end of that epoch
                uint256 secondsStakedThisEpochSinceLastUpdate =
                    epochDuration.sub(
                        _epochRelativeTime(lastTimeUserStakeUpdated[account][expiry])
                    );
                // number of remaining seconds in this startEpoch (since the last action of user)
                vars.userStakeSeconds = epochs[e].userStakeSeconds[account][expiry].add(
                    secondsStakedThisEpochSinceLastUpdate.mul(balances[account][expiry])
                );
            } else {
                vars.userStakeSeconds = epochDuration.mul(balances[account][expiry]);
            }
            epochs[e].userStakeSeconds[account][expiry] = vars.userStakeSeconds;

            vars.settingId = e > lastEpochWithSettingId
                ? currentSettingId
                : epochs[e].allocationSettingId;
            //TODO: think of a better way to update the epoch setting

            vars.rewardsForMarket = rewardsPerEpoch
                .mul(allocationSettings[vars.settingId][expiry])
                .div(ALLOCATION_DENOMINATOR);

            if (epochs[e].totalStakeSecondsForExpiry[expiry] == 0) {
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
                epochs[e].totalStakeSecondsForExpiry[expiry] = currentTotalStakeForExpiry[expiry]
                    .mul(epochDuration);
            }
            vars.rewardsPerVestingEpoch = vars
                .rewardsForMarket
                .mul(vars.userStakeSeconds)
                .div(epochs[e].totalStakeSecondsForExpiry[expiry])
                .div(vestingEpochs);

            // Now we distribute this rewards over the vestingEpochs starting from e + 1
            for (uint256 vestingE = e + 1; vestingE <= e + vestingEpochs; vestingE++) {
                availableRewardsForEpoch[account][vestingE] = availableRewardsForEpoch[account][
                    vestingE
                ]
                    .add(vars.rewardsPerVestingEpoch);
            }
        }

        for (e = 2; e <= _currentE; e++) {
            if (availableRewardsForEpoch[account][e] > 0) {
                _rewardsWithdrawableNow = _rewardsWithdrawableNow.add(
                    availableRewardsForEpoch[account][e]
                );
                availableRewardsForEpoch[account][e] = 0;
            }
        }
        IERC20(pendleAddress).safeTransfer(account, _rewardsWithdrawableNow);
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
        // calculate interest for each expiry
        _updateGlobalIncomeIndex(expiry);
        if (lastGlobalIncomeIndexForExpiry[expiry][account] == 0) {
            lastGlobalIncomeIndexForExpiry[expiry][account] = globalIncomeIndexForExpiry[expiry];
            return 0;
        }
        dueInterests = balances[account][expiry]
            .mul(
            globalIncomeIndexForExpiry[expiry].sub(lastGlobalIncomeIndexForExpiry[expiry][account])
        )
            .div(GLOBAL_INCOME_INDEX_MULTIPLIER);

        lastGlobalIncomeIndexForExpiry[expiry][account] = globalIncomeIndexForExpiry[expiry];
        if (dueInterests == 0) return 0;
        lastUnderlyingYieldTokenBalance[expiry] = lastUnderlyingYieldTokenBalance[expiry].sub(
            dueInterests
        );
        PendleLpHolder(lpHolderForExpiry[expiry]).sendInterests(account, dueInterests);
    }

    // this function should be called whenver the total amount of LP_expiry changes
    function _updateGlobalIncomeIndex(uint256 expiry) internal {
        require(hasExpiry[expiry], "INVALID_EXPIRY");
        address xyt = address(pendleData.xytTokens(forgeId, underlyingAsset, expiry));

        uint256 currentUnderlyingYieldTokenBalance =
            IERC20(IPendleYieldToken(xyt).underlyingYieldToken()).balanceOf(
                lpHolderForExpiry[expiry]
            );
        uint256 interestsEarned =
            currentUnderlyingYieldTokenBalance - lastUnderlyingYieldTokenBalance[expiry];
        lastUnderlyingYieldTokenBalance[expiry] = currentUnderlyingYieldTokenBalance;

        if (interestsEarned == 0 || currentTotalStakeForExpiry[expiry] == 0) {
            return;
        }

        globalIncomeIndexForExpiry[expiry] = globalIncomeIndexForExpiry[expiry].add(
            interestsEarned.mul(GLOBAL_INCOME_INDEX_MULTIPLIER).div(
                currentTotalStakeForExpiry[expiry]
            )
        );
    }

    function _addNewExpiry(
        uint256 expiry,
        address xyt,
        address marketAddress
    ) internal returns (address newLpHoldingContract) {
        expiries.push(expiry);
        hasExpiry[expiry] = true;
        address underlyingYieldToken = IPendleYieldToken(xyt).underlyingYieldToken();
        newLpHoldingContract = Factory.createContract(
            type(PendleLpHolder).creationCode,
            abi.encodePacked(marketAddress, pendleMarketFactory.router(), underlyingYieldToken),
            abi.encode(marketAddress, pendleMarketFactory.router(), underlyingYieldToken)
        );
        lpHolderForExpiry[expiry] = newLpHoldingContract;
        globalIncomeIndexForExpiry[expiry] = 1;
        //1 is an aribitrary non-zero initial income index for LP_expiry
    }
}
