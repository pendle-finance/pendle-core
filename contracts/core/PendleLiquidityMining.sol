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
pragma solidity ^0.7.0;

import {Factory} from "../libraries/PendleLibrary.sol";
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
import "hardhat/console.sol";


// Things that must hold in this contract:
//      - If an account's stake information is updated (hence lastTimeUserStakeUpdated is changed),
//        then his pending rewards are calculated as well (and saved in availableRewardsForEpoch[user][epochId])
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
        mapping(address => mapping(uint256 => uint256)) userStakeSeconds; // userStakeSeconds[user][expiry] = the stake * seconds for the user for LP_expiry
        mapping(uint256 => uint256) baseTokenReserve; // baseTokenReserve[expiry] = baseToken reserve of the market for LP_expiry
        uint256 totalBaseTokenReserve; // sum of all baseTokenReserve
        bool calculated;
    }

    IPendleData public pendleData;
    address public pendleAddress;
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

    // storage for LP interests stuff
    mapping(uint256 => address) public lpHolderForExpiry;
    mapping(uint256 => uint256) public globalIncomeIndexForExpiry;
    mapping(uint256 => mapping(address => uint256)) public lastGlobalIncomeIndexForExpiry;
    mapping(uint256 => uint256) public lastUnderlyingYieldTokenBalance;
    uint256 private constant GLOBAL_INCOME_INDEX_MULTIPLIER = 10**8;

    // balances[account][expiry] is the amount of LP_expiry that the account has staked
    mapping(address => mapping(uint256 => uint256)) public override balances;
    mapping(address => mapping(uint256 => uint256)) public lastTimeUserStakeUpdated;

    // availableRewardsForEpoch[account][epochId] is the amount of PENDLEs the account can withdraw at the beginning of epochId
    mapping(address => mapping(uint256 => uint256)) public availableRewardsForEpoch;

    mapping(uint256 => EpochData) private epoches;
    mapping(uint256 => uint256) public currentTotalStakeForExpiry;
    mapping(address => UserExpiries) private userExpiries;

    modifier isFunded() {
        require(funded, "Pendle: not funded");
        _;
    }

    constructor(
        address _governance,
        address _pendleAddress,
        IPendleData _pendleData,
        address _pendleMarketFactory,
        address _pendleAaveForge,
        address _underlyingAsset,
        address _baseToken,
        uint256 _startTime,
        uint256 _epochDuration,
        uint256 _rewardsPerEpoch,
        uint256 _numberOfEpochs,
        uint256 _vestingEpochs
    ) Permissions(_governance) {
        require(_startTime > block.timestamp, "Pendle: startTime is over");
        //TODO: add more sanity checks:
        //  - ...
        pendleAddress = _pendleAddress;
        pendleData = _pendleData;
        underlyingAsset = _underlyingAsset;
        baseToken = _baseToken;
        startTime = _startTime;
        epochDuration = _epochDuration;
        rewardsPerEpoch = _rewardsPerEpoch;
        numberOfEpochs = _numberOfEpochs;
        vestingEpochs = _vestingEpochs;

        marketFactoryId = _pendleData.getMarketFactoryId(_pendleMarketFactory);
        forgeId = _pendleData.getForgeId(_pendleAaveForge);
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
        require(!funded, "Pendle: funded");
        funded = true;
        IERC20(pendleAddress).safeTransferFrom(
            msg.sender,
            address(this),
            rewardsPerEpoch.mul(numberOfEpochs)
        );
    }

    function stake(uint256 expiry, uint256 amount)
        public
        override
        isFunded
        nonReentrant
        returns (address newLpHoldingContract)
    {
        uint256 _epoch = _currentEpoch();
        require(_epoch <= numberOfEpochs, "Pendle: end of incentives");
        _makeSureEpochIsCalculated(_epoch.sub(1));
        _updateStakeAndRewardsBeforeStakeChange(msg.sender, expiry, _epoch);

        balances[msg.sender][expiry] = balances[msg.sender][expiry].add(amount);
        currentTotalStakeForExpiry[expiry] = currentTotalStakeForExpiry[expiry].add(amount);
        address xyt = address(pendleData.xytTokens(forgeId, underlyingAsset, expiry));
        address marketAddress = pendleData.getMarket(forgeId, marketFactoryId, xyt, baseToken);
        require(xyt != address(0), "Pendle: xyt not found");
        require(marketAddress != address(0), "Pendle: market not found");
        if (!hasExpiry[expiry]) {
            newLpHoldingContract = _addNewExpiry(expiry, xyt, marketAddress);
        }

        if (!userExpiries[msg.sender].hasExpiry[expiry]) {
            userExpiries[msg.sender].expiries.push(expiry);
            userExpiries[msg.sender].hasExpiry[expiry] = true;
        }

        // get the LPs
        _pullLpToken(marketAddress, expiry, amount);
    }

    function withdraw(uint256 expiry, uint256 amount) public override nonReentrant isFunded {
        uint256 _epoch = _currentEpoch();
        /* console.log("Balance, amount = ", balances[msg.sender][expiry], amount); */
        require(balances[msg.sender][expiry] >= amount, "Pendle: insufficient balance");
        _makeSureEpochIsCalculated(_epoch.sub(1));
        _updateStakeAndRewardsBeforeStakeChange(msg.sender, expiry, _epoch);
        _pushLpToken(expiry, amount); // this has to happen before currentTotalStakeForExpiry and balances are updated

        balances[msg.sender][expiry] = balances[msg.sender][expiry].sub(amount);
        currentTotalStakeForExpiry[expiry] = currentTotalStakeForExpiry[expiry].sub(amount);
    }

    function claimRewards() public override nonReentrant returns (uint256[] memory rewards) {
        uint256 _epoch = _currentEpoch();
        _makeSureEpochIsCalculated(_epoch.sub(1));
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

    // this must be called as the very first function when a new epoch starts
    // It will snapshot and save the base token reserves of the Markets that participated in the liq mining programme
    function calculateEpochData(uint256 epochId) public override {
        require(_currentEpoch() > epochId, "Pendle: invalid epochId");
        require(epochId <= numberOfEpochs, "Pendle: invalid epochId");
        require(epochId > 0, "Pendle: invalid epochId");
        require(!epoches[epochId].calculated, "Pendle: epoch already calculated");

        // The previous epochId (more than 10 days ago) must have been calculated first.
        // By right every epoch must be calculated very soon after it ends, so this should never happens.
        if (epochId > 1) {
            require(epoches[epochId - 1].calculated, "Pendle: previous epoch not calculated");
        }

        //@@Vu: TODO: there could be a problem if the number of expiries are so many that
        // this loop will not fit in 12.4M gas for a transaction
        for (uint256 _expiryId = 0; _expiryId < expiries.length; _expiryId++) {
            uint256 expiry = expiries[_expiryId];
            address xyt = address(pendleData.xytTokens(forgeId, underlyingAsset, expiry));
            (, epoches[epochId].baseTokenReserve[expiry], ) = IPendleMarket(
                pendleData.getMarket(forgeId, marketFactoryId, xyt, baseToken)
            )
                .getReserves();
            epoches[epochId].totalBaseTokenReserve += epoches[epochId].baseTokenReserve[expiry];
        }

        epoches[epochId].calculated = true;
    }

    // internal functions

    // 1-indexed
    function _currentEpoch() internal view returns (uint256) {
        return _epochOfTimestamp(block.timestamp);
    }

    function _epochOfTimestamp(uint256 t) internal view returns (uint256) {
        return t.sub(startTime).div(epochDuration).add(1);
    }

    function _makeSureEpochIsCalculated(uint256 epochId) internal {
        if (epochId > 0 && !epoches[epochId].calculated) {
            calculateEpochData(epochId);
        }
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

    // must be called right before _settlePendingRewards()
    // This will update the following stake data for the current epoch:
    //      epoches[current epoch].totalStakeSecondsForExpiry
    //      epoches[current epoch].lastTimeStakeSecondsUpdatedForExpiry
    //          If this is the very first transaction involving this expiry, then we need to update for the previous epoch as well
    //          If the previous didn't have any transactions at all, (and hence was not updated at all), we need to update it and check the previous previous ones, and so on..
    // This is the only function that updates lastTimeUserStakeUpdated
    // Other functions must make sure that currentTotalStakeForExpiry could be assumed to stay exactly the same since lastTimeUserStakeUpdated until now;
    function _updateStakeDataForExpiry(uint256 expiry, uint256 _currentE) internal {
        uint256 _epoch = _currentE;

        if (_currentE > numberOfEpochs) {
            _epoch = numberOfEpochs;
        }
        while (_epoch > 0) {
            uint256 endOfEpoch = startTime.add(_epoch.mul(epochDuration));
            uint256 lastUpdatedForEpoch =
                epoches[_epoch].lastTimeStakeSecondsUpdatedForExpiry[expiry];
            if (lastUpdatedForEpoch == endOfEpoch) {
                break; // its already updated until this epoch, our job here is done
            }

            if (lastUpdatedForEpoch == 0) {
                // if lastTimeStakeSecondsUpdatedForExpiry[expiry] is zero, we have not run this function for this epoch,
                // we can assume that currentTotalStakeForExpiry[expiry] was staked from the beginning of this epoch.
                // so we just use the start of the epoch as lastUpdatedForEpoch
                lastUpdatedForEpoch = endOfEpoch.sub(epochDuration);
            }
            uint256 newLastUpdated = endOfEpoch;
            if (_epoch == _currentE) {
                newLastUpdated = block.timestamp;
            }

            epoches[_epoch].totalStakeSecondsForExpiry[expiry] = epoches[_epoch]
                .totalStakeSecondsForExpiry[expiry]
                .add(
                currentTotalStakeForExpiry[expiry].mul(newLastUpdated.sub(lastUpdatedForEpoch))
            );
            epoches[_epoch].lastTimeStakeSecondsUpdatedForExpiry[expiry] = newLastUpdated;
            _epoch = _epoch.sub(1);
        }
    }

    // See if the user is entitled for any new rewards,
    // since the last time rewards was calculated for him.
    //      I.e. Since the last time his stake was "updated"
    //      I.e. Since lastTimeUserStakeUpdated[account]
    // The user's stake since the lastTimeUserStakeUpdated[user] until now is exactly balances[user][expiry]
    // After this function, the following should be updated correctly up to this point:
    //      availableRewardsForEpoch[account][all epoches]
    //      epoches[all epoches].userStakeSeconds
    function _settlePendingRewards(
        address account,
        uint256 expiry,
        uint256 _currentE
    ) internal returns (uint256 _rewardsWithdrawableNow) {
        // account has not staked this LP_expiry before, no need to do anything
        if (lastTimeUserStakeUpdated[account][expiry] == 0) {
            return 0;
        }
        console.log(
            "_settlePendingRewards, lastTimeUserStakeUpdated = ",
            lastTimeUserStakeUpdated[account][expiry]
        );

        uint256 _endEpoch;
        uint256 _startEpoch = _epochOfTimestamp(lastTimeUserStakeUpdated[account][expiry]);
        // if its after the end of the programme, only count until the last epoch
        if (_currentE > numberOfEpochs) {
            _endEpoch = numberOfEpochs.add(1);
        } else {
            _endEpoch = _currentE;

            // current epoch is still within the liq mining programme.
            // We need to update userStakeSeconds for this epoch, until the current timestamp
            if (_startEpoch < _currentE) {
                // if the last time we ran this funciton was in a previous epoch, then we just count the seconds elapsed this epoch
                epoches[_currentE].userStakeSeconds[account][expiry] = balances[account][expiry]
                    .mul(_epochRelativeTime(block.timestamp));
            } else {
                uint256 timeElapsed =
                    block.timestamp.sub(lastTimeUserStakeUpdated[account][expiry]);
                epoches[_currentE].userStakeSeconds[account][expiry] = epoches[_currentE]
                    .userStakeSeconds[account][expiry]
                    .add(balances[account][expiry].mul(timeElapsed));
            }
        }
        console.log("\t startEpoch, endEpoch = ", _startEpoch, _endEpoch);

        uint256 e;

        // Go through epoches that were over, and update epoches[..].userStakeSeconds and availableRewardsForEpoch
        for (e = _startEpoch; e < _endEpoch; e++) {
            //// Update epoches[e].userStakeSeconds
            uint256 userStakeSeconds;
            if (e == _startEpoch) {
                // if its the epoch where user staked,
                // the user staked from lastTimeUserStakeUpdated[expiry] until the end of that epoch
                uint256 secondsStakedThisEpochSinceLastUpdate =
                    epochDuration.sub(
                        lastTimeUserStakeUpdated[account][expiry].sub(startTime).mod(epochDuration)
                    );
                userStakeSeconds = epoches[e].userStakeSeconds[account][expiry].add(
                    secondsStakedThisEpochSinceLastUpdate.mul(balances[account][expiry])
                );
            } else {
                userStakeSeconds = epochDuration.mul(balances[account][expiry]);
            }
            epoches[e].userStakeSeconds[account][expiry] = userStakeSeconds;
            console.log("\tuserStakeSeconds = ", userStakeSeconds);

            uint256 rewardsForMarket =
                rewardsPerEpoch.mul(epoches[e].baseTokenReserve[expiry]).div(
                    epoches[e].totalBaseTokenReserve
                );
            if (epoches[e].totalStakeSecondsForExpiry[e] == 0) {
                //There is a remote but possible case when no-one stake/unstake for this expiry during the epoch
                //I.e. Everyone staked before the start of the epoch and hold through the end
                //as such, totalStakeSecondsForExpiry is still not updated, and is zero.
                //we will just need to update it to be currentTotalStakeForExpiry[expiry] * epochDuration
                epoches[e].totalStakeSecondsForExpiry[e] = currentTotalStakeForExpiry[expiry].mul(
                    epochDuration
                );
            }
            uint256 rewardsPerVestingEpoch =
                rewardsForMarket
                    .mul(userStakeSeconds)
                    .div(epoches[e].totalStakeSecondsForExpiry[e])
                    .div(vestingEpochs);

            console.log("\trewardPerVestingEpoch = ", rewardsPerVestingEpoch);
            // Now we distribute this rewards over the vestingEpochs starting from e + 1
            for (uint256 vestingE = e + 1; vestingE <= e + vestingEpochs; vestingE++) {
                availableRewardsForEpoch[account][vestingE] = availableRewardsForEpoch[account][
                    vestingE
                ]
                    .add(rewardsPerVestingEpoch);
                console.log(
                    "\t vestingE, availableRewardsForEpoch = ",
                    vestingE,
                    availableRewardsForEpoch[account][vestingE]
                );
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
        console.log("\trewardWithdrawableNow = ", _rewardsWithdrawableNow);
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
        PendleLpHolder(lpHolderForExpiry[expiry]).sendInterests(account, dueInterests);

        console.log("Settled LP interests for ", account);
    }

    // this function should be called whenver the total amount of LP_expiry changes
    function _updateGlobalIncomeIndex(uint256 expiry) internal {
        require(hasExpiry[expiry], "Pendle: invalid expiry");
        address xyt = address(pendleData.xytTokens(forgeId, underlyingAsset, expiry));

        uint256 currentUnderlyingYieldTokenBalance =
            IERC20(IPendleYieldToken(xyt).underlyingYieldToken()).balanceOf(
                lpHolderForExpiry[expiry]
            );
        uint256 interestsEarned =
            currentUnderlyingYieldTokenBalance - lastUnderlyingYieldTokenBalance[expiry];
        lastUnderlyingYieldTokenBalance[expiry] = currentUnderlyingYieldTokenBalance;

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
        newLpHoldingContract = Factory.createContract(
            type(PendleLpHolder).creationCode,
            abi.encodePacked(marketAddress, xyt),
            abi.encode(marketAddress, xyt)
        );
        lpHolderForExpiry[expiry] = newLpHoldingContract;
        globalIncomeIndexForExpiry[expiry] = 1; //aribitrary non-zero initial income index for LP_expiry
    }
}
