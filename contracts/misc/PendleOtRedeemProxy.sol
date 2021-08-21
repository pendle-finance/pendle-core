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

import "../interfaces/IPendleRewardManager.sol";
import "../interfaces/IPendleForge.sol";
import "../interfaces/IPendleYieldToken.sol";

contract PendleOtRedeemProxy {
    function redeem(address[] calldata _ots, address _user)
        external
        returns (uint256[] memory rewards)
    {
        rewards = new uint256[](_ots.length);
        for (uint256 i = 0; i < _ots.length; i++) {
            IPendleYieldToken ot = IPendleYieldToken(_ots[i]);
            IPendleForge forge = IPendleForge(ot.forge());
            IPendleRewardManager rewardManager = forge.rewardManager();
            address underlyingAsset = ot.underlyingAsset();
            uint256 expiry = ot.expiry();
            rewards[i] = rewardManager.redeemRewards(underlyingAsset, expiry, _user);
        }
    }
}
