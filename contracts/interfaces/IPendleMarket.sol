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

import "./IPendleRouter.sol";
import "./IPendleBaseToken.sol";

interface IPendleMarket is IPendleBaseToken {
    struct TokenReserve {
        uint256 weight;
        uint256 balance;
    }

    event Join(address indexed token, uint256 amount);

    event Exit(address indexed token, uint256 amount);
    /**
     * @notice Emitted when reserves pool has been updated
     * @param reserve0 The XYT reserves.
     * @param weight0  The XYT weight
     * @param reserve1 The generic token reserves.
     * @param weight1  The generic token weight
     **/
    event Sync(uint256 reserve0, uint256 weight0, uint256 reserve1, uint256 weight1);

    event Shift(
        uint256 xytWeightOld,
        uint256 tokenWeightOld,
        uint256 xytWeightNew,
        uint256 tokenWeightNew
    );

    /**
     * @notice Emitted when a swap happens on the market.
     * @param inToken The source token being traded.
     * @param inAmount The source amount being traded.
     * @param outToken The destination token received.
     * @param outAmount The destination amount received.
     **/
    event Swap(
        address indexed inToken,
        uint256 inAmount,
        address indexed outToken,
        uint256 outAmount
    );

    function bootstrap(uint256 initialXytLiquidity, uint256 initialTokenLiquidity)
        external
        returns (uint256);

    function addMarketLiquidityAll(
        uint256 exactOutLp,
        uint256 maxInXyt,
        uint256 maxInToken
    ) external returns (uint256 amountXytUsed, uint256 amountTokenUsed);

    function addMarketLiquiditySingle(
        address inToken,
        uint256 inAmount,
        uint256 minOutLp
    ) external returns (uint256 exactOutLp);

    function removeMarketLiquidityAll(
        uint256 inLp,
        uint256 minOutXyt,
        uint256 minOutToken
    ) external returns (uint256 xytOut, uint256 tokenOut);

    function removeMarketLiquiditySingle(
        address outToken,
        uint256 exactInLp,
        uint256 minOutToken
    ) external returns (uint256 exactOutToken);

    function swapExactIn(
        address inToken,
        uint256 inAmount,
        address outToken,
        uint256 minOutAmount,
        uint256 maxPrice
    ) external returns (uint256 outAmount, uint256 spotPriceAfter);

    function swapExactOut(
        address inToken,
        uint256 maxInAmount,
        address outToken,
        uint256 outAmount,
        uint256 maxPrice
    ) external returns (uint256 inAmount, uint256 spotPriceAfter);

    function claimLpInterests(address account) external returns (uint256 interests);

    function calcExactIn(
        TokenReserve memory inTokenReserve,
        TokenReserve memory outTokenReserve,
        uint256 outAmount,
        uint256 swapFee
    ) external pure returns (uint256 exactIn);

    function calcExactOut(
        TokenReserve memory inTokenReserve,
        TokenReserve memory outTokenReserve,
        uint256 exactIn,
        uint256 swapFee
    ) external pure returns (uint256 exactOut);

    function getReserves()
        external
        view
        returns (
            uint256 xytReserves,
            uint256 tokenReserves,
            uint256 lastBlockTimestamp
        );

    function getBalance(address asset) external view returns (uint256);

    function getWeight(address asset) external view returns (uint256);

    function spotPrice(address inToken, address outToken) external view returns (uint256 spot);

    /**
     * @dev Returns the address of the PendleMarketFactory contract address.
     * @return Returns the factory's address.
     **/
    function factory() external view returns (address);

    /**
     * @notice Gets the forge address where the XYT was minted.
     * @return Returns the forge address.
     **/
    function forge() external view returns (address);

    function token() external view returns (address);

    function xyt() external view returns (address);
}
