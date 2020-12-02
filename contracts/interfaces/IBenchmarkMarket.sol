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

import "./IBenchmarkProvider.sol";
import "./IBenchmarkBaseToken.sol";

interface IBenchmarkMarket is IBenchmarkBaseToken {
    /* ========== EVENTS ========== */

    /**
     * @notice Emitted when a swap happens on the market.
     * @param trader The address of msg.sender.
     * @param srcAmount The source amount being traded.
     * @param destAmount The destination amount received.
     * @param destination The destination addressed where the swap funds is sent to.
     **/
    event Swap(
        address indexed trader,
        uint256 srcAmount,
        uint256 destAmount,
        address indexed destination
    );

    event Join(address indexed lp, address indexed token, uint256 amount);
    event Exit(address indexed lp, address indexed token, uint256 amount);

    /* ========== POOL MANAGEMENT ========== */

    function setPoolRatio(
        address xytToken,
        uint256 denomXYToken,
        address pairToken,
        uint256 denomPairToken
    ) external;

    function setSwapFee(uint256 swapFee) external;

    function setEixtFee(uint256 exitFee) external;

    //function pausePool() external;

    //function unpausePool() external;

    /* ========== TRADE ========== */

    function spotPrice(address inToken, address outToken) external returns (uint256 spotPrice);

    function swapAmountIn(
        uint256 inAmount,
        address inToken,
        address outToken,
        uint256 minOutAmount,
        uint256 maxPrice
    ) external returns (uint256 outAmount, uint256 spotPriceAfter);

    function swapAmountOut(
        address inToken,
        uint256 maxInAmount,
        address outToken,
        uint256 outAmount,
        uint256 maxPrice
    ) external returns (uint256 inAmount, uint256 spotPriceAfter);

    /* ========== LP ========== */

    function joinPoolByAll(
        uint256 outAmountLp,
        uint256 maxInAmoutXyt,
        uint256 maxInAmountPair
    ) external;

    function exitPoolByAll(
        uint256 InAmountLp,
        uint256 minOutAmountXyt,
        uint256 minOutAmountPair
    ) external;

    function joinPoolSingleToken(
        address inToken,
        uint256 inAmount,
        uint256 minLPOutAmount
    ) external returns (uint256 lpOutAmount);

    function exitPoolSingleToken(
        address outToken,
        uint256 outAmount,
        uint256 maxLPinAmount
    ) external returns (uint256 lpInAmount);

    //function interestDistribute(address lp)  returns (uint interestReturn);

    /* ========== CURVE SHIFTING ========== */

    //function shiftWeight(address xytToken, address pairToken) internal;

    //function shiftCurve(address xytToken, address pairToken) internal;

    /* ========== VIEW ========== */

    function getSwapFee() external view returns (uint256 swapFee);
    function getExitFee() external view returns (uint256 eixtFee);

    //function swap(uint256 srcAmount, address destination) external;

    function getReserves()
        external
        view
        returns (
            uint112 xytReserves,
            uint112 tokenReserves,
            uint32 lastBlockTimestamp
        );

    /**
     * @notice Gets a reference to the Benchmark core contract.
     * @return Returns the core contract reference.
     **/
    function core() external view returns (address);

    /**
     * @dev Returns the address of the BenchmarkFactory contract address.
     * @return Returns the factory's address.
     **/
    function factory() external view returns (address);

    /**
     * @dev Returns an instance of the BenchmarkProvider contract.
     * @return Returns the provider's instance.
     **/
    function provider() external view returns (IBenchmarkProvider);

    function minLiquidity() external pure returns (uint256);

    function token() external view returns (address);

    function xyt() external view returns (address);
}
