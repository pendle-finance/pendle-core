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

import "../interfaces/IPendleData.sol";
import "../interfaces/IPendleMarket.sol";
import "../interfaces/IPendleYieldToken.sol";
import "../tokens/PendleBaseToken.sol";
import "../libraries/PendleLibrary.sol";
import {Math} from "../libraries/PendleLibrary.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "hardhat/console.sol";

contract PendleMarket is IPendleMarket, PendleBaseToken {
    using Math for uint256;
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    IPendle public immutable override core;
    address public immutable override factory;
    address public immutable override forge;
    address public immutable override token;
    address public immutable override xyt;
    uint256 public constant override minLiquidity = 10**3;
    string private constant NAME = "Pendle Market";
    string private constant SYMBOL = "PENDLE-LPT";
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

    struct TokenReserve {
        uint256 weight;
        uint256 balance;
    }

    mapping(address => TokenReserve) private reserves;

    constructor(
        address _creator,
        IPendle _core,
        address _forge,
        address _xyt,
        address _token,
        uint256 _expiry
    ) PendleBaseToken(NAME, SYMBOL, DECIMALS, block.timestamp, _expiry) {
        require(address(_core) != address(0), "Pendle: zero address");
        require(_forge != address(0), "Pendle: zero address");
        require(_xyt != address(0), "Pendle: zero address");
        require(_token != address(0), "Pendle: zero address");

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
        require(bootstrapped, "Pendle: not bootstrapped");
        _;
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

    function bootstrap(
        address _msgSender,
        uint256 initialXytLiquidity,
        uint256 initialTokenLiquidity
    ) external override {
        reserves[xyt].balance = initialXytLiquidity;
        reserves[xyt].weight = Math.FORMULA_PRECISION / 2;
        reserves[token].balance = initialTokenLiquidity;
        reserves[token].weight = Math.FORMULA_PRECISION / 2;

        blockNumLast = block.number; //@@XM added for curve shifting
        bootstrapped = true;

        emit Sync(
            reserves[xyt].balance,
            reserves[xyt].weight,
            reserves[token].balance,
            reserves[token].weight
        );

        _pullToken(xyt, _msgSender, initialXytLiquidity);
        _pullToken(token, _msgSender, initialTokenLiquidity);

        _mintLpToken(INITIAL_LP_FOR_CREATOR);
        _pushLpToken(_msgSender, INITIAL_LP_FOR_CREATOR);
    }

    function spotPrice(address inToken, address outToken)
        external
        view
        override
        returns (uint256 spot)
    {
        IPendleData data = core.data();
        TokenReserve storage inTokenReserve = reserves[inToken];
        TokenReserve storage outTokenReserve = reserves[outToken];

        return _calcSpotPrice(inTokenReserve, outTokenReserve, data.swapFee());
    }

    function swapAmountIn(
        address _msgSender,
        uint256 exactIn,
        address inToken,
        address outToken,
        uint256 minOut,
        uint256 maxPrice
    ) external override isBootstrapped returns (uint256 exactOut, uint256 spotPriceAfter) {
        _curveShift();

        IPendleData data = core.data();
        TokenReserve storage inTokenReserve = reserves[inToken];
        TokenReserve storage outTokenReserve = reserves[outToken];

        uint256 spotPriceBefore = _calcSpotPrice(inTokenReserve, outTokenReserve, data.swapFee());
        require(spotPriceBefore <= maxPrice, "Pendle: high before spotprice");

        //calc out amount
        exactOut = _calcOutAmount(inTokenReserve, outTokenReserve, data.swapFee(), exactIn);
        require(exactOut >= minOut, "Pendle: low out amount");

        inTokenReserve.balance = inTokenReserve.balance.add(exactIn);
        outTokenReserve.balance = outTokenReserve.balance.sub(exactOut);

        spotPriceAfter = _calcSpotPrice(inTokenReserve, outTokenReserve, data.swapFee());

        require(spotPriceAfter >= spotPriceBefore, "Pendle: small after spotprice");
        require(spotPriceAfter <= maxPrice, "Pendle: high after spotprice");
        require(spotPriceBefore <= Math.rdiv(exactIn, exactOut), "Pendle: math problem");

        emit Sync(
            reserves[xyt].balance,
            reserves[xyt].weight,
            reserves[token].balance,
            reserves[token].weight
        );
        emit Swap(_msgSender, inToken, outToken, exactIn, exactOut, _msgSender);

        _pullToken(inToken, _msgSender, exactIn);
        _pushToken(outToken, _msgSender, exactOut);

        return (exactOut, spotPriceAfter);
    }

    function swapAmountOut(
        address _msgSender,
        address inToken,
        uint256 maxIn,
        address outToken,
        uint256 exactOut,
        uint256 maxPrice
    ) external override isBootstrapped returns (uint256 exactIn, uint256 spotPriceAfter) {
        _curveShift();

        IPendleData data = core.data();
        TokenReserve storage inTokenReserve = reserves[inToken];
        TokenReserve storage outTokenReserve = reserves[outToken];

        //calc spot price
        uint256 spotPriceBefore = _calcSpotPrice(inTokenReserve, outTokenReserve, data.swapFee());
        require(spotPriceBefore <= maxPrice, "Pendle: high before spotprice");

        //calc in amount
        exactIn = _calcInAmount(inTokenReserve, outTokenReserve, data.swapFee(), exactOut);
        require(exactIn <= maxIn, "Pendle: high in amount");

        inTokenReserve.balance = inTokenReserve.balance.add(exactIn);
        outTokenReserve.balance = outTokenReserve.balance.sub(exactOut);

        spotPriceAfter = _calcSpotPrice(inTokenReserve, outTokenReserve, data.swapFee());

        require(spotPriceAfter >= spotPriceBefore, "Pendle: small after spotprice");
        require(spotPriceAfter <= maxPrice, "Pendle: high after spotprice");
        require(spotPriceBefore <= Math.rdiv(exactIn, exactOut), "Pendle: math problem");

        emit Sync(
            reserves[xyt].balance,
            reserves[xyt].weight,
            reserves[token].balance,
            reserves[token].weight
        );
        emit Swap(_msgSender, inToken, outToken, exactIn, exactOut, _msgSender);

        _pullToken(inToken, _msgSender, exactIn);
        _pushToken(outToken, _msgSender, exactOut);

        return (exactIn, spotPriceAfter);
    }

    /**
     * @notice join the pool by putting in xytToken and pairTokens
     * and get back desired amount of lpToken
     */

    function joinPoolByAll(
        address _msgSender,
        uint256 exactOutLp,
        uint256 maxInXyt,
        uint256 maxInPair
    ) external override isBootstrapped {
        uint256 totalLp = totalSupply;
        uint256 ratio = Math.rdiv(exactOutLp, totalLp);
        require(ratio != 0, "Pendle: zero ratio");

        //calc and inject xyt token
        uint256 balanceToken = reserves[xyt].balance;
        uint256 exactIn = Math.rmul(ratio, balanceToken);
        require(exactIn != 0, "Pendle: zero xyt in amount");
        require(exactIn <= maxInXyt, "Pendle: high xyt in amount");
        reserves[xyt].balance = reserves[xyt].balance.add(exactIn);
        _pullToken(xyt, _msgSender, exactIn);

        //calc and inject pair token
        balanceToken = reserves[token].balance;
        exactIn = Math.rmul(ratio, balanceToken);
        require(exactIn != 0, "Pendle: zero token in amount");
        require(exactIn <= maxInPair, "Pendle: high token in amount");
        reserves[token].balance = reserves[token].balance.add(exactIn);
        _pullToken(token, _msgSender, exactIn);

        emit Sync(
            reserves[xyt].balance,
            reserves[xyt].weight,
            reserves[token].balance,
            reserves[token].weight
        );

        //mint and push lp token
        _mintLpToken(exactOutLp);
        _pushLpToken(_msgSender, exactOutLp);
        printAcc(_msgSender);
    }

    function printAcc(address a) internal view {
        console.log("\t\t[contract] Details for ", a);
        console.log("\t\t\t[contract] globalIncomeIndex=", globalIncomeIndex);
        console.log(
            "\t\t\t[contract] underlyingYieldTokenAsset bal of account=",
            IERC20(IPendleYieldToken(xyt).underlyingYieldToken()).balanceOf(a)
        );
        console.log(
            "\t\t\t[contract] underlyingYieldToken bal of amm =",
            IERC20(IPendleYieldToken(xyt).underlyingYieldToken()).balanceOf(address(this))
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
        address _msgSender,
        uint256 exactInLp,
        uint256 minOutXyt,
        uint256 minOutPair
    ) external override isBootstrapped {
        IPendleData data = core.data();
        uint256 exitFee = data.exitFee();
        uint256 totalLp = totalSupply;
        uint256 exitFees = Math.rmul(exactInLp, exitFee);
        uint256 inLpAfterExitFee = exactInLp.sub(exitFee);
        uint256 ratio = Math.rdiv(inLpAfterExitFee, totalLp);
        require(ratio != 0, "Pendle: zero ratio");

        //calc and withdraw xyt token
        uint256 balanceToken = reserves[xyt].balance;
        uint256 exactOut = Math.rmul(ratio, balanceToken);
        require(exactOut != 0, "Pendle: zero xyt out amount");
        require(exactOut >= minOutXyt, "Pendle: low xyt out amount");
        reserves[xyt].balance = reserves[xyt].balance.sub(exactOut);
        _pushToken(xyt, _msgSender, exactOut);

        //calc and withdraw pair token
        balanceToken = reserves[token].balance;
        exactOut = Math.rmul(ratio, balanceToken);
        require(exactOut != 0, "Pendle: zero token out amount");
        require(exactOut >= minOutPair, "Pendle: low token out amount");
        reserves[token].balance = reserves[token].balance.sub(exactOut);
        _pushToken(token, _msgSender, exactOut);

        //let's deal with lp last
        _pullLpToken(_msgSender, exactInLp);
        _pushLpToken(factory, exitFees);
        _burnLpToken(inLpAfterExitFee);

        emit Sync(
            reserves[xyt].balance,
            reserves[xyt].weight,
            reserves[token].balance,
            reserves[token].weight
        );
    }

    function joinPoolSingleToken(
        address _msgSender,
        address inToken,
        uint256 exactIn,
        uint256 minOutLp
    ) external override isBootstrapped returns (uint256 exactOutLp) {
        IPendleData data = core.data();
        TokenReserve storage inTokenReserve = reserves[inToken];
        uint256 totalLp = totalSupply;
        uint256 totalWeight = reserves[xyt].weight.add(reserves[token].weight);

        //calc out amount of lp token
        exactOutLp = _calcOutAmountLp(
            exactIn,
            inTokenReserve,
            data.swapFee(),
            totalLp,
            totalWeight
        );
        require(exactOutLp >= minOutLp, "Pendle: bad lp out amount");

        //update reserves and operate underlying lp and intoken
        inTokenReserve.balance = inTokenReserve.balance.add(exactIn);

        emit Sync(
            reserves[xyt].balance,
            reserves[xyt].weight,
            reserves[token].balance,
            reserves[token].weight
        );

        _mintLpToken(exactOutLp);
        _pushLpToken(_msgSender, exactOutLp);
        _pullToken(inToken, _msgSender, exactIn);

        return exactOutLp;
    }

    function exitPoolSingleToken(
        address _msgSender,
        address outToken,
        uint256 exactInLp,
        uint256 minOutToken
    ) external override isBootstrapped returns (uint256 exactOutToken) {
        IPendleData data = core.data();
        TokenReserve storage outTokenReserve = reserves[outToken];
        uint256 exitFee = data.exitFee();
        uint256 totalLp = totalSupply;
        uint256 totalWeight = reserves[xyt].weight.add(reserves[token].weight);

        exactOutToken = _calcOutAmountToken(
            data,
            outTokenReserve,
            totalLp,
            totalWeight,
            exactInLp
        );
        require(exactOutToken >= minOutToken, "Pendle: bad token out amount");

        //update reserves and operate underlying lp and outtoken
        outTokenReserve.balance = outTokenReserve.balance.sub(exactOutToken);

        uint256 exitFees = Math.rmul(exactInLp, data.exitFee());


        _pullLpToken(_msgSender, exactInLp);
        _burnLpToken(exactInLp.sub(exitFees));
        _pushLpToken(factory, exitFee);
        _pushToken(outToken, _msgSender, exactOutToken);

<<<<<<< HEAD
        emit Sync(
            reserves[xyt].balance,
            reserves[xyt].weight,
            reserves[token].balance,
            reserves[token].weight
        );
=======
>>>>>>> 1465b92caa47a0a9f004ec8fed7f78a71b9063e1
        return exactOutToken;
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
        uint256 scale = Math.rdiv(Math.FORMULA_PRECISION, Math.FORMULA_PRECISION.sub(swapFee));

        spot = Math.rmul(ratio, scale);
    }

    function _calcOutAmount(
        TokenReserve memory inTokenReserve,
        TokenReserve memory outTokenReserve,
        uint256 swapFee,
        uint256 exactIn
    ) internal pure returns (uint256 exactOut) {
        uint256 weightRatio = Math.rdiv(inTokenReserve.weight, outTokenReserve.weight);
        uint256 adjustedIn = Math.FORMULA_PRECISION.sub(swapFee);
        adjustedIn = Math.rmul(exactIn, adjustedIn);
        uint256 y = Math.rdiv(inTokenReserve.balance, inTokenReserve.balance.add(adjustedIn));
        uint256 foo = Math.rpow(y, weightRatio);
        uint256 bar = Math.FORMULA_PRECISION.sub(foo);

        exactOut = Math.rmul(outTokenReserve.balance, bar);
    }

    function _calcInAmount(
        TokenReserve memory inTokenReserve,
        TokenReserve memory outTokenReserve,
        uint256 swapFee,
        uint256 exactOut
    ) internal pure returns (uint256 inAmount) {
        uint256 weightRatio = Math.rdiv(outTokenReserve.weight, inTokenReserve.weight);
        uint256 diff = outTokenReserve.balance.sub(exactOut);
        uint256 y = Math.rdiv(outTokenReserve.balance, diff);
        uint256 foo = Math.rpow(y, weightRatio);

        foo = foo.sub(Math.FORMULA_PRECISION);
        inAmount = Math.FORMULA_PRECISION.sub(swapFee);
        inAmount = Math.rdiv(Math.rmul(inTokenReserve.balance, foo), inAmount);
    }

    function _calcOutAmountLp(
        uint256 inAmount,
        TokenReserve memory inTokenReserve,
        uint256 swapFee,
        uint256 totalSupplyLp,
        uint256 totalWeight
    ) internal pure returns (uint256 exactOutLp) {
        uint256 nWeight = Math.rdiv(inTokenReserve.weight, totalWeight);
        uint256 feePortion = Math.rmul(Math.FORMULA_PRECISION.sub(nWeight), swapFee);
        uint256 inAmoutAfterFee = Math.rmul(inAmount, Math.FORMULA_PRECISION.sub(feePortion));

        uint256 inBalanceUpdated = inTokenReserve.balance.add(inAmoutAfterFee);
        uint256 inTokenRatio = Math.rdiv(inBalanceUpdated, inTokenReserve.balance);

        uint256 lpTokenRatio = Math.rpow(inTokenRatio, nWeight);
        uint256 totalSupplyLpUpdated = Math.rmul(lpTokenRatio, totalSupplyLp);
        exactOutLp = totalSupplyLpUpdated.sub(totalSupplyLp);
        return exactOutLp;
    }

    function _calcOutAmountToken(
        IPendleData data,
        TokenReserve memory outTokenReserve,
        uint256 totalSupplyLp,
        uint256 totalWeight,
        uint256 inAmountLp
    ) internal view returns (uint256 exactOutToken) {
        uint256 nWeight = Math.rdiv(outTokenReserve.weight, totalWeight);
        uint256 inAmountLpAfterExitFee =
            Math.rmul(inAmountLp, Math.FORMULA_PRECISION.sub(data.exitFee()));
        uint256 totalSupplyLpUpdated = totalSupplyLp.sub(inAmountLpAfterExitFee);
        uint256 lpRatio = Math.rdiv(totalSupplyLpUpdated, totalSupplyLp);

        uint256 outTokenRatio = Math.rpow(lpRatio, Math.rdiv(Math.FORMULA_PRECISION, nWeight));
        uint256 outTokenBalanceUpdated = Math.rmul(outTokenRatio, outTokenReserve.balance);

        uint256 outAmountTOkenBeforeSwapFee = outTokenReserve.balance.sub(outTokenBalanceUpdated);

        uint256 feePortion = Math.rmul(Math.FORMULA_PRECISION.sub(nWeight), data.swapFee());
        exactOutToken = Math.rmul(
            outAmountTOkenBeforeSwapFee,
            Math.FORMULA_PRECISION.sub(feePortion)
        );
        return exactOutToken;
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
        uint256 endTime = IPendleYieldToken(xyt).expiry();
        uint256 startTime = IPendleYieldToken(xyt).start();
        //uint256 duration = 6 * 3600 * 24 * 30;
        uint256 duration = endTime - startTime;

        TokenReserve storage xytReserve = reserves[xyt];
        TokenReserve storage tokenReserve = reserves[token];

        uint256 xytWeight = xytReserve.weight;
        uint256 tokenWeight = tokenReserve.weight;
        console.log("\tendTime,", endTime);
        console.log("\tcurrentTime,", currentTime);
        console.log("\tduration,", duration);
        console.log("\tWeights before shifting,", xytWeight, tokenWeight);

        require((endTime - currentTime) <= duration, "Pendle: wrong duration");

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
        require(Math.FORMULA_PRECISION >= r, "Pendle: wrong r value");

        uint256 thetaNumerator =
            Math.rmul(Math.rmul(xytWeight, tokenWeight), Math.FORMULA_PRECISION.sub(r));
        uint256 thetaDenominator = Math.rmul(r, xytWeight).add(tokenWeight);

        uint256 theta = Math.rdiv(thetaNumerator, thetaDenominator);

        uint256 xytWeightUpdated = xytWeight.sub(theta);
        uint256 tokenWeightUpdated = tokenWeight.add(theta);

        reserves[xyt].weight = xytWeightUpdated;
        reserves[token].weight = tokenWeightUpdated;
        priceLast = priceNow;
        console.log("\tNew weights: ", xytWeightUpdated, tokenWeightUpdated);
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
        IERC20(IPendleYieldToken(xyt).underlyingYieldToken()).safeTransfer(account, dueInterests);

        console.log("Settled LP interests for ", account);
        printAcc(account);
    }

    // this function should be called whenver the total amount of LP changes
    //
    function _updateGlobalIncomeIndex() internal {
        uint256 currentUnderlyingYieldTokenBalance =
            IERC20(IPendleYieldToken(xyt).underlyingYieldToken()).balanceOf(address(this));
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
