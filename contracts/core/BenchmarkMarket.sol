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
import "../interfaces/IBenchmarkMarket.sol";
import "../tokens/BenchmarkBaseToken.sol";
import "../libraries/BenchmarkLibrary.sol";
import {Math} from "../libraries/BenchmarkLibrary.sol";


contract BenchmarkMarket is IBenchmarkMarket, BenchmarkBaseToken {
    using Math for uint256;
    using SafeMath for uint256;

    IBenchmark public immutable override core;
    address public immutable override factory;
    address public immutable override forge;
    address public immutable override token;
    address public immutable override xyt;
    uint256 public constant override minLiquidity = 10**3;
    string private constant _name = "Benchmark Market";
    string private constant _symbol = "BMK-LPT";
    uint256 private constant INITIAL_LP_FOR_CREATOR = 10**18; // arbitrary number
    uint8 private constant _decimals = 18;
    address public creator;
    bool public bootstrapped;

    struct TokenReserve {
        uint256 weight;
        uint256 balance;
    }

    mapping(address => TokenReserve) private reserves;

    constructor(
        address _creator,
        IBenchmark _core,
        address _forge,
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
        require(address(_core) != address(0), "Benchmark: zero address");
        require(_forge != address(0), "Benchmark: zero address");
        require(_xyt != address(0), "Benchmark: zero address");
        require(_token != address(0), "Benchmark: zero address");

        factory = msg.sender;
        core = _core;
        forge = _forge;
        xyt = _xyt;
        token = _token;
        creator = _creator;
        bootstrapped = false;
    }

    modifier isBootstrapped {
        require(bootstrapped, "Benchmark: not bootstrapped");
        _;
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

    function bootstrap(
        uint256 initialXytLiquidity,
        uint256 initialTokenLiquidity
    ) external {
        require(msg.sender == creator, "Benchmark: not creator");
        _pullToken(xyt, msg.sender, initialXytLiquidity);

        _pullToken(token, msg.sender, initialTokenLiquidity);
        reserves[xyt].balance = initialXytLiquidity;
        reserves[xyt].weight = Math.FP / 2;
        reserves[token].balance = initialTokenLiquidity;
        reserves[token].weight = Math.FP / 2;
        _mintLpToken(INITIAL_LP_FOR_CREATOR);
        _pushLpToken(msg.sender, INITIAL_LP_FOR_CREATOR);
        bootstrapped = true;
    }

    function spotPrice(address inToken, address outToken)
        external
        override
        returns (uint256 spot)
    {
        IBenchmarkData data = core.data();
        TokenReserve storage inTokenReserve = reserves[inToken];
        TokenReserve storage outTokenReserve = reserves[outToken];

        return
            _calcSpotprice(
                inTokenReserve.balance,
                inTokenReserve.weight,
                outTokenReserve.balance,
                outTokenReserve.weight,
                data.swapFee()
            );
    }

    function swapAmountIn(
        uint256 inAmount,
        address inToken,
        address outToken,
        uint256 minOutAmount,
        uint256 maxPrice
    ) external override returns (uint256 outAmount, uint256 spotPriceAfter) {
        IBenchmarkData data = core.data();
        TokenReserve storage inTokenReserve = reserves[inToken];
        TokenReserve storage outTokenReserve = reserves[outToken];
        uint256 swapFee = data.swapFee();

        uint256 spotPriceBefore = _calcSpotprice(
            inTokenReserve.balance,
            inTokenReserve.weight,
            outTokenReserve.balance,
            outTokenReserve.weight,
            swapFee
        );
        require(spotPriceBefore <= maxPrice, "ERR_BAD_PRICE");

        //calc out amount
        /* outAmount = _calcOutAmount(
            inTokenReserve.weight,
            outTokenReserve.weight,
            inTokenReserve.balance,
            outTokenReserve.balance,
            inAmount
        ); */
        require(outAmount >= minOutAmount, "ERR_OUT_AMOUNT_LOW");

        inTokenReserve.balance = inTokenReserve.balance.add(inAmount);
        outTokenReserve.balance = outTokenReserve.balance.sub(outAmount);

        spotPriceAfter = _calcSpotprice(
            inTokenReserve.balance,
            inTokenReserve.weight,
            outTokenReserve.balance,
            outTokenReserve.weight,
            swapFee
        );

        require(spotPriceAfter >= spotPriceBefore, "ERR_MATH_PROBLEM");
        require(spotPriceAfter <= maxPrice, "ERR_BAD_PRICE");
        require(spotPriceBefore <= Math.fpDiv(inAmount, outAmount), "ERR_MATH_PROBLEM");

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
    ) external override returns (uint256 inAmount, uint256 spotPriceAfter) {
        IBenchmarkData data = core.data();
        TokenReserve storage inTokenReserve = reserves[inToken];
        TokenReserve storage outTokenReserve = reserves[outToken];
        uint256 swapFee = data.swapFee();

        //calc spot price
        uint256 spotPriceBefore = _calcSpotprice(
            inTokenReserve.balance,
            inTokenReserve.weight,
            outTokenReserve.balance,
            outTokenReserve.weight,
            swapFee
        );
        require(spotPriceBefore <= maxPrice, "ERR_BAD_PRICE");

        //calc in amount
        inAmount = _calcInAmount(
            inTokenReserve.weight,
            outTokenReserve.weight,
            inTokenReserve.balance,
            outTokenReserve.balance,
            outAmount
        );
        require(inAmount <= maxInAmount, "ERR_IN_AMOUT_HIGH");

        inTokenReserve.balance = inTokenReserve.balance.add(inAmount);
        outTokenReserve.balance = outTokenReserve.balance.sub(outAmount);

        spotPriceAfter = _calcSpotprice(
            inTokenReserve.balance,
            inTokenReserve.weight,
            outTokenReserve.balance,
            outTokenReserve.weight,
            swapFee
        );

        require(spotPriceAfter >= spotPriceBefore, "ERR_MATH_PROBLEM");
        require(spotPriceAfter <= maxPrice, "ERR_BAD_PRICE");
        require(spotPriceBefore <= Math.fpDiv(inAmount, outAmount), "ERR_MATH_PROBLEM");

        emit Swap(msg.sender, inAmount, outAmount, msg.sender);

        _pullToken(inToken, msg.sender, inAmount);
        _pushToken(outToken, msg.sender, outAmount);

        return (inAmount, spotPriceAfter);
    }

    /**
     * @notice join the pool by putting in xytToken and pairTokens
     * and get back desired amount of lpToken
     */

    function joinPoolByAll(
        uint256 outAmountLp,
        uint256 maxInAmoutXyt,
        uint256 maxInAmountPair
    ) external override {
        uint256 totalLp = totalSupply;
        uint256 ratio = Math.fpDiv(outAmountLp, totalLp);
        require(ratio != 0, "ERR_MATH_PROBLEM");

        //calc and inject xyt token
        uint256 balanceToken = reserves[xyt].balance;
        uint256 inAmount = Math.fpMul(ratio, balanceToken);
        require(inAmount != 0, "ERR_MATH_PROBLEM");
        require(inAmount <= maxInAmoutXyt, "ERR_BEYOND_AMOUNT_LIMIT");
        reserves[xyt].balance = reserves[xyt].balance.add(inAmount);
        emit Join(msg.sender, xyt, inAmount);
        _pullToken(xyt, msg.sender, inAmount);

        //calc and inject pair token
        balanceToken = reserves[token].balance;
        inAmount = Math.fpMul(ratio, balanceToken);
        require(inAmount != 0, "ERR_MATH_PROBLEM");
        require(inAmount <= maxInAmountPair, "ERR_BEYOND_AMOUNT_LIMIT");
        reserves[token].balance = reserves[token].balance.add(inAmount);
        emit Join(msg.sender, token, inAmount);
        _pullToken(token, msg.sender, inAmount);

        //mint and push lp token
        _mintLpToken(outAmountLp);
        _pushLpToken(msg.sender, outAmountLp);
    }

    /**
     * @notice exit the pool by putting in desired amount of lpToken
     * and get back xytToken and pairToken
     */

    function exitPoolByAll(
        uint256 inAmountLp,
        uint256 minOutAmountXyt,
        uint256 minOutAmountPair
    ) external override {
        IBenchmarkData data = core.data();
        uint256 exitFee = data.exitFee();
        uint256 totalLp = totalSupply;
        uint256 exitFees = Math.fpMul(inAmountLp, exitFee);
        uint256 InLpAfterExitFee = inAmountLp.sub(exitFee);
        uint256 ratio = Math.fpDiv(InLpAfterExitFee, totalLp);
        require(ratio != 0, "ERR_MATH_PROBLEM");

        //let's deal with lp first
        _pullLpToken(msg.sender, inAmountLp);
        _pushLpToken(factory, exitFees);
        _burnLpToken(InLpAfterExitFee);

        //calc and withdraw xyt token
        uint256 balanceToken = reserves[xyt].balance;
        uint256 outAmount = Math.fpMul(ratio, balanceToken);
        require(outAmount != 0, "ERR_MATH_PROBLEM");
        require(outAmount >= minOutAmountXyt, "ERR_BEYOND_AMOUNT_LIMIT");
        reserves[xyt].balance = reserves[xyt].balance.sub(outAmount);
        emit Exit(msg.sender, xyt, outAmount);
        _pushToken(xyt, msg.sender, outAmount);

        //calc and withdraw pair token
        balanceToken = reserves[token].balance;
        outAmount = Math.fpMul(ratio, balanceToken);
        require(outAmount != 0, "ERR_MATH_PROBLEM");
        require(outAmount >= minOutAmountPair, "ERR_BEYOND_AMOUNT_LIMIT");
        reserves[token].balance = reserves[token].balance.sub(outAmount);
        emit Exit(msg.sender, token, outAmount);
        _pushToken(token, msg.sender, outAmount);
    }

    function joinPoolSingleToken(
        address inToken,
        uint256 inAmount,
        uint256 minOutAmountLp
    ) external override returns (uint256 outAmountLp) {
        TokenReserve storage inTokenReserve = reserves[inToken];
        uint256 totalLp = totalSupply;
        uint256 totalWeight = reserves[xyt].weight.add(reserves[token].weight);

        //calc out amount of lp token
        outAmountLp = _calOutAmountLp(
            inAmount,
            inTokenReserve.balance,
            inTokenReserve.weight,
            totalLp,
            totalWeight
        );
        require(outAmountLp >= minOutAmountLp, "ERR_LP_BAD_AMOUNT");

        //update reserves and operate underlying lp and intoken
        inTokenReserve.balance = inTokenReserve.balance.add(inAmount);

        emit Join(msg.sender, inToken, inAmount);

        _mintLpToken(outAmountLp);
        _pushLpToken(msg.sender, outAmountLp);
        _pullToken(inToken, msg.sender, inAmount);

        return outAmountLp;
    }

    function exitPoolSingleToken(
        address outToken,
        uint256 inAmountLp,
        uint256 minOutAmountToken
    ) external override returns (uint256 outAmountToken) {
        IBenchmarkData data = core.data();
        TokenReserve storage outTokenReserve = reserves[outToken];
        uint256 exitFee = data.exitFee();
        uint256 totalLp = totalSupply;
        uint256 totalWeight = reserves[xyt].weight.add(reserves[token].weight);

        outAmountToken = calcOutAmountToken(
            outTokenReserve.balance,
            outTokenReserve.weight,
            totalLp,
            totalWeight,
            inAmountLp
        );
        require(outAmountToken >= minOutAmountToken, "ERR_TOKEN_BAD_AMOUNT");

        //update reserves and operate underlying lp and outtoken
        outTokenReserve.balance = outTokenReserve.balance.sub(outAmountToken);

        uint256 exitFees = Math.fpMul(inAmountLp, data.exitFee());

        emit Exit(msg.sender, outToken, outAmountToken);

        _pullLpToken(msg.sender, inAmountLp);
        _burnLpToken(inAmountLp.sub(exitFees));
        _pushLpToken(factory, exitFee);
        _pushToken(outToken, msg.sender, outAmountToken);

        return outAmountToken;
    }

    function interestDistribute(address lp) internal returns (uint256 interestReturn) {}

    function shiftWeight(address xytToken, address pairToken) internal {}

    function shiftCurve(address xytToken, address pairToken) internal {}

    function _calcSpotprice(
        uint256 inBalance,
        uint256 inWeight,
        uint256 outBalance,
        uint256 outWeight,
        uint256 swapFee
    ) internal returns (uint256 spot) {
        uint256 numer = Math.fpDiv(inBalance, inWeight);
        uint256 denom = Math.fpDiv(outBalance, outWeight);
        uint256 ratio = Math.fpDiv(numer, denom);
        uint256 scale = Math.fpDiv(Math.FP, Math.FP.sub(swapFee));

        spot = Math.fpMul(ratio, scale);
    }

    function _calcOutAmount(
        uint256 inWeight,
        uint256 outWeight,
        uint256 inBalance,
        uint256 outBalance,
        uint256 inAmount
    ) internal returns (uint256) {
        IBenchmarkData data = core.data();
        uint256 weightRatio = Math.fpDiv(inWeight, outWeight);
        uint256 adjustedIn = Math.FP.sub(data.swapFee());
        adjustedIn = Math.fpMul(inAmount, adjustedIn);
        uint256 y = Math.fpDiv(inBalance, inBalance.add(adjustedIn));
        uint256 foo = Math.fpPow(y, weightRatio);
        uint256 bar = Math.FP.sub(foo);

        return Math.fpMul(outBalance, bar);
    }

    function _calcInAmount(
        uint256 inWeight,
        uint256 outWeight,
        uint256 inBalance,
        uint256 outBalance,
        uint256 outAmount
    ) internal returns (uint256 inAmount) {
        IBenchmarkData data = core.data();
        uint256 weightRatio = Math.fpDiv(outWeight, inWeight);
        uint256 diff = outBalance.sub(outAmount);
        uint256 y = Math.fpDiv(outBalance, diff);
        uint256 foo = Math.fpPow(y, weightRatio);
        foo = foo.sub(Math.FP);
        inAmount = Math.FP.sub(data.swapFee());
        inAmount = Math.fpDiv(Math.fpMul(inBalance, foo), inAmount);
        return inAmount;
    }

    function _calOutAmountLp(
        uint256 inAmount,
        uint256 inBalance,
        uint256 inWeight,
        uint256 totalSupplyLp,
        uint256 totalWeight
    ) internal view returns (uint256 outAmountLp) {
        IBenchmarkData data = core.data();
        uint256 nWeight = Math.fpDiv(inWeight, totalWeight);
        uint256 feePortion = Math.fpMul(Math.FP.sub(nWeight), data.swapFee());
        uint256 inAmoutAfterFee = Math.fpMul(inAmount, Math.FP.sub(feePortion));

        uint256 inBalanceUpdated = inBalance.add(inAmoutAfterFee);
        uint256 inTokenRatio = Math.fpDiv(inBalanceUpdated, inBalance);

        uint256 lpTokenRatio = Math.fpPow(inTokenRatio, nWeight);
        uint256 totalSupplyLpUpdated = Math.fpMul(lpTokenRatio, totalSupplyLp);
        outAmountLp = totalSupplyLpUpdated.sub(totalSupplyLp);
        return outAmountLp;
    }

    function calcOutAmountToken(
        uint256 outBalance,
        uint256 outWeight,
        uint256 totalSupplyLp,
        uint256 totalWeight,
        uint256 inAmountLp
    ) public view returns (uint256 outAmountToken) {
        IBenchmarkData data = core.data();
        uint256 nWeight = Math.fpDiv(outWeight, totalWeight);
        uint256 inAmountLpAfterExitFee = Math.fpMul(inAmountLp, Math.FP.sub(data.exitFee()));
        uint256 totalSupplyLpUpdated = totalSupplyLp.sub(inAmountLpAfterExitFee);
        uint256 lpRatio = Math.fpDiv(totalSupplyLpUpdated, totalSupplyLp);

        uint256 outTokenRatio = Math.fpPow(lpRatio, Math.fpDiv(Math.FP, nWeight));
        uint256 outTokenBalanceUpdated = Math.fpMul(outTokenRatio, outBalance);

        uint256 outAmountTOkenBeforeSwapFee = outBalance.sub(outTokenBalanceUpdated);

        uint256 feePortion = Math.fpMul(Math.FP.sub(nWeight), data.swapFee());
        outAmountToken = Math.fpMul(outAmountTOkenBeforeSwapFee, Math.FP.sub(feePortion));
        return outAmountToken;
    }

    function _pullToken(
        address tokenAddr,
        address fromAddr,
        uint256 amountToPull
    ) internal {
        require(
            IERC20(tokenAddr).transferFrom(fromAddr, address(this), amountToPull),
            "ERR_PULL_TOKEN_FALSE"
        );
    }

    function _pushToken(
        address tokenAddr,
        address toAddr,
        uint256 amountToPush
    ) internal {
        require(IERC20(tokenAddr).transfer(toAddr, amountToPush), "ERR_PUSH_TOKEN_FALSE");
    }

    function _pullLpToken(address from, uint256 amount) internal {
        _transfer(from, address(this), amount);
    }

    function _pushLpToken(address to, uint256 amount) internal {
        _transfer(address(this), to, amount);
    }

    function _mintLpToken(uint256 amount) internal {
        _mint(address(this), amount);
    }

    function _burnLpToken(uint256 amount) internal {
        _burn(address(this), amount);
    }
}
