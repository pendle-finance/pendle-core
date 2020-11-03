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

import {Factory} from "../libraries/BenchmarkLibrary.sol";
import "../core/BenchmarkForge.sol";
import "../interfaces/IBenchmarkProvider.sol";
import "../interfaces/IForgeCreator.sol";


contract ForgeCreator is IForgeCreator {
    IBenchmark public override core;
    IBenchmarkProvider public override provider;
    address public immutable override factory;
    address private initializer;

    constructor(address _factory) {
        require(_factory != address(0), "Benchmark: zero address");

        initializer = msg.sender;
        factory = _factory;
    }

    /**
     * @notice Initializes the BenchmarkFactory.
     * @dev Only called once.
     * @param _core The reference to the Benchmark core contract.
     * @param _provider The reference to the BenchmarkProvider contract.
     **/
    function initialize(IBenchmark _core, IBenchmarkProvider _provider) external {
        require(msg.sender == initializer, "Benchmark: forbidden");
        require(address(_core) != address(0), "Benchmark: zero address");
        require(address(_provider) != address(0), "Benchmark: zero address");

        initializer = address(0);
        core = _core;
        provider = _provider;
    }

    function create(address _underlyingAsset, address _underlyingYieldToken)
        external
        override
        returns (address forge)
    {
        require(msg.sender == factory, "Benchmark: forbidden");
        require(initializer == address(0), "Benchmark: not initialized");

        forge = Factory.createContract(
            type(BenchmarkForge).creationCode,
            abi.encodePacked(core, provider, factory, _underlyingAsset, _underlyingYieldToken),
            abi.encode(core, provider, factory, _underlyingAsset, _underlyingYieldToken)
        );
    }
}
