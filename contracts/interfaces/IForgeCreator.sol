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

import {Utils} from "../libraries/BenchmarkLibrary.sol";
import "./IBenchmark.sol";
import "./IBenchmarkProvider.sol";


interface IForgeCreator {
    /**
     * @notice Creates a forge given an underlying yield token.
     * @param protocol The protocol of the underlying asset
     * @param underlyingAsset Token address of the underlying asset.
     * @param underlyingYieldToken Token address of the underlying yield token.
     * @return forge Returns the address of the newly created forge.
     **/
    function create(
        Utils.Protocols protocol,
        address underlyingAsset,
        address underlyingYieldToken
    ) external returns (address forge);

    /**
     * @dev Returns an instance of the Benchmark core contract.
     * @return Returns the core's instance.
     **/
    function core() external view returns (IBenchmark);

    /**
     * @dev Returns the address of the BenchmarkFactory for this BenchmarkForge.
     * @return Returns the factory's address.
     **/
    function factory() external view returns (address);

    /**
     * @dev Returns an instance of the BenchmarkProvider contract.
     * @return Returns the provider's instance.
     **/
    function provider() external view returns (IBenchmarkProvider);
}
