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

import "../core/abstract/PendleLiquidityMiningBase.sol";
import "../core/abstractV2/PendleLiquidityMiningBaseV2.sol";

contract PendleLiquidityRewardsProxy {
    uint256 private constant ALLOCATION_DENOMINATOR = 1_000_000_000;

    struct Vars {
        uint256 startTime;
        uint256 epochDuration;
        uint256 currentEpoch;
        uint256 timeLeftInEpoch;
    }

    function redeemAndCalculateAccruing(
        PendleLiquidityMiningBase liqMining,
        uint256 expiry,
        address user
    )
        external
        returns (
            uint256 userStakeUnits,
            uint256 userStake,
            uint256 totalStakeUnits,
            uint256 totalStake,
            uint256 userTentativeReward
        )
    {
        liqMining.redeemRewards(expiry, user); // this will update the stake data
        Vars memory vars;
        vars.startTime = liqMining.startTime();
        vars.epochDuration = liqMining.epochDuration();
        vars.currentEpoch = (block.timestamp - vars.startTime) / vars.epochDuration + 1;
        vars.timeLeftInEpoch =
            vars.epochDuration -
            ((block.timestamp - vars.startTime) % vars.epochDuration);

        (totalStakeUnits, ) = liqMining.readExpirySpecificEpochData(vars.currentEpoch, expiry);
        userStakeUnits = liqMining.readStakeUnitsForUser(vars.currentEpoch, user, expiry);
        userStake = liqMining.getBalances(expiry, user);
        (totalStake, , , ) = liqMining.readExpiryData(expiry);

        (, uint256 totalRewards) = liqMining.readEpochData(vars.currentEpoch);
        (uint256 latestSettingId, ) = liqMining.latestSetting();
        uint256 epochRewards = (totalRewards *
            liqMining.allocationSettings(latestSettingId, expiry)) / ALLOCATION_DENOMINATOR;

        userTentativeReward =
            (epochRewards * userStakeUnits) /
            (totalStakeUnits + vars.timeLeftInEpoch * totalStake);
    }

    function redeemAndCalculateAccruingV2(
        PendleLiquidityMiningBaseV2 liqMiningV2,
        address user
    )
        external
        returns (
            uint256 userStakeUnits,
            uint256 userStake,
            uint256 totalStakeUnits,
            uint256 totalStake,
            uint256 userTentativeReward
        )
    {
        liqMiningV2.redeemRewards(user); // this will update the stake data
        Vars memory vars;
        vars.startTime = liqMiningV2.startTime();
        vars.epochDuration = liqMiningV2.epochDuration();
        vars.currentEpoch = (block.timestamp - vars.startTime) / vars.epochDuration + 1;
        vars.timeLeftInEpoch =
            vars.epochDuration -
            ((block.timestamp - vars.startTime) % vars.epochDuration);
        uint256 epochRewards;
        (totalStakeUnits, epochRewards,,userStakeUnits, ) = liqMiningV2.readEpochData(vars.currentEpoch, user);
        userStake = liqMiningV2.balances(user);
        totalStake = liqMiningV2.totalStake();

        userTentativeReward =
            (epochRewards * userStakeUnits) /
            (totalStakeUnits + vars.timeLeftInEpoch * totalStake);
    }
    
    function redeemAndCalculateVested(
        PendleLiquidityMiningBase liqMiningContract,
        uint256[] calldata expiries,
        address user
    )
        external
        returns (
            uint256 rewards,
            uint256[] memory vestedRewards,
            uint256 currentEpoch
        )
    {
        uint256 startTime = liqMiningContract.startTime();
        uint256 epochDuration = liqMiningContract.epochDuration();
        uint256 vestingEpochs = liqMiningContract.vestingEpochs();

        currentEpoch = (block.timestamp - startTime) / epochDuration + 1;

        for (uint256 i = 0; i < expiries.length; i++) {
            rewards += liqMiningContract.redeemRewards(expiries[i], user);
        }

        vestedRewards = new uint256[](vestingEpochs - 1);
        for (
            uint256 epochId = currentEpoch + 1;
            epochId < currentEpoch + vestingEpochs;
            epochId++
        ) {
            vestedRewards[epochId - currentEpoch - 1] = liqMiningContract
            .readAvailableRewardsForUser(epochId, user);
        }
    }

    function redeemAndCalculateVestedV2(
        PendleLiquidityMiningBaseV2 liqMiningContractV2,
        address user
    )
        external
        returns (
            uint256 rewards,
            uint256[] memory vestedRewards,
            uint256 currentEpoch
        )
    {
        uint256 startTime = liqMiningContractV2.startTime();
        uint256 epochDuration = liqMiningContractV2.epochDuration();
        uint256 vestingEpochs = liqMiningContractV2.vestingEpochs();

        currentEpoch = (block.timestamp - startTime) / epochDuration + 1;
        rewards = liqMiningContractV2.redeemRewards(user);

        vestedRewards = new uint256[](vestingEpochs - 1);
        for (
            uint256 epochId = currentEpoch + 1;
            epochId < currentEpoch + vestingEpochs;
            epochId++
        ) {
            (,,,,vestedRewards[epochId - currentEpoch - 1]) = liqMiningContractV2.readEpochData(epochId, user);
        }
    }
}
