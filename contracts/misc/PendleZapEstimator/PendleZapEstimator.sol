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
import "../../libraries/JoeLibrary.sol";
import "../../libraries/MarketMath.sol";
import "../../interfaces/IPendleData.sol";
import "../../interfaces/IPendleMarket.sol";
import "../../interfaces/IJoePair.sol";

abstract contract PendleZapEstimator {
    using SafeMath for uint256;
    using Math for uint256;

    enum ZapMode {
        ONLY_OT,
        ONLY_YT,
        BOTH
    }

    struct TokenizeData {
        bytes32 marketFactoryId;
        bytes32 forgeId;
        address underAsset;
        uint256 expiry;
    }

    struct SwapInfo {
        uint256 amountIn;
        uint256 amountOut;
    }

    struct BaseSplit {
        uint256 yt;
        uint256 ot;
    }

    address public constant MEMO = 0x0da67235dD5787D67955420C84ca1cEcd4E5Bb3b;
    address public constant TIME = 0xb54f16fB19478766A268F172C9480f8da1a7c9C3;

    uint256 public constant SLIPPAGE_DECIMAL = 1_000_000;
    IPendleData public immutable pendleData;
    address public immutable joeFactory;

    constructor(IPendleData _pendleData, address _joeFactory) {
        pendleData = _pendleData;
        joeFactory = _joeFactory;
    }

    function calcSwapAmountOut(
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
        }
    }

    function calcSwapAmountIn(
        uint256 exactOut,
        address[] memory path,
        uint256 slippage
    ) public view returns (SwapInfo memory swapInfo) {
        require(path.length >= 1, "PATH_LENGTH_ZERO");
        if (path.length == 1) {
            swapInfo.amountIn = exactOut;
            swapInfo.amountOut = exactOut;
        } else {
            uint256[] memory amounts = JoeLibrary.getAmountsIn(joeFactory, exactOut, path);
            swapInfo.amountIn = upSlippage(amounts[0], slippage);
            swapInfo.amountOut = exactOut;
        }
    }

    function getAmountBaseUsed(
        TokenizeData calldata tknzData,
        address base,
        uint256 amountYO,
        uint256 slippage,
        ZapMode mode
    ) public view returns (BaseSplit memory baseAmounts) {
        if (amountYO == 0) return BaseSplit(0, 0);
        (address ot, IPendleMarket market) = getOtandYtMarket(tknzData, base);
        if (mode == ZapMode.ONLY_YT || mode == ZapMode.BOTH) {
            (uint256 xytBal, , uint256 baseBal, , ) = market.getReserves();
            baseAmounts.yt = upSlippage(quote(amountYO, xytBal, baseBal), slippage);
        }
        if (mode == ZapMode.ONLY_OT || mode == ZapMode.BOTH) {
            (uint256 otBal, uint256 baseBal) = JoeLibrary.getReserves(joeFactory, ot, base);
            baseAmounts.ot = upSlippage(quote(amountYO, otBal, baseBal), slippage);
        }
    }

    function getOtandYtMarket(TokenizeData calldata tknzData, address base)
        public
        view
        returns (address ot, IPendleMarket market)
    {
        address underAsset = (tknzData.underAsset == TIME ? MEMO : tknzData.underAsset);
        ot = address(pendleData.otTokens(tknzData.forgeId, underAsset, tknzData.expiry));
        address yt = address(pendleData.xytTokens(tknzData.forgeId, underAsset, tknzData.expiry));
        market = IPendleMarket(pendleData.getMarket(tknzData.marketFactoryId, yt, base));
    }

    function quote(
        uint256 amountA,
        uint256 reserveA,
        uint256 reserveB
    ) public pure returns (uint256 amountB) {
        require(amountA > 0, "INSUFFICIENT_AMOUNT");
        require(reserveA > 0 && reserveB > 0, "INSUFFICIENT_LIQUIDITY");
        amountB = amountA.mul(reserveB).div(reserveA);
    }

    function getOutToken(address[] memory path) public pure returns (address) {
        return path[path.length - 1];
    }

    function upSlippage(uint256 value, uint256 slippage)
        public
        pure
        returns (uint256 valueAfterSlippage)
    {
        return value.mul(SLIPPAGE_DECIMAL.add(slippage)).div(SLIPPAGE_DECIMAL);
    }

    function downSlippage(uint256 value, uint256 slippage)
        public
        pure
        returns (uint256 valueAfterSlippage)
    {
        return value.mul(SLIPPAGE_DECIMAL).div(SLIPPAGE_DECIMAL.add(slippage));
    }
}
