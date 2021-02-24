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

interface IPendleLiquidityMining {
    /**
     * @notice Stake an exact amount of LP_expiry
     **/
    function stake(uint256 expiry, uint256 amount) external returns (address);

    /**
     * @notice Withdraw an exact amount of LP_expiry
     **/
    function withdraw(uint256 expiry, uint256 amount) external;

    /**
     * @notice Get the pending rewards for a user
     * @return rewards Returns rewards[0] as the rewards available now, as well as rewards
     that can be claimed for subsequent epochs (size of rewards array is numberOfEpochs)
     **/
    function claimRewards() external returns (uint256[] memory rewards);

    /**
     * @notice Get the pending LP interests for a staker
     * @return _interests Returns the interest amount
     **/
    function claimLpInterests() external returns (uint256 _interests);

    /**
     * @notice Read the all the expiries that user has staked LP for
     **/
    function readUserExpiries(address user) external returns (uint256[] memory expiries);

    /**
     * @notice Read the amount of LP_expiry staked for a user
     **/
    function balances(address user, uint256 expiry) external returns (uint256);

    function startTime() external returns (uint256);

    function epochDuration() external returns (uint256);

    function rewardsPerEpoch() external returns (uint256);

    function numberOfEpochs() external returns (uint256);

    function vestingEpochs() external returns (uint256);

    function baseToken() external returns (address);

    function underlyingAsset() external returns (address);

    function marketFactoryId() external returns (bytes32);

    function forgeId() external returns (bytes32);
}
