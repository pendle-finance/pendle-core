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
import {Utils} from "../libraries/BenchmarkLibrary.sol";


interface IBenchmarkMarket is IBenchmarkBaseToken {
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

    function swap(uint256 srcAmount, address destination) external;

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
     * @notice Gets the protocol used for this yield token.
     * @return Retuns the protocol enum.
     **/
    function protocol() external view returns (Utils.Protocols);

    /**
     * @dev Returns an instance of the BenchmarkProvider contract.
     * @return Returns the provider's instance.
     **/
    function provider() external view returns (IBenchmarkProvider);

    function minLiquidity() external pure returns (uint256);

    function token() external view returns (address);

    function xyt() external view returns (address);
}
