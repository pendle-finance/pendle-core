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

import "./PendleRedeemProxyBase.sol";

contract PendleRedeemProxySingle is PendleRedeemProxyBase {
    constructor(IPendleRouter _router, IPendleRetroactiveDistribution _tokenDistContract)
        PendleRedeemProxyBase(_router, _tokenDistContract)
    {}

    function _redeemLmV1Interest(LmRedeemRequest calldata lm, address user)
        internal
        virtual
        override
        returns (PairTokenUints memory res)
    {
        res.tokens.tokenA = IPendleLiquidityMining(lm.addr).underlyingYieldToken();
        res.uints.uintA = IPendleLiquidityMining(lm.addr).redeemLpInterests(lm.expiry, user);
    }

    function _redeemLmV1Rewards(LmRedeemRequest calldata lm, address user)
        internal
        virtual
        override
        returns (PairTokenUints memory res)
    {
        res.tokens.tokenA = IPendleLiquidityMining(lm.addr).pendleTokenAddress();
        res.uints.uintA = IPendleLiquidityMining(lm.addr).redeemRewards(lm.expiry, user);
    }

    function _redeemLmV2Interest(LmRedeemRequest calldata lm, address user)
        internal
        virtual
        override
        returns (PairTokenUints memory res)
    {
        res.tokens.tokenA = IPendleLiquidityMiningV2(lm.addr).yieldToken();
        res.uints.uintA = IPendleLiquidityMiningV2(lm.addr).redeemDueInterests(user);
    }

    function _redeemLmV2Rewards(LmRedeemRequest calldata lm, address user)
        internal
        virtual
        override
        returns (PairTokenUints memory res)
    {
        res.tokens.tokenA = IPendleLiquidityMiningV2(lm.addr).pendleTokenAddress();
        res.uints.uintA = IPendleLiquidityMiningV2(lm.addr).redeemRewards(user);
    }

    function _redeemFromRewardManager(
        address forge,
        address rewardManager,
        address underlyingAsset,
        uint256 expiry,
        address user
    ) internal virtual override returns (TrioTokenUints memory res) {
        res.uints.uintA = IPendleRewardManager(rewardManager).redeemRewards(
            underlyingAsset,
            expiry,
            user
        );
        res.tokens.tokenA = address(IPendleForge(forge).rewardToken());
    }
}
