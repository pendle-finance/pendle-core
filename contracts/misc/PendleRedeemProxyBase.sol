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
import "../libraries/TrioTokensLib.sol";
import "../libraries/PairTokensLib.sol";
import "../interfaces/IPendleLiquidityMining.sol";
import "../interfaces/IPendleLiquidityMiningMulti.sol";
import "../interfaces/IPendleLiquidityMiningV2.sol";
import "../interfaces/IPendleLiquidityMiningV2Multi.sol";
import "../interfaces/IPendleYieldToken.sol";
import "../interfaces/IPendleRewardManager.sol";
import "../interfaces/IPendleRewardManagerMulti.sol";
import "../interfaces/IPendleRetroactiveDistribution.sol";
import "../libraries/PairTokensLib.sol";
import "../libraries/TrioTokensLib.sol";

enum LmRedeemMode {
    INTEREST,
    REWARDS,
    BOTH
}

struct LmRedeemRequest {
    address addr;
    uint256 expiry;
    LmRedeemMode mode;
}

struct LmRedeemResult {
    PairTokenUints rewards;
    PairTokenUints interests;
}

struct Args {
    address[] yts;
    address[] ots;
    address[] markets;
    LmRedeemRequest[] lmV1;
    LmRedeemRequest[] lmV2;
    address[] tokensDistribution;
}

abstract contract PendleRedeemProxyBase {
    IPendleRouter public immutable router;
    IPendleRetroactiveDistribution public immutable tokenDistContract;

    constructor(IPendleRouter _router, IPendleRetroactiveDistribution _tokenDistContract) {
        router = _router;
        tokenDistContract = _tokenDistContract;
    }

    /// @dev only OTs that has rewards should be passed in. SushiSimple & JoeSimple OTs shouldn't be passed in
    function redeem(Args calldata args, address user)
        external
        returns (
            uint256[] memory ytInterests,
            TrioTokenUints[] memory otRewards,
            uint256[] memory marketInterests,
            LmRedeemResult[] memory lmV1Returns,
            LmRedeemResult[] memory lmV2Returns,
            uint256[] memory tokenDistReturns
        )
    {
        ytInterests = redeemYts(args.yts, user);
        otRewards = redeemOts(args.ots, user);
        marketInterests = redeemMarkets(args.markets, user);
        lmV1Returns = redeemLmV1(args.lmV1, user);
        lmV2Returns = redeemLmV2(args.lmV2, user);
        tokenDistReturns = redeemTokenDist(args.tokensDistribution, user);
    }

    function redeemYts(address[] calldata yts, address user)
        public
        returns (uint256[] memory ytInterests)
    {
        ytInterests = new uint256[](yts.length);
        for (uint256 i = 0; i < yts.length; i++) {
            IPendleYieldToken yt = IPendleYieldToken(yts[i]);
            bytes32 forgeId = IPendleForge(yt.forge()).forgeId();
            address underlyingAsset = yt.underlyingAsset();
            uint256 expiry = yt.expiry();
            ytInterests[i] = router.redeemDueInterests(forgeId, underlyingAsset, expiry, user);
        }
    }

    function redeemOts(address[] calldata ots, address user)
        public
        returns (TrioTokenUints[] memory otRewards)
    {
        otRewards = new TrioTokenUints[](ots.length);
        for (uint256 i = 0; i < ots.length; i++) {
            IPendleYieldToken ot = IPendleYieldToken(ots[i]);
            IPendleForge forge = IPendleForge(ot.forge());
            address rewardManager = address(forge.rewardManager());
            address underlyingAsset = ot.underlyingAsset();
            uint256 expiry = ot.expiry();
            otRewards[i] = _redeemFromRewardManager(
                address(forge),
                rewardManager,
                underlyingAsset,
                expiry,
                user
            );
        }
    }

    function redeemMarkets(address[] calldata markets, address user)
        public
        returns (uint256[] memory marketInterests)
    {
        uint256 marketCount = markets.length;
        marketInterests = new uint256[](marketCount);
        for (uint256 i = 0; i < marketCount; i++) {
            marketInterests[i] = router.redeemLpInterests(markets[i], user);
        }
    }

    function redeemTokenDist(address[] calldata tokens, address user)
        public
        returns (uint256[] memory results)
    {
        if (tokens.length != 0) results = tokenDistContract.redeem(tokens, payable(user));
    }

    function redeemLmV1(LmRedeemRequest[] calldata lm, address user)
        public
        returns (LmRedeemResult[] memory results)
    {
        uint256 len = lm.length;
        results = new LmRedeemResult[](len);
        for (uint256 i = 0; i < len; i++) {
            if (lm[i].mode == LmRedeemMode.INTEREST || lm[i].mode == LmRedeemMode.BOTH)
                results[i].interests = _redeemLmV1Interest(lm[i], user);
            if (lm[i].mode == LmRedeemMode.REWARDS || lm[i].mode == LmRedeemMode.BOTH)
                results[i].rewards = _redeemLmV1Rewards(lm[i], user);
        }
    }

    function redeemLmV2(LmRedeemRequest[] calldata lm, address user)
        public
        returns (LmRedeemResult[] memory results)
    {
        uint256 len = lm.length;
        results = new LmRedeemResult[](len);
        for (uint256 i = 0; i < len; i++) {
            if (lm[i].mode == LmRedeemMode.INTEREST || lm[i].mode == LmRedeemMode.BOTH)
                results[i].interests = _redeemLmV2Interest(lm[i], user);
            if (lm[i].mode == LmRedeemMode.REWARDS || lm[i].mode == LmRedeemMode.BOTH)
                results[i].rewards = _redeemLmV2Rewards(lm[i], user);
        }
    }

    function _redeemLmV1Interest(LmRedeemRequest calldata lm, address user)
        internal
        virtual
        returns (PairTokenUints memory);

    function _redeemLmV1Rewards(LmRedeemRequest calldata lm, address user)
        internal
        virtual
        returns (PairTokenUints memory);

    function _redeemLmV2Interest(LmRedeemRequest calldata lm, address user)
        internal
        virtual
        returns (PairTokenUints memory);

    function _redeemLmV2Rewards(LmRedeemRequest calldata lm, address user)
        internal
        virtual
        returns (PairTokenUints memory);

    function _redeemFromRewardManager(
        address forge,
        address rewardManager,
        address underlyingAsset,
        uint256 expiry,
        address user
    ) internal virtual returns (TrioTokenUints memory);
}
