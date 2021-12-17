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

import "./PendleLiquidityRewardsReaderBase.sol";
import "../../core/abstract/PendleLiquidityMiningBaseMulti.sol";
import "../../core/abstractV2/PendleLiquidityMiningBaseV2Multi.sol";

contract PendleLiquidityRewardsReaderMulti is PendleLiquidityRewardsReaderBase {
    function redeemRewardsV1(
        address lm,
        uint256 expiry,
        address user
    ) public override returns (PairTokenUints memory res) {
        res.tokens = PendleLiquidityMiningBaseMulti(lm).readRewardTokens();
        res.uints = PendleLiquidityMiningBaseMulti(lm).redeemRewards(expiry, user);
    }

    function redeemRewardsV2(address lm, address user)
        public
        virtual
        override
        returns (PairTokenUints memory res)
    {
        res.tokens = PendleLiquidityMiningBaseV2Multi(lm).readRewardTokens();
        res.uints = PendleLiquidityMiningBaseV2Multi(lm).redeemRewards(user);
    }

    function readAvailableRewardsForUserV1(
        address lm,
        uint256 currentEpoch,
        address user
    ) public view virtual override returns (PairTokenUints memory res) {
        res.tokens = PendleLiquidityMiningBaseMulti(lm).readRewardTokens();
        res.uints = PendleLiquidityMiningBaseMulti(lm).readAvailableRewardsForUser(
            currentEpoch,
            user
        );
    }

    function readEpochDataV2(
        address lm,
        uint256 currentEpoch,
        address user
    )
        public
        view
        virtual
        override
        returns (
            uint256 totalStakeUnits,
            PairTokenUints memory epochRewards,
            uint256 userStakeUnits,
            PairTokenUints memory availableRewardsForUser
        )
    {
        (
            totalStakeUnits,
            epochRewards.uints,
            ,
            userStakeUnits,
            availableRewardsForUser.uints
        ) = PendleLiquidityMiningBaseV2Multi(lm).readEpochData(currentEpoch, user);
        epochRewards.tokens = PendleLiquidityMiningBaseV2Multi(lm).readRewardTokens();
        availableRewardsForUser.tokens = PendleLiquidityMiningBaseV2Multi(lm).readRewardTokens();
    }

    function readEpochDataV1(address lm, uint256 currentEpoch)
        public
        view
        override
        returns (PairTokenUints memory res)
    {
        res.tokens = PendleLiquidityMiningBaseMulti(lm).readRewardTokens();
        (, res.uints) = PendleLiquidityMiningBaseMulti(lm).readEpochData(currentEpoch);
    }
}
