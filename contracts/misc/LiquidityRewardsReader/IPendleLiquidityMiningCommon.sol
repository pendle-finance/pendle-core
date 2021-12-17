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

interface IPendleLiquidityMiningCommon {
    function startTime() external view returns (uint256);

    function epochDuration() external view returns (uint256);

    function readExpirySpecificEpochData(uint256 epochId, uint256 expiry)
        external
        view
        returns (uint256 stakeUnits, uint256 lastUpdatedForExpiry);

    function readStakeUnitsForUser(
        uint256 epochId,
        address user,
        uint256 expiry
    ) external view returns (uint256 stakeUnitsForUser);

    function getBalances(uint256 expiry, address user) external view returns (uint256);

    function readExpiryData(uint256 expiry)
        external
        view
        returns (
            uint256 totalStakeLP,
            uint256 lastNYield,
            uint256 paramL,
            address lpHolder
        );

    function latestSetting() external view returns (uint256 id, uint256 firstEpochToApply);

    function allocationSettings(uint256 settingId, uint256 expiry)
        external
        view
        returns (uint256 rate);

    function vestingEpochs() external view returns (uint256);
}
