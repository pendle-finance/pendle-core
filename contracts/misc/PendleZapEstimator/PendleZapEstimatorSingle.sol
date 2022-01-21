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

import "./PendleZapEstimator.sol";

// note that this contract should be called twice whenever it's used
contract PendleZapEstimatorSingle is PendleZapEstimator {
    using SafeMath for uint256;

    struct SingleTokenZapData {
        ZapMode mode;
        TokenizeData tknzData;
        uint256 inAmount;
        address[] underPath;
        address[] basePath;
        uint256 slippage;
    }

    constructor(IPendleData _pendleData, address _joeFactory)
        PendleZapEstimator(_pendleData, _joeFactory)
    {}

    function calcSingleTokenZapSwapInfo(SingleTokenZapData calldata data)
        external
        view
        returns (
            SwapInfo memory underInfo,
            SwapInfo memory baseInfo,
            BaseSplit memory split
        )
    {
        address under = getOutToken(data.underPath);
        address base = getOutToken(data.basePath);
        if (under == base) {
            return calcSameBaseAndUnder(data);
        } else {
            return calcDiffBaseAndUnder(data);
        }
    }

    function calcSameBaseAndUnder(SingleTokenZapData calldata data)
        public
        view
        returns (
            SwapInfo memory underInfo,
            SwapInfo memory baseInfo,
            BaseSplit memory split
        )
    {
        address base = getOutToken(data.basePath);

        uint256 tokenAmount = calcSwapAmountOut(data.inAmount, data.underPath, data.slippage)
            .amountOut;
        (uint256 low, uint256 high) = (0, tokenAmount);

        // convert all input tokens to base, then binary search on the amount to tknz
        while (low <= high) {
            uint256 amountUnderTknz = (low.add(high)).div(2);
            uint256 amountYO = amountUnderTknz;
            BaseSplit memory curSplit = getAmountBaseUsed(
                data.tknzData,
                base,
                amountYO,
                data.slippage,
                data.mode
            );
            if (curSplit.ot.add(curSplit.yt).add(amountUnderTknz) <= tokenAmount) {
                underInfo.amountOut = amountUnderTknz;
                baseInfo.amountOut = curSplit.ot.add(curSplit.yt);
                split = curSplit;
                low = amountUnderTknz.add(1);
            } else {
                high = amountUnderTknz.sub(1);
            }
        }
    }

    function calcDiffBaseAndUnder(SingleTokenZapData calldata data)
        public
        view
        returns (
            SwapInfo memory underInfo,
            SwapInfo memory baseInfo,
            BaseSplit memory split
        )
    {
        address base = getOutToken(data.basePath);

        (uint256 low, uint256 high) = (0, type(uint128).max);

        while (low <= high) {
            uint256 amountUnderTknz = (low.add(high)).div(2);
            uint256 amountYO = amountUnderTknz;
            BaseSplit memory curSplit = getAmountBaseUsed(
                data.tknzData,
                base,
                amountYO,
                data.slippage,
                data.mode
            );

            SwapInfo memory underSwapInfo = calcSwapAmountIn(
                amountUnderTknz,
                data.underPath,
                data.slippage
            );
            SwapInfo memory baseSwapInfo = calcSwapAmountIn(
                curSplit.ot.add(curSplit.yt),
                data.basePath,
                data.slippage
            );

            if (underSwapInfo.amountIn.add(baseSwapInfo.amountIn) <= data.inAmount) {
                underInfo = underSwapInfo;
                baseInfo = baseSwapInfo;
                split = curSplit;
                low = amountUnderTknz.add(1);
            } else {
                high = amountUnderTknz.sub(1);
            }
        }
    }
}
