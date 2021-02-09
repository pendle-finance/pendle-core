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

import "./IPendle.sol";
import "./IPendleBaseToken.sol";
import {Utils} from "../libraries/PendleLibrary.sol";

interface IPendleMarket is IPendleBaseToken {
    /* ========== EVENTS ========== */

    /**
     * @notice Emitted when a swap happens on the market.
     * @param trader The address of msg.sender.
     * @param inToken The input token.
     * @param outToken The output token.
     * @param exactIn The exact amount being traded.
     * @param exactOut The exact amount received.
     * @param destination The destination addressed where the swap funds is sent to.
     **/
    event Swap(
        address indexed trader,
        address inToken,
        address outToken,
        uint256 exactIn,
        uint256 exactOut,
        address indexed destination
    );

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
     * @dev Emitted when user adds liquidity
     * @param token0Amount the amount of token0 (xyt) provided by user
     * @param token1Amount the amount of token1 provided by user
     */
    event Join(address indexed sender, uint256 token0Amount, uint256 token1Amount);

    /**
     * @dev Emitted when user removes liquidity
     * @param token0Amount the amount of token0 (xyt) given to user
     * @param token1Amount the amount of token1 given to user
     */
    event Exit(address indexed sender, uint256 token0Amount, uint256 token1Amount);

    /* ========== POOL MANAGEMENT ========== */

    // function setPoolRatio(
    //     address xytToken,
    //     uint256 denomXYToken,
    //     address pairToken,
    //     uint256 denomPairToken
    // ) external;

    /* ========== TRADE ========== */

    function spotPrice(address inToken, address outToken) external view returns (uint256 spot);

    function swapAmountIn(
        address _msgSender,
        uint256 exactIn,
        address inToken,
        address outToken,
        uint256 minOut,
        uint256 maxPrice
    ) external returns (uint256 exactOut, uint256 spotPriceAfter);

    function swapAmountOut(
        address _msgSender,
        address inToken,
        uint256 maxIn,
        address outToken,
        uint256 exactOut,
        uint256 maxPrice
    ) external returns (uint256 exactIn, uint256 spotPriceAfter);

    /* ========== LP ========== */

    function joinPoolByAll(
        address _msgSender,
        uint256 exactOutLp,
        uint256 maxInXyt,
        uint256 maxInPair
    ) external;

    function exitPoolByAll(
        address _msgSender,
        uint256 exactInLp,
        uint256 minOutXyt,
        uint256 minOutPair
    ) external;

    function joinPoolSingleToken(
        address _msgSender,
        address inToken,
        uint256 exactIn,
        uint256 minOutLp
    ) external returns (uint256 exactOutLp);

    function exitPoolSingleToken(
        address _msgSender,
        address outToken,
        uint256 exactInLp,
        uint256 minOutToken
    ) external returns (uint256 exactOutToken);

    //function interestDistribute(address lp)  returns (uint interestReturn);

    /* ========== CURVE SHIFTING ========== */

    //function shiftWeight(address xytToken, address pairToken) internal;

    //function shiftCurve(address xytToken, address pairToken) internal;

    /* ========== VIEW ========== */

    function getReserves()
        external
        view
        returns (
            uint256 xytReserves,
            uint256 tokenReserves,
            uint256 lastBlockTimestamp
        );

    function bootstrap(
        address _msgSender,
        uint256 initialXytLiquidity,
        uint256 initialTokenLiquidity
    ) external;

    /**
     * @notice Gets a reference to the Pendle core contract.
     * @return Returns the core contract reference.
     **/
    function core() external view returns (IPendle);

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

    function minLiquidity() external pure returns (uint256);

    function token() external view returns (address);

    function xyt() external view returns (address);
}
