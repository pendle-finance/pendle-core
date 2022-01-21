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
import "./PAPLibrary.sol";

contract PendleZapEstimatorPAP is PendleZapEstimator {
    using SafeMath for uint256;
    using Math for uint256;
    using PAPLib for PAPReserves;

    struct DoubleTokenZapData {
        ZapMode mode;
        TokenizeData tknzData;
        uint256 inAmount;
        address[] wavaxPath;
        address[] pendlePath;
        uint256 slippage;
    }

    address public constant WAVAX = 0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7;
    address public constant PENDLE = 0xfB98B335551a418cD0737375a2ea0ded62Ea213b;

    constructor(IPendleData _pendleData, address _joeFactory)
        PendleZapEstimator(_pendleData, _joeFactory)
    {}

    function calcPapZapSwapInfo(DoubleTokenZapData calldata data)
        external
        view
        returns (
            SwapInfo memory wavaxInfo,
            SwapInfo memory pendleInfo,
            PAPReserves memory amountToMintLP,
            BaseSplit memory split
        )
    {
        require(isAvaxOrWavax(getOutToken(data.wavaxPath)), "INVALID_PATH");
        require(getOutToken(data.pendlePath) == PENDLE, "INVALID_PATH");

        PAPReserves memory reserve;
        (reserve.wavax, reserve.pendle) = JoeLibrary.getReserves(joeFactory, WAVAX, PENDLE);
        (uint256 low, uint256 high) = (0, data.inAmount);

        while (low < high) {
            // mid is amountUsedForWavax
            uint256 mid = (low.add(high).add(1)).div(2);
            (, pendleInfo, amountToMintLP, split) = swapAndZap(data, reserve, mid);
            uint256 totalPendleNeeded = amountToMintLP.pendle.add(split.ot).add(split.yt);
            if (totalPendleNeeded <= pendleInfo.amountOut) {
                low = mid;
            } else {
                high = mid.sub(1);
            }
        }
        (wavaxInfo, pendleInfo, amountToMintLP, split) = swapAndZap(data, reserve, low);
    }

    function swapAndZap(
        DoubleTokenZapData calldata data,
        PAPReserves memory rawReserve,
        uint256 amountUsedForWavax
    )
        public
        view
        returns (
            SwapInfo memory wavaxInfo,
            SwapInfo memory pendleInfo,
            PAPReserves memory amountToMintLP,
            BaseSplit memory split
        )
    {
        PAPReserves memory pap = PAPReserves(rawReserve.wavax, rawReserve.pendle);
        uint256 amountUsedForPendle = data.inAmount - amountUsedForWavax;

        // It's guaranteed that only one of these 2 calc will affect PAP pool
        wavaxInfo = simulateSwapExactIn(pap, amountUsedForWavax, data.wavaxPath, data.slippage);
        pendleInfo = simulateSwapExactIn(pap, amountUsedForPendle, data.pendlePath, data.slippage);

        amountToMintLP.wavax = wavaxInfo.amountOut;
        amountToMintLP.pendle = quote(amountToMintLP.wavax, pap.wavax, pap.pendle);
        split = getAmountBaseUsed(
            data.tknzData,
            PENDLE,
            getAmountYO(pap, amountToMintLP.wavax, amountToMintLP.pendle),
            data.slippage,
            data.mode
        );
    }

    function simulateSwapExactIn(
        PAPReserves memory pap,
        uint256 exactIn,
        address[] memory path,
        uint256 slippage
    ) public view returns (SwapInfo memory swapInfo) {
        require(path.length >= 1, "PATH_LENGTH_ZERO");
        if (path.length == 1) {
            swapInfo.amountIn = exactIn;
            swapInfo.amountOut = exactIn;
        } else {
            uint256[] memory amounts = JoeLibrary.getAmountsOut(joeFactory, exactIn, path);
            swapInfo.amountIn = exactIn;
            swapInfo.amountOut = downSlippage(amounts[path.length - 1], slippage);
            if (PAPLib.isSwapAvaxToPendle(path)) {
                pap.wavax = pap.wavax.add(amounts[path.length - 2]);
                pap.pendle = pap.pendle.sub(amounts[path.length - 1]);
            } else if (PAPLib.isSwapPendleToAvax(path)) {
                pap.pendle = pap.pendle.add(amounts[0]);
                pap.wavax = pap.wavax.sub(amounts[1]);
            }
        }
    }

    function getAmountYO(
        PAPReserves memory pap,
        uint256 wavaxAmount,
        uint256 pendleAmount
    ) public view returns (uint256 amountYO) {
        amountYO = pap.getAmountLpOut(wavaxAmount, pendleAmount).rmul(pap.getExchangeRate());
    }

    function isAvaxOrWavax(address token) internal pure returns (bool) {
        return (token == JoeLibrary.AVAX || token == JoeLibrary.WAVAX);
    }
}
