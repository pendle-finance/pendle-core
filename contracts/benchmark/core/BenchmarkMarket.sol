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

import "../interfaces/IBenchmarkMarket.sol";
import "../tokens/BenchmarkBaseToken.sol";


contract BenchmarkMarket is IBenchmarkMarket, BenchmarkBaseToken {
    address public immutable override factory;
    address public immutable override token;
    address public immutable override treasury;
    address public immutable override xyt;
    uint256 public constant override minLiquidity = 10**3;
    string private constant _name = "Benchmark Market";
    string private constant _symbol = "BMKT";
    uint8 private constant _decimals = 18;

    constructor(
        address _xyt,
        address _token,
        address _underlyingYieldToken,
        address _treasury,
        ContractDurations _contractDuration,
        uint256 _expiry
    )  BenchmarkBaseToken(
        _underlyingYieldToken,
        _decimals,
        _name,
        _symbol,
        _contractDuration,
        _expiry
    ) {
        factory = msg.sender;
        xyt = _xyt;
        token = _token;
        treasury = _treasury;
    }

    function getReserves()
        external
        view
        override
        returns (
            uint112 xytReserves,
            uint112 tokenReserves,
            uint32 lastBlockTimestamp
        ) {

    }

    function swap(uint256 srcAmount, address destination) external override {

    }

    function sync() external override {

    }
}
