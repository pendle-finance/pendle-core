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
import "../interfaces/IBenchmarkYieldToken.sol";
import "../tokens/BenchmarkBaseToken.sol";
import "../libraries/BenchmarkLibrary.sol";
import {Math} from "../libraries/BenchmarkLibrary.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "hardhat/console.sol";

contract BenchmarkMarket is IBenchmarkMarket, BenchmarkBaseToken {
    using Math for uint256;
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

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
    uint256 private priceLast = Math.RAY;
    uint256 private blockNumLast;
    uint256 public lastUnderlyingYieldTokenBalance;
    uint256 public globalIncomeIndex;
    uint256 private constant GLOBAL_INCOME_INDEX_MULTIPLIER = 10**8;
    mapping(address => uint256) public lastGlobalIncomeIndex;

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
    ) BenchmarkBaseToken(_name, _symbol, _decimals, _expiry) {
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
        globalIncomeIndex = 1;
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

    function bootstrap(uint256 initialXytLiquidity, uint256 initialTokenLiquidity) external {
        require(msg.sender == creator, "Benchmark: not creator");
        _pullToken(xyt, msg.sender, initialXytLiquidity);

        _pullToken(token, msg.sender, initialTokenLiquidity);
        reserves[xyt].balance = initialXytLiquidity;
        reserves[xyt].weight = Math.RAY / 2;
        reserves[token].balance = initialTokenLiquidity;
        reserves[token].weight = Math.RAY / 2;
        _mintLpToken(INITIAL_LP_FOR_CREATOR);
        _pushLpToken(msg.sender, INITIAL_LP_FOR_CREATOR);
        blockNumLast = block.number; //@@XM added for curve shifting
        bootstrapped = true;
    }

    function spotPrice(address inToken, address outToken)
        external
        view
        override
        returns (uint256 spot)
    {
        IBenchmarkData data = core.data();
        TokenReserve storage inTokenReserve = reserves[inToken];
        TokenReserve storage outTokenReserve = reserves[outToken];

        return _calcSpotPrice(inTokenReserve, outTokenReserve, data.swapFee());
    }

    function swapAmountIn(
        uint256 inAmount,
        address inToken,
        address outToken,
        uint256 minOutAmount,
        uint256 maxPrice
    ) external override returns (uint256 outAmount, uint256 spotPriceAfter) {
        _curveShift();

        IBenchmarkData data = core.data();
        TokenReserve memory inTokenReserve = reserves[inToken];
        TokenReserve memory outTokenReserve = reserves[outToken];

        uint256 spotPriceBefore = _calcSpotPrice(inTokenReserve, outTokenReserve, data.swapFee());
        require(spotPriceBefore <= maxPrice, "ERR_BAD_PRICE");

        //calc out amount
        outAmount = _calcOutAmount(inTokenReserve, outTokenReserve, data.swapFee(), inAmount);
        require(outAmount >= minOutAmount, "ERR_OUT_AMOUNT_LOW");

        inTokenReserve.balance = inTokenReserve.balance.add(inAmount);
        outTokenReserve.balance = outTokenReserve.balance.sub(outAmount);

        spotPriceAfter = _calcSpotPrice(inTokenReserve, outTokenReserve, data.swapFee());

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
    ) external override returns (uint256 inAmount, uint256 spotPriceAfter) {
        _curveShift();

        IBenchmarkData data = core.data();
        TokenReserve storage inTokenReserve = reserves[inToken];
        TokenReserve storage outTokenReserve = reserves[outToken];

        //calc spot price
        uint256 spotPriceBefore = _calcSpotPrice(inTokenReserve, outTokenReserve, data.swapFee());
        require(spotPriceBefore <= maxPrice, "ERR_BAD_PRICE");

        //calc in amount
        inAmount = _calcInAmount(inTokenReserve, outTokenReserve, data.swapFee(), outAmount);
        require(inAmount <= maxInAmount, "ERR_IN_AMOUT_HIGH");

        inTokenReserve.balance = inTokenReserve.balance.add(inAmount);
        outTokenReserve.balance = outTokenReserve.balance.sub(outAmount);

        spotPriceAfter = _calcSpotPrice(inTokenReserve, outTokenReserve, data.swapFee());

        require(spotPriceAfter >= spotPriceBefore, "ERR_MATH_PROBLEM");
        require(spotPriceAfter <= maxPrice, "ERR_BAD_PRICE");
        require(spotPriceBefore <= Math.rdiv(inAmount, outAmount), "ERR_MATH_PROBLEM");

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
        uint256 ratio = Math.rdiv(outAmountLp, totalLp);
        require(ratio != 0, "ERR_MATH_PROBLEM");

        //calc and inject xyt token
        uint256 balanceToken = reserves[xyt].balance;
        uint256 inAmount = Math.rmul(ratio, balanceToken);
        require(inAmount != 0, "ERR_MATH_PROBLEM");
        require(inAmount <= maxInAmoutXyt, "ERR_BEYOND_AMOUNT_LIMIT");
        reserves[xyt].balance = reserves[xyt].balance.add(inAmount);
        emit Join(msg.sender, xyt, inAmount);
        _pullToken(xyt, msg.sender, inAmount);

        //calc and inject pair token
        balanceToken = reserves[token].balance;
        inAmount = Math.rmul(ratio, balanceToken);
        require(inAmount != 0, "ERR_MATH_PROBLEM");
        require(inAmount <= maxInAmountPair, "ERR_BEYOND_AMOUNT_LIMIT");
        reserves[token].balance = reserves[token].balance.add(inAmount);
        emit Join(msg.sender, token, inAmount);
        _pullToken(token, msg.sender, inAmount);

        //mint and push lp token
        _mintLpToken(outAmountLp);
        _pushLpToken(msg.sender, outAmountLp);
        printAcc(msg.sender);
    }

    function printAcc(address a) internal view {
        console.log("\t\t[contract] Details for ", a);
        console.log("\t\t\t[contract] globalIncomeIndex=", globalIncomeIndex);
        console.log(
            "\t\t\t[contract] underlyingYieldTokenAsset bal of account=",
            IERC20(IBenchmarkYieldToken(xyt).underlyingYieldToken()).balanceOf(a)
        );
        console.log(
            "\t\t\t[contract] underlyingYieldToken bal of amm =",
            IERC20(IBenchmarkYieldToken(xyt).underlyingYieldToken()).balanceOf(address(this))
        );
        console.log(
            "\t\t\t[contract] lastGlobalIncomeIndex of account = ",
            lastGlobalIncomeIndex[a]
        );
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
        uint256 exitFees = Math.rmul(inAmountLp, exitFee);
        uint256 InLpAfterExitFee = inAmountLp.sub(exitFee);
        uint256 ratio = Math.rdiv(InLpAfterExitFee, totalLp);
        require(ratio != 0, "ERR_MATH_PROBLEM");

        //calc and withdraw xyt token
        uint256 balanceToken = reserves[xyt].balance;
        uint256 outAmount = Math.rmul(ratio, balanceToken);
        require(outAmount != 0, "ERR_MATH_PROBLEM");
        require(outAmount >= minOutAmountXyt, "ERR_BEYOND_AMOUNT_LIMIT");
        reserves[xyt].balance = reserves[xyt].balance.sub(outAmount);
        emit Exit(msg.sender, xyt, outAmount);
        _pushToken(xyt, msg.sender, outAmount);

        //calc and withdraw pair token
        balanceToken = reserves[token].balance;
        outAmount = Math.rmul(ratio, balanceToken);
        require(outAmount != 0, "ERR_MATH_PROBLEM");
        require(outAmount >= minOutAmountPair, "ERR_BEYOND_AMOUNT_LIMIT");
        reserves[token].balance = reserves[token].balance.sub(outAmount);
        emit Exit(msg.sender, token, outAmount);
        _pushToken(token, msg.sender, outAmount);

        //let's deal with lp last
        _pullLpToken(msg.sender, inAmountLp);
        _pushLpToken(factory, exitFees);
        _burnLpToken(InLpAfterExitFee);
    }

    function joinPoolSingleToken(
        address inToken,
        uint256 inAmount,
        uint256 minOutAmountLp
    ) external override returns (uint256 outAmountLp) {
        IBenchmarkData data = core.data();
        TokenReserve storage inTokenReserve = reserves[inToken];
        uint256 totalLp = totalSupply;
        uint256 totalWeight = reserves[xyt].weight.add(reserves[token].weight);

        //calc out amount of lp token
        outAmountLp = _calcOutAmountLp(
            inAmount,
            inTokenReserve,
            data.swapFee(),
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

        outAmountToken = _calcOutAmountToken(
            data,
            outTokenReserve,
            totalLp,
            totalWeight,
            inAmountLp
        );
        require(outAmountToken >= minOutAmountToken, "ERR_TOKEN_BAD_AMOUNT");

        //update reserves and operate underlying lp and outtoken
        outTokenReserve.balance = outTokenReserve.balance.sub(outAmountToken);

        uint256 exitFees = Math.rmul(inAmountLp, data.exitFee());

        emit Exit(msg.sender, outToken, outAmountToken);

        _pullLpToken(msg.sender, inAmountLp);
        _burnLpToken(inAmountLp.sub(exitFees));
        _pushLpToken(factory, exitFee);
        _pushToken(outToken, msg.sender, outAmountToken);

        return outAmountToken;
    }

    function interestDistribute(address lp) internal returns (uint256 interestReturn) {}

    function _calcSpotPrice(
        TokenReserve memory inTokenReserve,
        TokenReserve memory outTokenReserve,
        uint256 swapFee
    ) internal pure returns (uint256 spot) {
        uint256 numer = Math.rdiv(inTokenReserve.balance, inTokenReserve.weight);
        uint256 denom = Math.rdiv(outTokenReserve.balance, outTokenReserve.weight);
        uint256 ratio = Math.rdiv(numer, denom);
        uint256 scale = Math.rdiv(Math.RAY, Math.RAY.sub(swapFee));

        spot = Math.rmul(ratio, scale);
    }

    function _calcOutAmount(
        TokenReserve memory inTokenReserve,
        TokenReserve memory outTokenReserve,
        uint256 swapFee,
        uint256 inAmount
    ) internal pure returns (uint256 outAmount) {
        uint256 weightRatio = Math.rdiv(inTokenReserve.weight, outTokenReserve.weight);
        uint256 adjustedIn = Math.RAY.sub(swapFee);
        adjustedIn = Math.rmul(inAmount, adjustedIn);
        uint256 y = Math.rdiv(inTokenReserve.balance, inTokenReserve.balance.add(adjustedIn));
        uint256 foo = Math.rpow(y, weightRatio);
        uint256 bar = Math.RAY.sub(foo);

        outAmount = Math.rmul(outTokenReserve.balance, bar);
    }

    function _calcInAmount(
        TokenReserve memory inTokenReserve,
        TokenReserve memory outTokenReserve,
        uint256 swapFee,
        uint256 outAmount
    ) internal returns (uint256 inAmount) {
        uint256 weightRatio = Math.rdiv(outTokenReserve.weight, inTokenReserve.weight);
        uint256 diff = outTokenReserve.balance.sub(outAmount);
        uint256 y = Math.rdiv(outTokenReserve.balance, diff);
        uint256 foo = Math.rpow(y, weightRatio);

        foo = foo.sub(Math.RAY);
        inAmount = Math.RAY.sub(swapFee);
        inAmount = Math.rdiv(Math.rmul(inTokenReserve.balance, foo), inAmount);
    }

    function _calcOutAmountLp(
        uint256 inAmount,
        TokenReserve memory inTokenReserve,
        uint256 swapFee,
        uint256 totalSupplyLp,
        uint256 totalWeight
    ) internal pure returns (uint256 outAmountLp) {
        uint256 nWeight = Math.rdiv(inTokenReserve.weight, totalWeight);
        uint256 feePortion = Math.rmul(Math.RAY.sub(nWeight), swapFee);
        uint256 inAmoutAfterFee = Math.rmul(inAmount, Math.RAY.sub(feePortion));

        uint256 inBalanceUpdated = inTokenReserve.balance.add(inAmoutAfterFee);
        uint256 inTokenRatio = Math.rdiv(inBalanceUpdated, inTokenReserve.balance);

        uint256 lpTokenRatio = Math.rpow(inTokenRatio, nWeight);
        uint256 totalSupplyLpUpdated = Math.rmul(lpTokenRatio, totalSupplyLp);
        outAmountLp = totalSupplyLpUpdated.sub(totalSupplyLp);
        return outAmountLp;
    }

    function _calcOutAmountToken(
        IBenchmarkData data,
        TokenReserve memory outTokenReserve,
        uint256 totalSupplyLp,
        uint256 totalWeight,
        uint256 inAmountLp
    ) internal view returns (uint256 outAmountToken) {
        uint256 nWeight = Math.rdiv(outTokenReserve.weight, totalWeight);
        uint256 inAmountLpAfterExitFee = Math.rmul(inAmountLp, Math.RAY.sub(data.exitFee()));
        uint256 totalSupplyLpUpdated = totalSupplyLp.sub(inAmountLpAfterExitFee);
        uint256 lpRatio = Math.rdiv(totalSupplyLpUpdated, totalSupplyLp);

        uint256 outTokenRatio = Math.rpow(lpRatio, Math.rdiv(Math.RAY, nWeight));
        uint256 outTokenBalanceUpdated = Math.rmul(outTokenRatio, outTokenReserve.balance);

        uint256 outAmountTOkenBeforeSwapFee = outTokenReserve.balance.sub(outTokenBalanceUpdated);

        uint256 feePortion = Math.rmul(Math.RAY.sub(nWeight), data.swapFee());
        outAmountToken = Math.rmul(outAmountTOkenBeforeSwapFee, Math.RAY.sub(feePortion));
        return outAmountToken;
    }

    function _pullToken(
        address tokenAddr,
        address fromAddr,
        uint256 amountToPull
    ) internal {
        IERC20(tokenAddr).safeTransferFrom(fromAddr, address(this), amountToPull);
    }

    function _pushToken(
        address tokenAddr,
        address toAddr,
        uint256 amountToPush
    ) internal {
        IERC20(tokenAddr).safeTransfer(toAddr, amountToPush);
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

    function _updateWeight() internal {
        uint256 currentTime = block.timestamp;
        uint256 endTime = IBenchmarkYieldToken(xyt).expiry();
        uint256 duration = 6 * 3600 * 24 * 30;

        TokenReserve storage xytReserve = reserves[xyt];
        TokenReserve storage tokenReserve = reserves[token];

        uint256 xytWeight = xytReserve.weight;
        uint256 tokenWeight = tokenReserve.weight;
        console.log("\tendTime,", endTime);
        console.log("\tcurrentTime,", currentTime);
        console.log("\tduration,", duration);

        require((endTime - currentTime) <= duration, "ERR_WRONG_DURATION");

        uint256 timeToMature = Math.rdiv((endTime - currentTime) * Math.RAY, duration * Math.RAY);
        uint256 priceNow =
            Math.rdiv(
                Math.ln(Math.rmul(Math.PI, timeToMature).add(Math.RAY), Math.RAY),
                Math.ln(Math.PI_PLUSONE, Math.RAY)
            );
        uint256 r = Math.rdiv(priceNow, priceLast);
        require(Math.RAY >= r, "ERR_WRONG_R_VALUE");

        uint256 thetaNumerator = Math.rmul(Math.rmul(xytWeight, tokenWeight), Math.RAY.sub(r));
        uint256 thetaDenominator = Math.rmul(r, xytWeight).add(tokenWeight);

        uint256 theta = Math.rdiv(thetaNumerator, thetaDenominator);

        uint256 xytWeightUpdated = xytWeight.sub(theta);
        uint256 tokenWeightUpdated = tokenWeight.add(theta);

        reserves[xyt].weight = xytWeightUpdated;
        reserves[token].weight = tokenWeightUpdated;
        priceLast = priceNow;

        emit Shift(xytWeight, tokenWeight, xytWeightUpdated, tokenWeightUpdated);
    }

    function _curveShift() internal {
        if (block.number > blockNumLast) {
            _updateWeight();
            blockNumLast = block.number;
        }
    }

    // sends out any due interests to msg.sender if he's an LP holder
    // this should be called before any functions that change someone's LPs
    function _settleLpInterests(address account) internal {
        _updateGlobalIncomeIndex();
        if (lastGlobalIncomeIndex[account] == 0) {
            lastGlobalIncomeIndex[account] = globalIncomeIndex;
            return;
        }

        uint256 dueInterests =
            balanceOf[account].mul(globalIncomeIndex - lastGlobalIncomeIndex[account]).div(
                GLOBAL_INCOME_INDEX_MULTIPLIER
            );
        /* console.log("\t[contract] dueInterests in _settleLpInterests = ", dueInterests, account); */

        lastGlobalIncomeIndex[account] = globalIncomeIndex;
        if (dueInterests == 0) return;
        IERC20(IBenchmarkYieldToken(xyt).underlyingYieldToken()).safeTransfer(
            account,
            dueInterests
        );

        console.log("Settled LP interests for ", account);
        printAcc(account);
    }

    // this function should be called whenver the total amount of LP changes
    //
    function _updateGlobalIncomeIndex() internal {
        uint256 currentUnderlyingYieldTokenBalance =
            IERC20(IBenchmarkYieldToken(xyt).underlyingYieldToken()).balanceOf(address(this));
        uint256 interestsEarned =
            currentUnderlyingYieldTokenBalance - lastUnderlyingYieldTokenBalance;
        lastUnderlyingYieldTokenBalance = currentUnderlyingYieldTokenBalance;

        globalIncomeIndex = globalIncomeIndex.add(
            interestsEarned.mul(GLOBAL_INCOME_INDEX_MULTIPLIER).div(totalSupply)
        );
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override {
        _settleLpInterests(from);
        _settleLpInterests(to);
    }
}
