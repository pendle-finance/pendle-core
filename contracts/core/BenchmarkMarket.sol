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
    address public immutable override core;
    address public immutable override factory;
    address public immutable override token;
    address public immutable override xyt;
    IBenchmarkProvider public immutable override provider;
    uint256 public constant override minLiquidity = 10**3;
    string private constant _name = "Benchmark Market";
    string private constant _symbol = "BMK-LPT";
    uint8 private constant _decimals = 18;

    constructor(
        IBenchmarkProvider _provider,
        address _core,
        address _factory,
        address _xyt,
        address _token,
        uint256 _expiry
    )
        BenchmarkBaseToken(
            _name,
            _symbol,
            _decimals,
            _expiry
        )
    {
        require(address(_provider) != address(0), "Benchmark: zero address");
        require(_core != address(0), "Benchmark: zero address");
        require(_factory != address(0), "Benchmark: zero address");
        require(_xyt != address(0), "Benchmark: zero address");
        require(_token != address(0), "Benchmark: zero address");

        factory = msg.sender;
        core = _core;
        provider = _provider;
        xyt = _xyt;
        token = _token;
    }

    function getReserves()
        external
        view
        override
        returns (
            uint112 xytReserves,
            uint112 tokenReserves,
            uint32 lastBlockTimestamp
        )
    {}

    function swap(uint256 srcAmount, address destination) external override { }

    function setPoolRatio(address xytToken, uint denomXYToken, address pairToken, uint denomPairToken) external override { }
    
    function setSwapFee(uint swapFee) external override { }
    
    function pausePool() external override { }
    
    function unpausePool() external override { }

    function spotPrice(address inToken, address outToken) external view override returns (uint spotPrice)  { }

    function swapAmountIn(
        uint inAmount, 
        address inToken, 
        address outToken, 
        uint minOutAmount,
        uint maxPrice
        ) external override returns (uint outAmount, uint spotPriceAfter) {}

    function swapAmountOut(
        address inToken,
        uint maxInAmount,
        address outToken,
        uint outAmount,
        uint maxPrice
    ) external override returns (uint inAmount, uint spotPriceAfter) {}


    function joinPoolLpToken(uint lpTokenOutAmount, uint[] calldata maxInAmounts) external override {}

    function exitPoolLpToken(uint lpTokenInAmount, uint[] calldata minOutAmounts) external override {}

    function joinPoolSingleToken(address inToken, uint inAmount, uint minLPOutAmount) external override returns (uint lpOutAmount) {}

    function exitPoolSingleToken(address outToken, uint outAmount, uint maxLPinAmount) external override returns (uint lpInAmount) {}

    function getSwapFee() external view override returns (uint swapFee) {}

    function interestDistribute(address lp) internal returns (uint interestReturn) {}

    function shiftWeight(address xytToken, address pairToken) internal {}
    
    function shiftCurve(address xytToken, address pairToken) internal {}
}
