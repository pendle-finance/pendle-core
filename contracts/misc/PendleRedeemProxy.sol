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

import "../interfaces/IPendleRouter.sol";
import "../interfaces/IPendleForge.sol";
import "../interfaces/IPendleLiquidityMining.sol";
import "../interfaces/IPendleYieldToken.sol";

contract PendleRedeemProxy {
    IPendleRouter public immutable router;

    constructor(address _router) {
        require(_router != address(0), "ZERO_ADDRESS");
        router = IPendleRouter(_router);
    }

    function redeem(
        address[] calldata _xyts,
        address[] calldata _markets,
        address[] calldata _liqMiningContracts,
        uint256[] calldata _expiries,
        uint256 _liqMiningRewardsCount
    )
        external
        returns (
            uint256[] memory xytInterests,
            uint256[] memory marketInterests,
            uint256[] memory rewards,
            uint256[] memory liqMiningInterests
        )
    {
        xytInterests = redeemXyts(_xyts);
        marketInterests = redeemMarkets(_markets);

        (rewards, liqMiningInterests) = redeemLiqMining(
            _liqMiningContracts,
            _expiries,
            _liqMiningRewardsCount
        );
    }

    function redeemXyts(address[] calldata xyts) public returns (uint256[] memory xytInterests) {
        xytInterests = new uint256[](xyts.length);
        for (uint256 i = 0; i < xyts.length; i++) {
            IPendleYieldToken xyt = IPendleYieldToken(xyts[i]);
            bytes32 forgeId = IPendleForge(xyt.forge()).forgeId();
            address underlyingAsset = xyt.underlyingAsset();
            uint256 expiry = xyt.expiry();
            xytInterests[i] = router.redeemDueInterests(
                forgeId,
                underlyingAsset,
                expiry,
                msg.sender
            );
        }
    }

    function redeemMarkets(address[] calldata markets)
        public
        returns (uint256[] memory marketInterests)
    {
        uint256 marketCount = markets.length;
        marketInterests = new uint256[](marketCount);
        for (uint256 i = 0; i < marketCount; i++) {
            marketInterests[i] = router.redeemLpInterests(markets[i], msg.sender);
        }
    }

    function redeemLiqMining(
        address[] calldata liqMiningContracts,
        uint256[] calldata expiries,
        uint256 liqMiningRewardsCount
    ) public returns (uint256[] memory rewards, uint256[] memory liqMiningInterests) {
        require(liqMiningRewardsCount <= liqMiningContracts.length, "INVALID_REWARDS_COUNT");
        require(expiries.length == liqMiningContracts.length, "ARRAY_LENGTH_MISMATCH");

        rewards = new uint256[](liqMiningRewardsCount);
        for (uint256 i = 0; i < liqMiningRewardsCount; i++) {
            rewards[i] = IPendleLiquidityMining(liqMiningContracts[i]).redeemRewards(
                expiries[i],
                msg.sender
            );
        }

        uint256 liqMiningInterestsCount = liqMiningContracts.length - liqMiningRewardsCount;
        liqMiningInterests = new uint256[](liqMiningInterestsCount);
        for (uint256 i = 0; i < liqMiningInterestsCount; i++) {
            uint256 arrayIndex = i + liqMiningRewardsCount;
            liqMiningInterests[i] = IPendleLiquidityMining(liqMiningContracts[arrayIndex])
                .redeemLpInterests(expiries[arrayIndex], msg.sender);
        }
    }
}
