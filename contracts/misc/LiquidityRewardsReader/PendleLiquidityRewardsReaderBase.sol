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
pragma abicoder v2;

import "./IPendleLiquidityMiningCommon.sol";
import "./IPendleLiquidityMiningV2Common.sol";
import "../../libraries/PairTokensLib.sol";

abstract contract PendleLiquidityRewardsReaderBase {
    using PairTokensLib for PairTokenUints;

    struct Vars {
        uint256 startTime;
        uint256 epochDuration;
        uint256 currentEpoch;
        uint256 timeLeftInEpoch;
        uint256 vestingEpochs;
    }

    struct ResultsRedeemAndCalAccuring {
        uint256 userStakeUnits;
        uint256 userStake;
        uint256 totalStakeUnits;
        uint256 totalStake;
        PairTokenUints userTentativeReward;
    }

    uint256 private constant ALLOCATION_DENOMINATOR = 1_000_000_000;

    function redeemAndCalculateAccruingV1(
        address lmAddr,
        uint256 expiry,
        address user
    ) external returns (ResultsRedeemAndCalAccuring memory res) {
        IPendleLiquidityMiningCommon lm = IPendleLiquidityMiningCommon(lmAddr);
        Vars memory vars = getVars(lmAddr);

        redeemRewardsV1(lmAddr, expiry, user);
        PairTokenUints memory totalRewards = readEpochDataV1(lmAddr, vars.currentEpoch);

        (res.totalStakeUnits, ) = lm.readExpirySpecificEpochData(vars.currentEpoch, expiry);
        res.userStakeUnits = lm.readStakeUnitsForUser(vars.currentEpoch, user, expiry);
        res.userStake = lm.getBalances(expiry, user);
        (res.totalStake, , , ) = lm.readExpiryData(expiry);

        (uint256 latestSettingId, ) = lm.latestSetting();
        PairTokenUints memory epochRewards = totalRewards
            .mul(lm.allocationSettings(latestSettingId, expiry))
            .div(ALLOCATION_DENOMINATOR);

        res.userTentativeReward = epochRewards.mul(res.userStakeUnits).div(
            res.totalStakeUnits + vars.timeLeftInEpoch * res.totalStake
        );
    }

    function redeemAndCalculateAccruingV2(address lmV2Addr, address user)
        external
        returns (ResultsRedeemAndCalAccuring memory res)
    {
        IPendleLiquidityMiningV2Common lmV2 = IPendleLiquidityMiningV2Common(lmV2Addr);
        redeemRewardsV2(lmV2Addr, user);
        Vars memory vars = getVars(lmV2Addr);
        PairTokenUints memory epochRewards;
        (res.totalStakeUnits, epochRewards, res.userStakeUnits, ) = readEpochDataV2(
            lmV2Addr,
            vars.currentEpoch,
            user
        );

        res.userStake = lmV2.balances(user);
        res.totalStake = lmV2.totalStake();

        res.userTentativeReward = epochRewards.mul(res.userStakeUnits).div(
            res.totalStakeUnits + vars.timeLeftInEpoch * res.totalStake
        );
    }

    function redeemAndCalculateVestedV1(
        address lmAddr,
        uint256[] calldata expiries,
        address user
    )
        external
        returns (
            PairTokenUints memory rewards,
            PairTokenUints[] memory vestedRewards,
            uint256 currentEpoch
        )
    {
        Vars memory vars = getVars(lmAddr);
        currentEpoch = vars.currentEpoch;

        for (uint256 i = 0; i < expiries.length; i++) {
            PairTokenUints memory rec = redeemRewardsV1(lmAddr, expiries[i], user);
            if (i == 0) rewards = rec;
            else rewards = rewards.add(rec);
        }

        vestedRewards = new PairTokenUints[](vars.vestingEpochs - 1);
        for (uint256 i = currentEpoch + 1; i < currentEpoch + vars.vestingEpochs; i++) {
            vestedRewards[i - currentEpoch - 1] = readAvailableRewardsForUserV1(lmAddr, i, user);
        }
    }

    function redeemAndCalculateVestedV2(address lmV2Addr, address user)
        external
        returns (
            PairTokenUints memory rewards,
            PairTokenUints[] memory vestedRewards,
            uint256 currentEpoch
        )
    {
        Vars memory vars = getVars(lmV2Addr);
        currentEpoch = vars.currentEpoch;

        rewards = redeemRewardsV2(lmV2Addr, user);

        vestedRewards = new PairTokenUints[](vars.vestingEpochs - 1);
        for (uint256 i = currentEpoch + 1; i < currentEpoch + vars.vestingEpochs; i++) {
            (, , , vestedRewards[i - currentEpoch - 1]) = readEpochDataV2(lmV2Addr, i, user);
        }
    }

    function redeemRewardsV1(
        address lm,
        uint256 expiry,
        address user
    ) public virtual returns (PairTokenUints memory);

    function redeemRewardsV2(address lm, address user)
        public
        virtual
        returns (PairTokenUints memory);

    function getVars(address lmAddr) public view returns (Vars memory vars) {
        IPendleLiquidityMiningCommon liq = IPendleLiquidityMiningCommon(lmAddr);
        vars.startTime = liq.startTime();
        vars.epochDuration = liq.epochDuration();
        vars.currentEpoch = (block.timestamp - vars.startTime) / vars.epochDuration + 1;
        vars.timeLeftInEpoch =
            vars.epochDuration -
            ((block.timestamp - vars.startTime) % vars.epochDuration);
        vars.vestingEpochs = liq.vestingEpochs();
    }

    function readEpochDataV1(address lm, uint256 currentEpoch)
        public
        view
        virtual
        returns (PairTokenUints memory);

    function readEpochDataV2(
        address lm,
        uint256 currentEpoch,
        address user
    )
        public
        view
        virtual
        returns (
            uint256 totalStakeUnits,
            PairTokenUints memory epochRewards,
            uint256 userStakeUnits,
            PairTokenUints memory availableRewardsForUser
        );

    function readAvailableRewardsForUserV1(
        address lm,
        uint256 currentEpoch,
        address user
    ) public view virtual returns (PairTokenUints memory);
}
