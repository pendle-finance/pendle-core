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

import "../interfaces/IPendleRouter.sol";
import "../interfaces/IPendleForge.sol";
import "../core/abstract/PendleLiquidityMiningBase.sol";
import "../interfaces/IPendleLiquidityMiningV2.sol";
import "../interfaces/IPendleYieldToken.sol";
import "hardhat/console.sol";

contract PendleRedeemProxy {
    IPendleRouter public immutable router;

    constructor(address _router) {
        require(_router != address(0), "ZERO_ADDRESS");
        router = IPendleRouter(_router);
    }

    struct Args {
        address[] xyts;
        address[] markets;
        address[] lmContractsForRewards;
        uint256[] expiriesForRewards;
        address[] lmContractsForInterests;
        uint256[] expiriesForInterests;
        address[] lmV2ContractsForRewards;
        address[] lmV2ContractsForInterests;
    }

    function redeem(Args calldata args, address user)
        external
        returns (
            uint256[] memory xytInterests,
            uint256[] memory marketInterests,
            uint256[] memory lmRewards,
            uint256[] memory lmInterests,
            uint256[] memory lmV2Rewards,
            uint256[] memory lmV2Interests
        )
    {
        xytInterests = redeemXyts(args.xyts);
        marketInterests = redeemMarkets(args.markets);

        lmRewards = redeemLmRewards(args.lmContractsForRewards, args.expiriesForRewards, user);

        lmInterests = redeemLmInterests(
            args.lmContractsForInterests,
            args.expiriesForInterests,
            user
        );

        lmV2Rewards = redeemLmV2Rewards(args.lmV2ContractsForRewards, user);

        lmV2Interests = redeemLmV2Interests(args.lmV2ContractsForInterests, user);
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

    function redeemLmRewards(
        address[] calldata lmContractsForRewards,
        uint256[] calldata expiriesForRewards,
        address user
    ) public returns (uint256[] memory lmRewards) {
        uint256 count = expiriesForRewards.length;
        require(count == lmContractsForRewards.length, "ARRAY_LENGTH_MISMATCH");

        lmRewards = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            (, , , uint256 lastParamL, ) = PendleLiquidityMiningBase(lmContractsForRewards[i])
            .readUserSpecificExpiryData(expiriesForRewards[i], user);
            if (lastParamL == 0) {
                lmRewards[i] = 0;
            } else {
                lmRewards[i] = PendleLiquidityMiningBase(lmContractsForRewards[i]).redeemRewards(
                    expiriesForRewards[i],
                    user
                );
            }
        }
    }

    function redeemLmInterests(
        address[] calldata lmContractsForInterests,
        uint256[] calldata expiriesForInterests,
        address user
    ) public returns (uint256[] memory lmInterests) {
        uint256 count = expiriesForInterests.length;
        require(count == lmContractsForInterests.length, "ARRAY_LENGTH_MISMATCH");

        lmInterests = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            lmInterests[i] = IPendleLiquidityMining(lmContractsForInterests[i]).redeemLpInterests(
                expiriesForInterests[i],
                user
            );
        }
    }

    function redeemLmV2Rewards(address[] calldata lmV2ContractsForRewards, address user)
        public
        returns (uint256[] memory lmV2Rewards)
    {
        uint256 count = lmV2ContractsForRewards.length;

        lmV2Rewards = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            lmV2Rewards[i] = IPendleLiquidityMiningV2(lmV2ContractsForRewards[i]).redeemRewards(
                user
            );
        }
    }

    function redeemLmV2Interests(address[] calldata lmV2ContractsForInterests, address user)
        public
        returns (uint256[] memory lmV2Interests)
    {
        uint256 count = lmV2ContractsForInterests.length;

        lmV2Interests = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            lmV2Interests[i] = IPendleLiquidityMiningV2(lmV2ContractsForInterests[i])
            .redeemDueInterests(user);
        }
    }
}
