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
import "./BenchmarkMarket.sol";
import "../interfaces/IBenchmark.sol";
import "../interfaces/IBenchmarkData.sol";
import "../interfaces/IBenchmarkMarketFactory.sol";
import "../interfaces/IBenchmarkYieldToken.sol";
import "../periphery/Permissions.sol";

contract BenchmarkMarketFactory is IBenchmarkMarketFactory, Permissions {
    IBenchmark public override core;

    constructor(address _governance) Permissions(_governance) {}

    function initialize(IBenchmark _core) external {
        require(msg.sender == initializer, "Benchmark: forbidden");
        require(address(_core) != address(0), "Benchmark: zero address");

        initializer = address(0);
        core = _core;
    }

    function createMarket(
        bytes32 _forgeId,
        address _xyt,
        address _token,
        uint256 _expiry
    ) external override initialized returns (address market) {
        require(_xyt != _token, "Benchmark: similar tokens");
        require(_xyt != address(0) && _token != address(0), "Benchmark: zero address");

        IBenchmarkData data = core.data();
        address forgeAddress = data.getForgeAddress(_forgeId);

        require(
            data.getMarket(_forgeId, _xyt, _token) == address(0),
            "Benchmark: market already exists"
        );
        require(data.isValidXYT(_xyt), "Benchmark: not xyt");

        market = Factory.createContract(
            type(BenchmarkMarket).creationCode,
            abi.encodePacked(msg.sender, core, forgeAddress, _xyt, _token, _expiry),
            abi.encode(msg.sender, core, forgeAddress, _xyt, _token, _expiry)
        );
        data.storeMarket(_forgeId, _xyt, _token, market);
        data.addMarket(market);

        emit MarketCreated(_xyt, _token, market);
    }

    function setCore(IBenchmark _core) public override onlyGovernance {
        require(address(_core) != address(0), "Benchmark: zero address");

        core = _core;
        emit CoreSet(address(_core));
    }
}
