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

contract PendleLiquidityRewardsProxy {
    function redeemLiquidityRewards(
        PendleLiquidityMiningBase liqMiningContract,
        uint256[] calldata expiries,
        address user
    )
        external
        returns (
            uint256 rewards,
            uint256[] memory pendingRewards,
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

        pendingRewards = new uint256[](vestingEpochs - 1);
        for (
            uint256 epochId = currentEpoch + 1;
            epochId < currentEpoch + vestingEpochs;
            epochId++
        ) {
            pendingRewards[epochId - currentEpoch - 1] = liqMiningContract
                .readAvailableRewardsForUser(epochId, user);
        }
    }
}
