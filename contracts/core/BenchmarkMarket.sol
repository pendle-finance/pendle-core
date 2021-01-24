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
pragma experimental ABIEncoderV2;

import "../interfaces/IBenchmarkData.sol";
import "../interfaces/IBenchmarkMarket.sol";
import "../interfaces/IBenchmarkMarketFactory.sol";
import "../interfaces/IBenchmarkYieldToken.sol";
import "../tokens/BenchmarkBaseToken.sol";
import "../libraries/BenchmarkLibrary.sol";
import {Math} from "../libraries/BenchmarkLibrary.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

contract BenchmarkMarket is IBenchmarkMarket, BenchmarkBaseToken {
    using Math for uint256;
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    address public immutable override factory;
    address public immutable override forge;
    address public immutable override token;
    address public immutable override xyt;
    uint256 public constant MIN_LIQUIDITY = 10**3;
    string private constant NAME = "Pendle Market";
    string private constant SYMBOL = "BMK-LPT";
    uint256 private constant INITIAL_LP_FOR_CREATOR = 10**18; // arbitrary number
    uint8 private constant DECIMALS = 18;
    address public creator;
    bool public bootstrapped;
    uint256 private priceLast = Math.FORMULA_PRECISION;
    uint256 private blockNumLast;
    uint256 public lastUnderlyingYieldTokenBalance;
    uint256 public globalIncomeIndex;
    uint256 private constant GLOBAL_INCOME_INDEX_MULTIPLIER = 10**8;
    mapping(address => uint256) public lastGlobalIncomeIndex;
    mapping(address => TokenReserve) private reserves;

    constructor(
        address _creator,
        address _forge,
        address _xyt,
        address _token,
        uint256 _expiry
    ) BenchmarkBaseToken(NAME, SYMBOL, DECIMALS, block.timestamp, _expiry) {
        require(_forge != address(0), "Benchmark: zero address");
        require(_xyt != address(0), "Benchmark: zero address");
        require(_token != address(0), "Benchmark: zero address");

        factory = msg.sender;
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

    modifier onlyCore() {
        address core = address(IBenchmarkMarketFactory(factory).core());
        require(msg.sender == core, "Benchmark: only core");
        _;
    }

    function bootstrap(uint256 initialXytLiquidity, uint256 initialTokenLiquidity)
        external
        override
        onlyCore
        returns (address, uint256)
    {
        _transferIn(xyt, initialXytLiquidity);
        _transferIn(token, initialTokenLiquidity);

        reserves[xyt].balance = initialXytLiquidity;
        reserves[xyt].weight = Math.FORMULA_PRECISION / 2;
        reserves[token].balance = initialTokenLiquidity;
        reserves[token].weight = Math.FORMULA_PRECISION / 2;

        _mintLp(INITIAL_LP_FOR_CREATOR);
        _transferOutLp(INITIAL_LP_FOR_CREATOR);

        blockNumLast = block.number;
        bootstrapped = true;

        return (address(this), INITIAL_LP_FOR_CREATOR);
    }

    /**
     * @notice Exit the market by putting in the desired amount of LP tokens
     *         and getting back XYT and pair tokens.
     */
    function exitMarketByAll(
        uint256 inAmountLp,
        uint256 minOutAmountXyt,
        uint256 minOutAmountPair
    ) external override onlyCore returns (uint256 xytOut, uint256 tokenOut) {
        IBenchmark core = IBenchmarkMarketFactory(factory).core();
        IBenchmarkData data = core.data();
        uint256 exitFee = data.exitFee();
        uint256 totalLp = totalSupply;
        uint256 exitFees = Math.rmul(inAmountLp, exitFee);
        uint256 inLpAfterExitFee = inAmountLp.sub(exitFee);
        uint256 ratio = Math.rdiv(inLpAfterExitFee, totalLp);
        require(ratio != 0, "Benchmark: math problem");

        // Calc and withdraw xyt token.
        uint256 balanceToken = reserves[xyt].balance;
        uint256 outAmount = Math.rmul(ratio, balanceToken);
        require(outAmount != 0, "Benchmark: math problem");
        require(outAmount >= minOutAmountXyt, "Benchmark: beyond amount limit");
        reserves[xyt].balance = reserves[xyt].balance.sub(outAmount);
        xytOut = outAmount;
        emit Exit(xyt, outAmount);
        _transferOut(xyt, outAmount);

        // Calc and withdraw pair token.
        balanceToken = reserves[token].balance;
        outAmount = Math.rmul(ratio, balanceToken);
        require(outAmount != 0, "Benchmark: math problem");
        require(outAmount >= minOutAmountPair, "Benchmark: beyond amount limit");
        reserves[token].balance = reserves[token].balance.sub(outAmount);
        tokenOut = outAmount;
        emit Exit(token, outAmount);
        _transferOut(token, outAmount);

        // Deal with lp last.
        _transferInLp(inAmountLp);
        _collectFees(exitFees);
        _burnLp(inLpAfterExitFee);
    }

    function exitMarketSingleToken(
        address outToken,
        uint256 inAmountLp,
        uint256 minOutAmountToken
    ) external override onlyCore returns (uint256 outAmountToken) {
        IBenchmark core = IBenchmarkMarketFactory(factory).core();
        IBenchmarkData data = core.data();
        TokenReserve storage outTokenReserve = reserves[outToken];
        uint256 exitFee = data.exitFee();
        uint256 exitFees = Math.rmul(inAmountLp, data.exitFee());
        uint256 totalLp = totalSupply;
        uint256 totalWeight = reserves[xyt].weight.add(reserves[token].weight);

        outAmountToken = _calcOutAmountToken(
            data,
            outTokenReserve,
            totalLp,
            totalWeight,
            inAmountLp
        );
        require(outAmountToken >= minOutAmountToken, "Benchmark: bad token out amount");

        // Update reserves and operate underlying LP and outToken
        outTokenReserve.balance = outTokenReserve.balance.sub(outAmountToken);

        emit Exit(outToken, outAmountToken);

        _transferInLp(inAmountLp);
        _collectFees(exitFee);
        _burnLp(inAmountLp.sub(exitFees));
        _transferOut(outToken, outAmountToken);

        return outAmountToken;
    }

    /**
     * @notice Join the market by putting in xytToken and pairTokens
    *          and get back desired amount of lpToken.
     */
    function joinMarketByAll(
        uint256 outAmountLp,
        uint256 maxInAmoutXyt,
        uint256 maxInAmountPair
    ) external override onlyCore {
        uint256 totalLp = totalSupply;
        uint256 ratio = Math.rdiv(outAmountLp, totalLp);
        require(ratio != 0, "Benchmark: math problem");

        // Calc and inject XYT token.
        uint256 balanceToken = reserves[xyt].balance;
        uint256 inAmount = Math.rmul(ratio, balanceToken);
        require(inAmount != 0, "Benchmark: math problem");
        require(inAmount <= maxInAmoutXyt, "Benchmark: beyond amount limit");
        reserves[xyt].balance = reserves[xyt].balance.add(inAmount);
        emit Join(xyt, inAmount);
        _transferIn(xyt, inAmount);

        // Calc and inject pair token.
        balanceToken = reserves[token].balance;
        inAmount = Math.rmul(ratio, balanceToken);
        require(inAmount != 0, "Benchmark: math problem");
        require(inAmount <= maxInAmountPair, "Benchmark: beyond amount limit");
        reserves[token].balance = reserves[token].balance.add(inAmount);
        emit Join(token, inAmount);
        _transferIn(token, inAmount);

        // Mint and push LP token.
        _mintLp(outAmountLp);
        _transferOutLp(outAmountLp);
    }

    function joinMarketSingleToken(
        address inToken,
        uint256 inAmount,
        uint256 minOutAmountLp
    ) external override onlyCore returns (uint256 outAmountLp) {
        IBenchmark core = IBenchmarkMarketFactory(factory).core();
        IBenchmarkData data = core.data();
        TokenReserve storage inTokenReserve = reserves[inToken];
        uint256 totalLp = totalSupply;
        uint256 totalWeight = reserves[xyt].weight.add(reserves[token].weight);

        // Calc out amount of LP token.
        outAmountLp = _calcOutAmountLp(
            inAmount,
            inTokenReserve,
            data.swapFee(),
            totalLp,
            totalWeight
        );
        require(outAmountLp >= minOutAmountLp, "Benchmark: bad lp out amount");

        // Update reserves and operate underlying LP and inToken.
        inTokenReserve.balance = inTokenReserve.balance.add(inAmount);
        emit Join(inToken, inAmount);
        _transferIn(inToken, inAmount);

        // Mint and push LP token.
        _mintLp(outAmountLp);
        _transferOutLp(outAmountLp);

        return outAmountLp;
    }

    function swapAmountExactIn(
        address inToken,
        uint256 inAmount,
        address outToken,
        uint256 minOutAmount,
        uint256 maxPrice
    ) external override onlyCore returns (uint256 outAmount, uint256 spotPriceAfter) {
        _curveShift();

        IBenchmark core = IBenchmarkMarketFactory(factory).core();
        IBenchmarkData data = core.data();
        TokenReserve storage inTokenReserve = reserves[inToken];
        TokenReserve storage outTokenReserve = reserves[outToken];

        uint256 spotPriceBefore = _calcSpotPrice(inTokenReserve, outTokenReserve, data.swapFee());
        require(spotPriceBefore <= maxPrice, "Benchmark: bad price");

        outAmount = calcOutAmount(inTokenReserve, outTokenReserve, inAmount, data.swapFee());
        require(outAmount >= minOutAmount, "Benchmark: low out amount");

        inTokenReserve.balance = inTokenReserve.balance.add(inAmount);
        outTokenReserve.balance = outTokenReserve.balance.sub(outAmount);

        spotPriceAfter = _calcSpotPrice(inTokenReserve, outTokenReserve, data.swapFee());

        require(spotPriceAfter >= spotPriceBefore, "Benchmark: math problem");
        require(spotPriceAfter <= maxPrice, "Benchmark: bad price");
        require(spotPriceBefore <= Math.rdiv(inAmount, outAmount), "Benchmark: math problem");

        emit Swap(inToken, inAmount, outToken, outAmount);

        _transferIn(inToken, inAmount);
        _transferOut(outToken, outAmount);

        return (outAmount, spotPriceAfter);
    }

    function swapAmountExactOut(
        address inToken,
        uint256 maxInAmount,
        address outToken,
        uint256 outAmount,
        uint256 maxPrice
    ) external override onlyCore returns (uint256 inAmount, uint256 spotPriceAfter) {
        _curveShift();

        IBenchmark core = IBenchmarkMarketFactory(factory).core();
        IBenchmarkData data = core.data();
        TokenReserve storage inTokenReserve = reserves[inToken];
        TokenReserve storage outTokenReserve = reserves[outToken];

        // Calc spot price.
        uint256 spotPriceBefore = _calcSpotPrice(inTokenReserve, outTokenReserve, data.swapFee());
        require(spotPriceBefore <= maxPrice, "Benchmark: bad price");

        // Calc in amount.
        inAmount = calcInAmount(inTokenReserve, outTokenReserve, data.swapFee(), outAmount);
        require(inAmount <= maxInAmount, "Benchmark: high in amount");

        inTokenReserve.balance = inTokenReserve.balance.add(inAmount);
        outTokenReserve.balance = outTokenReserve.balance.sub(outAmount);

        spotPriceAfter = _calcSpotPrice(inTokenReserve, outTokenReserve, data.swapFee());

        require(spotPriceAfter >= spotPriceBefore, "Benchmark: math problem");
        require(spotPriceAfter <= maxPrice, "Benchmark: bad price");
        require(spotPriceBefore <= Math.rdiv(inAmount, outAmount), "Benchmark: math problem");

        emit Swap(inToken, inAmount, outToken, outAmount);

        _transferIn(inToken, inAmount);
        _transferOut(outToken, outAmount);

        return (inAmount, spotPriceAfter);
    }

    function getReserves()
        external
        view
        override
        returns (
            uint256 xytReserves,
            uint256 tokenReserves,
            uint256 lastBlockTimestamp
        )
    {
        return (reserves[xyt].balance, reserves[token].balance, block.timestamp);
    }

    function calcInAmount(
        TokenReserve memory inTokenReserve,
        TokenReserve memory outTokenReserve,
        uint256 swapFee,
        uint256 outAmount
    ) public pure override returns (uint256 inAmount) {
        uint256 weightRatio = Math.rdiv(outTokenReserve.weight, inTokenReserve.weight);
        uint256 diff = outTokenReserve.balance.sub(outAmount);
        uint256 y = Math.rdiv(outTokenReserve.balance, diff);
        uint256 foo = Math.rpow(y, weightRatio);

        foo = foo.sub(Math.FORMULA_PRECISION);
        inAmount = Math.FORMULA_PRECISION.sub(swapFee);
        inAmount = Math.rdiv(Math.rmul(inTokenReserve.balance, foo), inAmount);
    }

    function calcOutAmount(
        TokenReserve memory inTokenReserve,
        TokenReserve memory outTokenReserve,
        uint256 inAmount,
        uint256 swapFee
    ) public pure override returns (uint256 outAmount) {
        uint256 weightRatio = Math.rdiv(inTokenReserve.weight, outTokenReserve.weight);
        uint256 adjustedIn = Math.FORMULA_PRECISION.sub(swapFee);
        adjustedIn = Math.rmul(inAmount, adjustedIn);
        uint256 y = Math.rdiv(inTokenReserve.balance, inTokenReserve.balance.add(adjustedIn));
        uint256 foo = Math.rpow(y, weightRatio);
        uint256 bar = Math.FORMULA_PRECISION.sub(foo);

        outAmount = Math.rmul(outTokenReserve.balance, bar);
    }

    function getBalance(address asset) external view override returns (uint256) {
        return reserves[asset].balance;
    }

    function getWeight(address asset) external view override returns (uint256) {
        return reserves[asset].weight;
    }

    function spotPrice(address inToken, address outToken)
        external
        view
        override
        returns (uint256 spot)
    {
        IBenchmark core = IBenchmarkMarketFactory(factory).core();
        IBenchmarkData data = core.data();
        TokenReserve storage inTokenReserve = reserves[inToken];
        TokenReserve storage outTokenReserve = reserves[outToken];

        return _calcSpotPrice(inTokenReserve, outTokenReserve, data.swapFee());
    }

    function _interestDistribute(address lp) internal returns (uint256 interestReturn) {}

    function _calcSpotPrice(
        TokenReserve memory inTokenReserve,
        TokenReserve memory outTokenReserve,
        uint256 swapFee
    ) internal pure returns (uint256 spot) {
        uint256 numer = Math.rdiv(inTokenReserve.balance, inTokenReserve.weight);
        uint256 denom = Math.rdiv(outTokenReserve.balance, outTokenReserve.weight);
        uint256 ratio = Math.rdiv(numer, denom);
        uint256 scale = Math.rdiv(Math.FORMULA_PRECISION, Math.FORMULA_PRECISION.sub(swapFee));

        spot = Math.rmul(ratio, scale);
    }

    function _calcOutAmountLp(
        uint256 inAmount,
        TokenReserve memory inTokenReserve,
        uint256 swapFee,
        uint256 totalSupplyLp,
        uint256 totalWeight
    ) internal pure returns (uint256 outAmountLp) {
        uint256 nWeight = Math.rdiv(inTokenReserve.weight, totalWeight);
        uint256 feePortion = Math.rmul(Math.FORMULA_PRECISION.sub(nWeight), swapFee);
        uint256 inAmoutAfterFee = Math.rmul(inAmount, Math.FORMULA_PRECISION.sub(feePortion));

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
        uint256 inAmountLpAfterExitFee =
            Math.rmul(inAmountLp, Math.FORMULA_PRECISION.sub(data.exitFee()));
        uint256 totalSupplyLpUpdated = totalSupplyLp.sub(inAmountLpAfterExitFee);
        uint256 lpRatio = Math.rdiv(totalSupplyLpUpdated, totalSupplyLp);

        uint256 outTokenRatio = Math.rpow(lpRatio, Math.rdiv(Math.FORMULA_PRECISION, nWeight));
        uint256 outTokenBalanceUpdated = Math.rmul(outTokenRatio, outTokenReserve.balance);

        uint256 outAmountTOkenBeforeSwapFee = outTokenReserve.balance.sub(outTokenBalanceUpdated);

        uint256 feePortion = Math.rmul(Math.FORMULA_PRECISION.sub(nWeight), data.swapFee());
        outAmountToken = Math.rmul(
            outAmountTOkenBeforeSwapFee,
            Math.FORMULA_PRECISION.sub(feePortion)
        );
        return outAmountToken;
    }

    /// @notice Sends fees as LP to Treasury
    function _collectFees(uint256 _amount) internal {
        IBenchmark core = IBenchmarkMarketFactory(factory).core();
        IBenchmarkData data = core.data();

        IERC20(address(this)).safeTransfer(data.treasury(), _amount);
    }


    /// @dev Inbound transfer from core to market
    function _transferIn(address _token, uint256 _amount) internal {
        IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);
    }

    /// @dev Outbound transfer from market to core
    function _transferOut(address _token, uint256 _amount) internal {
        IERC20(_token).safeTransfer(msg.sender, _amount);
    }

    function _transferInLp(uint256 amount) internal {
        _transferIn(address(this), amount);
    }

    function _transferOutLp(uint256 amount) internal {
        _transferOut(address(this), amount);
    }

    function _burnLp(uint256 amount) internal {
        _burn(address(this), amount);
    }

    function _mintLp(uint256 amount) internal {
        _mint(address(this), amount);
    }

    function _updateWeight() internal {
        uint256 currentTime = block.timestamp;
        uint256 endTime = IBenchmarkYieldToken(xyt).expiry();
        uint256 startTime = IBenchmarkYieldToken(xyt).start();
        //uint256 duration = 6 * 3600 * 24 * 30;
        uint256 duration = endTime - startTime;

        TokenReserve storage xytReserve = reserves[xyt];
        TokenReserve storage tokenReserve = reserves[token];

        uint256 xytWeight = xytReserve.weight;
        uint256 tokenWeight = tokenReserve.weight;

        require((endTime - currentTime) <= duration, "Benchmark: wrong duration");

        uint256 timeToMature =
            Math.rdiv(
                (endTime - currentTime) * Math.FORMULA_PRECISION,
                duration * Math.FORMULA_PRECISION
            );
        uint256 priceNow =
            Math.rdiv(
                Math.ln(
                    Math.rmul(Math.PI, timeToMature).add(Math.FORMULA_PRECISION),
                    Math.FORMULA_PRECISION
                ),
                Math.ln(Math.PI_PLUSONE, Math.FORMULA_PRECISION)
            );
        uint256 r = Math.rdiv(priceNow, priceLast);
        require(Math.FORMULA_PRECISION >= r, "Benchmark: wrong r value");

        uint256 thetaNumerator =
            Math.rmul(Math.rmul(xytWeight, tokenWeight), Math.FORMULA_PRECISION.sub(r));
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

        lastGlobalIncomeIndex[account] = globalIncomeIndex;
        if (dueInterests == 0) return;
        IERC20(IBenchmarkYieldToken(xyt).underlyingYieldToken()).safeTransfer(
            account,
            dueInterests
        );
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

    function _beforeTokenTransfer(address from, address to) internal override {
        _settleLpInterests(from);
        _settleLpInterests(to);
    }
}
