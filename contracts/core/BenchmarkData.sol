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
import "../interfaces/IBenchmarkFactory.sol";
import "../periphery/Permissions.sol";

contract BenchmarkData is IBenchmarkData, Permissions {
    mapping(address => mapping(address => address)) public override getForgeFromUnderlying;
    mapping(address => address) public override getForgeFromXYT;
    mapping(address => mapping(address => address)) public override getMarket;
    IBenchmark public override core;
    mapping(address => bool) internal isForge;
    mapping(address => bool) internal isMarket;
    address internal initializer;

    constructor(address _governance) Permissions(_governance) {
        initializer = msg.sender;
    }

    modifier onlyFactory() {
        require(msg.sender == address(core.factory()), "Benchmark: only factory");
        _;
    }

    modifier onlyForge() {
        require(isForge[msg.sender], "Benchmark: only forge");
        _;
    }

    modifier onlyMarket() {
        require(isMarket[msg.sender], "Benchmark: only market");
        _;
    }

    function initialize(IBenchmark _core) external {
        require(msg.sender == initializer, "Benchmark: forbidden");
        require(address(_core) != address(0), "Benchmark: zero address");

        initializer = address(0);
        core = _core;
    }

    function setCore(IBenchmark _core) external override onlyGovernance {
        require(initializer == address(0), "Benchmark: not initialized");
        require(address(_core) != address(0), "Benchmark: zero address");

        core = _core;
        emit CoreSet(address(_core));
    }

    /***********
     *  FORGE  *
     ***********/

    function storeForge(
        address _underlyingAsset,
        address _underlyingYieldToken,
        address _forge
    ) external override onlyFactory {
        require(initializer == address(0), "Benchmark: not initialized");
        require(_underlyingAsset != address(0), "Benchmark: zero address");
        require(_underlyingYieldToken != address(0), "Benchmark: zero address");
        require(_forge != address(0), "Benchmark: zero address");

        getForgeFromUnderlying[_underlyingAsset][_underlyingYieldToken] = _forge;
        isForge[_forge] = true;
    }

    function storeXYT(
        address _xyt,
        address _forge
    ) external override onlyForge {
        require(initializer == address(0), "Benchmark: not initialized");
        require(_xyt != address(0), "Benchmark: zero address");

        getForgeFromXYT[_xyt] = _forge;
    }

    /***********
     *  MARKET *
     ***********/
    function storeMarket(
        address _xyt,
        address _token,
        address _market
    ) external override onlyFactory {
        require(initializer == address(0), "Benchmark: not initialized");
        require(_xyt != address(0), "Benchmark: zero address");
        require(_token != address(0), "Benchmark: zero address");
        require(_market != address(0), "Benchmark: zero address");

        getMarket[_xyt][_token] = _market;
        isMarket[_market] = true;
    }
}
