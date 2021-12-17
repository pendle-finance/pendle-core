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

import "../libraries/PairTokensLib.sol";
import "../interfaces/IWETH.sol";

interface IPendleLiquidityMiningV2Multi {
    event Funded(PairUints[] rewards, uint256 numberOfEpochs);
    event RewardsToppedUp(uint256[] epochIds, PairUints[] rewards);
    event Staked(address user, uint256 amount);
    event Withdrawn(address user, uint256 amount);
    event PendleRewardsSettled(address user, PairUints amount);

    function fund(PairUints[] calldata rewards) external;

    function topUpRewards(uint256[] calldata epochIds, PairUints[] calldata rewards) external;

    function stake(address forAddr, uint256 amount) external;

    function withdraw(address toAddr, uint256 amount) external;

    function redeemRewards(address user) external returns (PairUints memory rewards);

    function redeemDueInterests(address user) external returns (PairUints memory amountOut);

    function setUpEmergencyMode(address spender, bool) external;

    function updateAndReadEpochData(uint256 epochId, address user)
        external
        returns (
            uint256 totalStakeUnits,
            PairUints memory totalRewards,
            uint256 lastUpdated,
            uint256 stakeUnitsForUser,
            PairUints memory availableRewardsForUser
        );

    function balances(address user) external view returns (uint256);

    function startTime() external view returns (uint256);

    function epochDuration() external view returns (uint256);

    function readEpochData(uint256 epochId, address user)
        external
        view
        returns (
            uint256 totalStakeUnits,
            PairUints memory totalRewards,
            uint256 lastUpdated,
            uint256 stakeUnitsForUser,
            PairUints memory availableRewardsForUser
        );

    function numberOfEpochs() external view returns (uint256);

    function vestingEpochs() external view returns (uint256);

    function stakeToken() external view returns (address);

    function totalStake() external view returns (uint256);

    function readYieldTokens() external view returns (PairTokens memory);

    function readRewardTokens() external view returns (PairTokens memory);
}
