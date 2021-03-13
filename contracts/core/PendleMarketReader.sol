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
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../libraries/MathLib.sol";
import "../interfaces/IPendleRouter.sol";
import "../interfaces/IPendleData.sol";
import "../interfaces/IPendleMarket.sol";

contract PendleMarketReader {
    using SafeMath for uint256;

    struct Market {
        uint256 tokenBalanceIn;
        uint256 tokenWeightIn;
        uint256 tokenBalanceOut;
        uint256 tokenWeightOut;
        uint256 swapFee;
        uint256 effectiveLiquidity;
        address market;
    }

    IPendleData public data;

    constructor(IPendleData _data) {
        data = _data;
    }

    /**
    * @dev no wrapping here since users must be aware of the market they are querying against.
        For example, if they want to query market WETH/XYT, they must pass in WETH & XYT
        and not ETH & XYT
     */
    function getMarketRateExactIn(
        address _tokenIn,
        address _tokenOut,
        uint256 _inSwapAmount,
        bytes32 _marketFactoryId
    ) public view returns (IPendleRouter.Swap memory swap, uint256 outSwapAmount) {
        address market = data.getMarketFromKey(_tokenIn, _tokenOut, _marketFactoryId);
        Market memory marketData = _getMarketData(_tokenIn, _tokenOut, market);

        outSwapAmount = _calcExactOut(_inSwapAmount, marketData);

        swap = IPendleRouter.Swap({
            market: market,
            tokenIn: _tokenIn,
            tokenOut: _tokenOut,
            swapAmount: _inSwapAmount,
            limitReturnAmount: 0,
            maxPrice: type(uint256).max
        });

        return (swap, outSwapAmount);
    }

    /**
     * @dev no wrapping here for the same reason as getMarketRateExactIn
     */
    function getMarketRateExactOut(
        address _tokenIn,
        address _tokenOut,
        uint256 _outSwapAmount,
        bytes32 _marketFactoryId
    ) public view returns (IPendleRouter.Swap memory swap, uint256 inSwapAmount) {
        address market = data.getMarketFromKey(_tokenIn, _tokenOut, _marketFactoryId);
        Market memory marketData = _getMarketData(_tokenIn, _tokenOut, market);

        inSwapAmount = _calcExactIn(_outSwapAmount, marketData);

        swap = IPendleRouter.Swap({
            market: market,
            tokenIn: _tokenIn,
            tokenOut: _tokenOut,
            swapAmount: inSwapAmount,
            limitReturnAmount: type(uint256).max,
            maxPrice: type(uint256).max
        });

        return (swap, inSwapAmount);
    }

    /**
     * @dev no wrapping here for the same reason as getMarketRateExactIn
     */
    function getMarketReserves(
        bytes32 _marketFactoryId,
        address _xyt,
        address _token
    )
        public
        view
        returns (
            uint256 xytAmount,
            uint256 tokenAmount,
            uint256 currentTime
        )
    {
        IPendleMarket market = IPendleMarket(data.getMarket(_marketFactoryId, _xyt, _token));
        require(address(market) != address(0), "MARKET_NOT_FOUND");
        (xytAmount, tokenAmount, currentTime) = market.getReserves();
    }

    function getMarketTokenAddresses(address _market)
        public
        view
        returns (address token, address xyt)
    {
        require(address(_market) != address(0), "MARKET_NOT_FOUND");

        IPendleMarket pendleMarket = IPendleMarket(_market);
        token = pendleMarket.token();
        xyt = pendleMarket.xyt();
    }

    function _getMarketData(
        address _tokenIn,
        address _tokenOut,
        address marketAddress
    ) internal view returns (Market memory) {
        IPendleMarket market = IPendleMarket(marketAddress);
        uint256 tokenBalanceIn = market.getBalance(_tokenIn);
        uint256 tokenBalanceOut = market.getBalance(_tokenOut);
        uint256 tokenWeightIn = market.getWeight(_tokenIn);
        uint256 tokenWeightOut = market.getWeight(_tokenOut);

        uint256 effectiveLiquidity =
            _calcEffectiveLiquidity(tokenWeightIn, tokenBalanceOut, tokenWeightOut);
        Market memory returnMarket =
            Market({
                market: marketAddress,
                tokenBalanceIn: tokenBalanceIn,
                tokenWeightIn: tokenWeightIn,
                tokenBalanceOut: tokenBalanceOut,
                tokenWeightOut: tokenWeightOut,
                swapFee: data.swapFee(),
                effectiveLiquidity: effectiveLiquidity
            });

        return returnMarket;
    }

    function _calcExactIn(uint256 outAmount, Market memory market)
        internal
        view
        returns (uint256 totalInput)
    {
        IPendleMarket.TokenReserve memory inTokenReserve;
        IPendleMarket.TokenReserve memory outTokenReserve;

        inTokenReserve.balance = market.tokenBalanceIn;
        inTokenReserve.weight = market.tokenWeightIn;
        outTokenReserve.balance = market.tokenBalanceOut;
        outTokenReserve.weight = market.tokenWeightOut;

        totalInput = IPendleMarket(market.market).calcExactIn(
            inTokenReserve,
            outTokenReserve,
            outAmount,
            data.swapFee()
        );
    }

    function _calcExactOut(uint256 inAmount, Market memory market)
        internal
        view
        returns (uint256 totalOutput)
    {
        IPendleMarket.TokenReserve memory inTokenReserve;
        IPendleMarket.TokenReserve memory outTokenReserve;

        inTokenReserve.balance = market.tokenBalanceIn;
        inTokenReserve.weight = market.tokenWeightIn;
        outTokenReserve.balance = market.tokenBalanceOut;
        outTokenReserve.weight = market.tokenWeightOut;

        totalOutput = IPendleMarket(market.market).calcExactOut(
            inTokenReserve,
            outTokenReserve,
            inAmount,
            data.swapFee()
        );
    }

    function _calcEffectiveLiquidity(
        uint256 tokenWeightIn,
        uint256 tokenBalanceOut,
        uint256 tokenWeightOut
    ) internal pure returns (uint256 effectiveLiquidity) {
        effectiveLiquidity = tokenWeightIn
            .mul(Math.RONE)
            .div(tokenWeightOut.add(tokenWeightIn))
            .mul(tokenBalanceOut)
            .div(Math.RONE);

        return effectiveLiquidity;
    }
}
