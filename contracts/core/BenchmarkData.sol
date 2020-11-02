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

import "../interfaces/IBenchmarkData.sol";
import "../periphery/Permissions.sol";

contract BenchmarkData is IBenchmarkData, Permissions {
    mapping(address => mapping(address => address)) public override getForge;
    mapping(address => mapping(address => address)) public override getMarket;
    address public override core;
    address internal initializer;

    constructor(address _governance) Permissions(_governance) {
        initializer = msg.sender;
    }

    function initialize(address _core) external {
        require(msg.sender == initializer, "Benchmark: forbidden");
        require(_core != address(0), "Benchmark: zero address");

        initializer = address(0);
        core = _core;
    }

    function setCore(address _core) external override onlyGovernance {
        require(initializer == address(0), "Benchmark: not initialized");
        require(_core != address(0), "Benchmark: zero address");

        core = _core;
        emit CoreSet(_core);
    }

    /***********
     *  FORGE  *
     ***********/

    function addForge(
        address _underlyingAsset,
        address _underlyingYieldToken,
        address _forge
    ) external override {
        require(initializer == address(0), "Benchmark: not initialized");
        require(_underlyingAsset != address(0), "Benchmark: zero address");
        require(_underlyingYieldToken != address(0), "Benchmark: zero address");
        require(_forge != address(0), "Benchmark: zero address");

        getForge[_underlyingAsset][_underlyingYieldToken] = _forge;
    }

    /***********
     *  MARKET *
     ***********/
    function addMarket(
        address _xyt,
        address _token,
        address _market
    ) external override {
        require(initializer == address(0), "Benchmark: not initialized");
        require(_xyt != address(0), "Benchmark: zero address");
        require(_token != address(0), "Benchmark: zero address");
        require(_market != address(0), "Benchmark: zero address");

        getMarket[_xyt][_token] = _market;
    }
}
