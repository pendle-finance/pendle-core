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

pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "./IBenchmark.sol";
import "./IBenchmarkBaseToken.sol";
import {Utils} from "../libraries/BenchmarkLibrary.sol";


interface IBenchmarkMarket is IBenchmarkBaseToken {
    struct TokenReserve {
        uint256 weight;
        uint256 balance;
    }

    event Join(address indexed token, uint256 amount);

    event Exit(address indexed token, uint256 amount);

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

    function bootstrap(
        uint256 initialXytLiquidity,
        uint256 initialTokenLiquidity
    ) external returns (address, uint256);

    function joinMarketByAll(
        uint256 outAmountLp,
        uint256 maxInAmoutXyt,
        uint256 maxInAmountPair
    ) external;

    function exitMarketByAll(
        uint256 inAmountLp,
        uint256 minOutAmountXyt,
        uint256 minOutAmountPair
    ) external returns (uint256 xytOut, uint256 tokenOut) ;

    //function interestDistribute(address lp) returns (uint interestReturn);

    function exitMarketSingleToken(
        address outToken,
        uint256 inAmountLp,
        uint256 minOutAmountToken
    ) external returns (uint256 outAmountToken);

    function joinMarketSingleToken(
        address inToken,
        uint256 inAmount,
        uint256 minOutAmountLp
    ) external returns (uint256 outAmountLp);

    function swapAmountExactIn(
        address inToken,
        uint256 inAmount,
        address outToken,
        uint256 minOutAmount,
        uint256 maxPrice
    ) external returns (uint256 outAmount, uint256 spotPriceAfter);

    function swapAmountExactOut(
        address inToken,
        uint256 maxInAmount,
        address outToken,
        uint256 outAmount,
        uint256 maxPrice
    ) external returns (uint256 inAmount, uint256 spotPriceAfter);

    function calcInAmount(
        TokenReserve memory inTokenReserve,
        TokenReserve memory outTokenReserve,
        uint256 swapFee,
        uint256 outAmount
    ) external pure returns (uint256 inAmount);

    function calcOutAmount(
        TokenReserve memory inTokenReserve,
        TokenReserve memory outTokenReserve,
        uint256 swapFee,
        uint256 inAmount
    ) external pure returns (uint256 outAmount);

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
     * @dev Returns the address of the BenchmarkMarketFactory contract address.
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
