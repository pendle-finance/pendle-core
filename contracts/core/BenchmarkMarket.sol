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
import "../libraries/BenchmarkLibrary.sol";
import {Math} from "../libraries/BenchmarkLibrary.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

contract BenchmarkMarket is IBenchmarkMarket, BenchmarkBaseToken {
    using SafeMath for uint256;

    address public immutable override core;
    address public immutable override factory;
    address public immutable override token;
    address public immutable override xyt;
    IBenchmarkProvider public immutable override provider;
    uint256 public constant override minLiquidity = 10**3;
    string private constant _name = "Benchmark Market";
    string private constant _symbol = "BMK-LPT";
    uint8 private constant _decimals = 18;

    struct TokenReserve {
        uint256 weight;
        uint256 balance;
    }

    uint256 private _swapFee; //@@XM TODO: move to benchmarkData later
    mapping(address => TokenReserve) private _reserves;

    constructor(
        IBenchmarkProvider _provider,
        address _core,
        address _factory,
        address _xyt,
        address _token,
        uint256 _expiry
    ) BenchmarkBaseToken(_name, _symbol, _decimals, _expiry) {
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

    function swap(uint256 srcAmount, address destination) external override {}

    function setPoolRatio(
        address xytToken,
        uint256 denomXYToken,
        address pairToken,
        uint256 denomPairToken
    ) external override {}

    function setSwapFee(uint256 swapFee) external override {}

    function pausePool() external override {}

    function unpausePool() external override {}

    function spotPrice(address inToken, address outToken)
        external
        override
        returns (uint256 spotPrice)
    {
        TokenReserve storage inTokenReserve = _reserves[inToken];
        TokenReserve storage outTokenReserve = _reserves[outToken];

        return
            _calcSpotprice(
                inTokenReserve.balance,
                inTokenReserve.weight,
                outTokenReserve.balance,
                outTokenReserve.weight,
                _swapFee
            );
    }

    function swapAmountIn(
        uint256 inAmount,
        address inToken,
        address outToken,
        uint256 minOutAmount,
        uint256 maxPrice
    ) external override returns (uint256 outAmount, uint256 spotPriceAfter) {
        TokenReserve storage inTokenReserve = _reserves[inToken];
        TokenReserve storage outTokenReserve = _reserves[outToken];

        //calc spot price
        uint256 spotPriceBefore = _calcSpotprice(
            inTokenReserve.balance,
            inTokenReserve.weight,
            outTokenReserve.balance,
            outTokenReserve.weight,
            _swapFee
        );
        require(spotPriceBefore <= maxPrice, "ERR_BAD_PRICE");

        //calc out amount
        outAmount = _calcOutAmount(
            inTokenReserve.weight,
            outTokenReserve.weight,
            inTokenReserve.balance,
            outTokenReserve.balance,
            inAmount
        );
        require(outAmount >= minOutAmount, "ERR_OUT_AMOUT_LOW");

        inTokenReserve.balance = inTokenReserve.balance.add(inAmount);
        outTokenReserve.balance = outTokenReserve.balance.sub(outAmount);

        spotPriceAfter = _calcSpotprice(
            inTokenReserve.balance,
            inTokenReserve.weight,
            outTokenReserve.balance,
            outTokenReserve.weight,
            _swapFee
        );

        require(spotPriceAfter >= spotPriceBefore, "ERR_MATH_PROBLEM");
        require(spotPriceAfter <= maxPrice, "ERR_BAD_PRICE");
        require(spotPriceBefore <= Math.rdiv(inAmount, outAmount), "ERR_MATH_PROBLEM");

        emit Swap(msg.sender, inAmount, outAmount, msg.sender);

        _pullToken(inToken, msg.sender, inAmount);
        _pushToken(outToken, msg.sender, outAmount);

        return (outAmount, spotPriceAfter);
    }

    function swapAmountOut(
        address inToken,
        uint256 maxInAmount,
        address outToken,
        uint256 outAmount,
        uint256 maxPrice
    ) external override returns (uint256 inAmount, uint256 spotPriceAfter) {}

    function joinPoolLpToken(uint256 lpTokenOutAmount, uint256[] calldata maxInAmounts)
        external
        override
    {}

    function exitPoolLpToken(uint256 lpTokenInAmount, uint256[] calldata minOutAmounts)
        external
        override
    {}

    function joinPoolSingleToken(
        address inToken,
        uint256 inAmount,
        uint256 minLPOutAmount
    ) external override returns (uint256 lpOutAmount) {}

    function exitPoolSingleToken(
        address outToken,
        uint256 outAmount,
        uint256 maxLPinAmount
    ) external override returns (uint256 lpInAmount) {}

    function getSwapFee() external view override returns (uint256 swapFee) {}

    function interestDistribute(address lp) internal returns (uint256 interestReturn) {}

    function shiftWeight(address xytToken, address pairToken) internal {}

    function shiftCurve(address xytToken, address pairToken) internal {}

    function _calcSpotprice(
        uint256 inBalance,
        uint256 inWeight,
        uint256 outBalance,
        uint256 outWeight,
        uint256 swapFee
    ) internal returns (uint256 spotPrice) {
        uint256 numer = Math.rdiv(inBalance, inWeight);
        uint256 denom = Math.rdiv(outBalance, outWeight);
        uint256 ratio = Math.rdiv(numer, denom);
        uint256 scale = Math.rdiv(Math.UINT_MAX_VALUE, Math.UINT_MAX_VALUE.sub(swapFee));
        return (spotPrice = Math.rmul(ratio, scale));
    }

    function _calcOutAmount(
        uint256 inWeight,
        uint256 outWeight,
        uint256 inBalance,
        uint256 outBalance,
        uint256 inAmount
    ) internal returns (uint256 outAmount) {
        uint256 weightRatio = Math.rdiv(inWeight, outWeight);
        uint256 adjustedIn = Math.UINT_MAX_VALUE.sub(_swapFee);
        adjustedIn = Math.rmul(inAmount, adjustedIn);
        uint256 y = Math.rdiv(inBalance, inBalance.add(adjustedIn));
        uint256 foo = Math.pow(y, weightRatio);
        uint256 bar = Math.UINT_MAX_VALUE.sub(foo);
        outAmount = Math.rmul(outBalance, bar);
        return outAmount;
    }

    function _pullToken(
        address tokenAddr,
        address fromAddr,
        uint256 amountToPull
    ) internal {
        bool res = IERC20(tokenAddr).transferFrom(fromAddr, address(this), amountToPull);
        require(res, "ERR_PULL_TOKEN_FALSE");
    }

    function _pushToken(
        address tokenAddr,
        address toAddr,
        uint256 amountToPush
    ) internal {
        bool res = IERC20(tokenAddr).transfer(toAddr, amountToPush);
        require(res, "ERR_PUSH_TOKEN_FALSE");
    }
}
