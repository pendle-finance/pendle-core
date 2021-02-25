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
pragma solidity 0.7.6;
pragma experimental ABIEncoderV2;

import "../interfaces/IPendleData.sol";
import "../interfaces/IPendleMarket.sol";
import "../interfaces/IPendleForge.sol";
import "../interfaces/IPendleMarketFactory.sol";
import "../interfaces/IPendleYieldToken.sol";
import "../tokens/PendleBaseToken.sol";
import "../libraries/MathLib.sol";
import "../libraries/MathLib.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

contract PendleMarket is IPendleMarket, PendleBaseToken {
    using Math for uint256;
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    address public immutable override factory;
    address public immutable override forge;
    address public immutable override token;
    address public immutable override xyt;
    uint256 public constant MIN_LIQUIDITY = 10**3;
    uint256 public lastUnderlyingYieldTokenBalance;
    uint256 public globalIncomeIndex;
    bool public bootstrapped;
    string private constant NAME = "Pendle Market";
    string private constant SYMBOL = "PENDLE-LPT";
    uint256 private constant INITIAL_LP = 10**18; // arbitrary number
    uint8 private constant DECIMALS = 18;
    uint256 private priceLast = Math.RONE;
    uint256 private blockNumLast;

    uint256 private constant GLOBAL_INCOME_INDEX_MULTIPLIER = 10**30;
    mapping(address => uint256) public lastGlobalIncomeIndex;
    mapping(address => TokenReserve) private reserves;
    uint256 public lastInterestUpdate;

    // the lockStartTime is set at the bootstrap time of the market, and will not
    // be changed for the entire market duration
    uint256 public lockStartTime;

    /* these variables are used often, so we get them once in the constructor
    and save gas for retrieving them afterwards */
    bytes32 private immutable forgeId;
    address private immutable underlyingAsset;
    IPendleData private immutable data;
    IPendleRouter private immutable router;
    uint256 private immutable xytStartTime;

    constructor(
        address _forge,
        address _xyt,
        address _token,
        uint256 _expiry
    ) PendleBaseToken(NAME, SYMBOL, DECIMALS, block.timestamp, _expiry) {
        require(_forge != address(0), "ZERO_ADDRESS");
        require(_xyt != address(0), "ZERO_ADDRESS");
        require(_token != address(0), "ZERO_ADDRESS");
        IPendleYieldToken xytContract = IPendleYieldToken(_xyt);
        require(xytContract.expiry() == _expiry, "INVALID_EXPIRY");

        factory = msg.sender;
        forge = _forge;
        xyt = _xyt;
        token = _token;
        bootstrapped = false;
        globalIncomeIndex = 1;

        forgeId = IPendleForge(_forge).forgeId();
        underlyingAsset = xytContract.underlyingAsset();
        expiry = _expiry;
        router = IPendleMarketFactory(msg.sender).router();
        data = IPendleMarketFactory(msg.sender).router().data();
        xytStartTime = IPendleYieldToken(_xyt).start();
    }

    modifier isBootstrapped {
        require(bootstrapped, "NOT_BOOTSTRAPPED");
        _;
    }

    modifier onlyRouter() {
        require(msg.sender == address(router), "ONLY_ROUTER");
        _;
    }

    modifier marketIsOpen() {
        require(block.timestamp < lockStartTime, "MARKET_LOCKED");
        _;
    }

    function bootstrap(uint256 initialXytLiquidity, uint256 initialTokenLiquidity)
        external
        override
        onlyRouter
        returns (uint256)
    {
        require(!bootstrapped, "ALREADY_BOOTSTRAPPED");
        _initializeLock(); // market's lock params should be initialized at bootstrap time

        _transferIn(xyt, initialXytLiquidity);
        _transferIn(token, initialTokenLiquidity);

        reserves[xyt].balance = initialXytLiquidity;
        reserves[xyt].weight = Math.RONE / 2;
        reserves[token].balance = initialTokenLiquidity;
        reserves[token].weight = Math.RONE / 2;

        emit Sync(
            reserves[xyt].balance,
            reserves[xyt].weight,
            reserves[token].balance,
            reserves[token].weight
        );

        _mintLp(INITIAL_LP);
        _transferOutLp(INITIAL_LP);

        blockNumLast = block.number;
        bootstrapped = true;

        return INITIAL_LP;
    }

    /**
     * @notice Join the market by putting in xytToken and pairTokens
     *          and get back desired amount of lpToken.
     * @dev no curveShift to save gas because this function
                doesn't depend on weights of tokens
     */
    function addMarketLiquidityAll(
        uint256 _exactOutLp,
        uint256 _maxInXyt,
        uint256 _maxInToken
    )
        external
        override
        isBootstrapped
        onlyRouter
        marketIsOpen
        returns (uint256 amountXytUsed, uint256 amountTokenUsed)
    {
        uint256 totalLp = totalSupply;
        uint256 ratio = Math.rdiv(_exactOutLp, totalLp);
        require(ratio != 0, "ZERO_RATIO");

        // Calc and inject XYT token.
        uint256 balanceXyt = reserves[xyt].balance;
        amountXytUsed = Math.rmul(ratio, balanceXyt);
        require(amountXytUsed != 0, "ZERO_XYT_IN_AMOUNT");
        require(amountXytUsed <= _maxInXyt, "LOW_XYT_IN_LIMIT");
        reserves[xyt].balance = reserves[xyt].balance.add(amountXytUsed);
        _transferIn(xyt, amountXytUsed);

        // Calc and inject pair token.
        uint256 balanceToken = reserves[token].balance;
        amountTokenUsed = Math.rmul(ratio, balanceToken);
        require(amountTokenUsed != 0, "ZERO_TOKEN_IN_AMOUNT");
        require(amountTokenUsed <= _maxInToken, "LOW_TOKEN_IN_LIMIT");
        reserves[token].balance = reserves[token].balance.add(amountTokenUsed);
        _transferIn(token, amountTokenUsed);

        emit Sync(
            reserves[xyt].balance,
            reserves[xyt].weight,
            reserves[token].balance,
            reserves[token].weight
        );

        // Mint and push LP token.
        _mintLp(_exactOutLp);
        _transferOutLp(_exactOutLp);

        return (amountXytUsed, amountTokenUsed);
    }

    function addMarketLiquiditySingle(
        address _inToken,
        uint256 _exactIn,
        uint256 _minOutLp
    ) external override isBootstrapped onlyRouter marketIsOpen returns (uint256 exactOutLp) {
        _curveShift(data);

        TokenReserve storage inTokenReserve = reserves[_inToken];
        uint256 totalLp = totalSupply;
        uint256 totalWeight = reserves[xyt].weight.add(reserves[token].weight);

        // Calc out amount of LP token.
        exactOutLp = _calcOutAmountLp(
            _exactIn,
            inTokenReserve,
            data.swapFee(),
            totalLp,
            totalWeight
        );
        require(exactOutLp >= _minOutLp, "HIGH_LP_OUT_LIMIT");

        // Update reserves and operate underlying LP and inToken.
        inTokenReserve.balance = inTokenReserve.balance.add(_exactIn);
        _transferIn(_inToken, _exactIn);

        // Mint and push LP token.
        _mintLp(exactOutLp);
        _transferOutLp(exactOutLp);

        emit Sync(
            reserves[xyt].balance,
            reserves[xyt].weight,
            reserves[token].balance,
            reserves[token].weight
        );

        return exactOutLp;
    }

    /**
     * @notice Exit the market by putting in the desired amount of LP tokens
     *         and getting back XYT and pair tokens.
     * @dev no curveShift to save gas because this function
                doesn't depend on weights of tokens
     * @dev this function will never be locked since we always let users withdraw
                their funds
     */
    function removeMarketLiquidityAll(
        uint256 _inLp,
        uint256 _minOutXyt,
        uint256 _minOutToken
    ) external override isBootstrapped onlyRouter returns (uint256 xytOut, uint256 tokenOut) {
        uint256 exitFee = data.exitFee();
        uint256 totalLp = totalSupply;
        uint256 exitFees = Math.rmul(_inLp, exitFee);
        uint256 inLpAfterExitFee = _inLp.sub(exitFee);
        uint256 ratio = Math.rdiv(inLpAfterExitFee, totalLp);
        require(ratio != 0, "ZERO_RATIO");

        // Calc and withdraw xyt token.
        uint256 balanceToken = reserves[xyt].balance;
        uint256 outAmount = Math.rmul(ratio, balanceToken);
        require(outAmount != 0, "MATH_ERROR");
        require(outAmount >= _minOutXyt, "INSUFFICIENT_XYT_OUT");
        reserves[xyt].balance = reserves[xyt].balance.sub(outAmount);
        xytOut = outAmount;
        _transferOut(xyt, outAmount);

        // Calc and withdraw pair token.
        balanceToken = reserves[token].balance;
        outAmount = Math.rmul(ratio, balanceToken);
        require(outAmount != 0, "MATH_ERROR");
        require(outAmount >= _minOutToken, "INSUFFICIENT_TOKEN_OUT");
        reserves[token].balance = reserves[token].balance.sub(outAmount);
        tokenOut = outAmount;
        _transferOut(token, outAmount);

        // Deal with lp last.
        _transferInLp(_inLp);
        _collectFees(exitFees);
        _burnLp(inLpAfterExitFee);
    }

    function removeMarketLiquiditySingle(
        address _outToken,
        uint256 _inLp,
        uint256 _minOutAmountToken
    ) external override isBootstrapped onlyRouter marketIsOpen returns (uint256 outAmountToken) {
        _curveShift(data);

        TokenReserve storage outTokenReserve = reserves[_outToken];
        uint256 exitFee = data.exitFee();
        uint256 exitFees = Math.rmul(_inLp, data.exitFee());
        uint256 totalLp = totalSupply;
        uint256 totalWeight = reserves[xyt].weight.add(reserves[token].weight);

        outAmountToken = _calcOutAmountToken(outTokenReserve, totalLp, totalWeight, _inLp);
        require(outAmountToken >= _minOutAmountToken, "INSUFFICIENT_TOKEN_OUT");

        // Update reserves and operate underlying LP and outToken
        outTokenReserve.balance = outTokenReserve.balance.sub(outAmountToken);

        _transferInLp(_inLp);
        _collectFees(exitFee);
        _burnLp(_inLp.sub(exitFees));
        _transferOut(_outToken, outAmountToken);

        return outAmountToken;
    }

    function swapExactIn(
        address inToken,
        uint256 inAmount,
        address outToken,
        uint256 minOutAmount,
        uint256 maxPrice
    )
        external
        override
        isBootstrapped
        onlyRouter
        marketIsOpen
        returns (uint256 outAmount, uint256 spotPriceAfter)
    {
        _curveShift(data);

        TokenReserve storage inTokenReserve = reserves[inToken];
        TokenReserve storage outTokenReserve = reserves[outToken];

        uint256 spotPriceBefore = _calcSpotPrice(inTokenReserve, outTokenReserve, data.swapFee());
        require(spotPriceBefore <= maxPrice, "LOW_MAX_PRICE");

        // calc out amount of token to be swapped out
        outAmount = calcExactOut(inTokenReserve, outTokenReserve, inAmount, data.swapFee());
        require(outAmount >= minOutAmount, "HIGH_OUT_LIMIT");

        inTokenReserve.balance = inTokenReserve.balance.add(inAmount);
        outTokenReserve.balance = outTokenReserve.balance.sub(outAmount);

        spotPriceAfter = _calcSpotPrice(inTokenReserve, outTokenReserve, data.swapFee());

        require(spotPriceAfter >= spotPriceBefore, "MATH_ERROR");
        require(spotPriceAfter <= maxPrice, "LOW_MAX_PRICE");
        require(spotPriceBefore <= Math.rdiv(inAmount, outAmount), "MATH_ERROR");

        emit Sync(
            reserves[xyt].balance,
            reserves[xyt].weight,
            reserves[token].balance,
            reserves[token].weight
        );

        _transferIn(inToken, inAmount);
        _transferOut(outToken, outAmount);

        return (outAmount, spotPriceAfter);
    }

    function swapExactOut(
        address inToken,
        uint256 maxInAmount,
        address outToken,
        uint256 outAmount,
        uint256 maxPrice
    )
        external
        override
        isBootstrapped
        onlyRouter
        marketIsOpen
        returns (uint256 inAmount, uint256 spotPriceAfter)
    {
        _curveShift(data);

        TokenReserve storage inTokenReserve = reserves[inToken];
        TokenReserve storage outTokenReserve = reserves[outToken];

        // Calc spot price.
        uint256 spotPriceBefore = _calcSpotPrice(inTokenReserve, outTokenReserve, data.swapFee());
        require(spotPriceBefore <= maxPrice, "LOW_MAX_PRICE");

        // Calc in amount.
        inAmount = calcExactIn(inTokenReserve, outTokenReserve, outAmount, data.swapFee());
        require(inAmount <= maxInAmount, "LOW_IN_LIMIT");

        inTokenReserve.balance = inTokenReserve.balance.add(inAmount);
        outTokenReserve.balance = outTokenReserve.balance.sub(outAmount);

        spotPriceAfter = _calcSpotPrice(inTokenReserve, outTokenReserve, data.swapFee());

        require(spotPriceAfter >= spotPriceBefore, "MATH_ERROR");
        require(spotPriceAfter <= maxPrice, "LOW_MAX_PRICE");
        require(spotPriceBefore <= Math.rdiv(inAmount, outAmount), "MATH_ERROR");

        emit Sync(
            reserves[xyt].balance,
            reserves[xyt].weight,
            reserves[token].balance,
            reserves[token].weight
        );

        _transferIn(inToken, inAmount);
        _transferOut(outToken, outAmount);

        return (inAmount, spotPriceAfter);
    }

    function claimLpInterests(address account)
        public
        override
        isBootstrapped
        onlyRouter
        returns (uint256 interests)
    {
        interests = _settleLpInterests(account);
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

    function calcExactIn(
        TokenReserve memory inTokenReserve,
        TokenReserve memory outTokenReserve,
        uint256 exactOut,
        uint256 swapFee
    ) public pure override returns (uint256 exactIn) {
        uint256 weightRatio = Math.rdiv(outTokenReserve.weight, inTokenReserve.weight);
        uint256 diff = outTokenReserve.balance.sub(exactOut);
        uint256 y = Math.rdiv(outTokenReserve.balance, diff);
        uint256 foo = Math.rpow(y, weightRatio);

        foo = foo.sub(Math.RONE);
        exactIn = Math.RONE.sub(swapFee);
        exactIn = Math.rdiv(Math.rmul(inTokenReserve.balance, foo), exactIn);
    }

    function calcExactOut(
        TokenReserve memory inTokenReserve,
        TokenReserve memory outTokenReserve,
        uint256 exactIn,
        uint256 swapFee
    ) public pure override returns (uint256 exactOut) {
        uint256 weightRatio = Math.rdiv(inTokenReserve.weight, outTokenReserve.weight);
        uint256 adjustedIn = Math.RONE.sub(swapFee);
        adjustedIn = Math.rmul(exactIn, adjustedIn);
        uint256 y = Math.rdiv(inTokenReserve.balance, inTokenReserve.balance.add(adjustedIn));
        uint256 foo = Math.rpow(y, weightRatio);
        uint256 bar = Math.RONE.sub(foo);

        exactOut = Math.rmul(outTokenReserve.balance, bar);
    }

    function getBalance(address asset) external view override returns (uint256) {
        return reserves[asset].balance;
    }

    // will do weight update (dry run) before reading token weights, to prevent the case
    // that weight is outdated
    function getWeight(address asset) external view override returns (uint256) {
        (uint256 xytWeightUpdated, uint256 tokenWeightUpdated, ) = _updateWeightDry();
        if (asset == xyt) {
            return xytWeightUpdated;
        } else if (asset == token) {
            return tokenWeightUpdated;
        } else {
            return 0;
        }
    }

    function spotPrice(address inToken, address outToken)
        external
        view
        override
        returns (uint256 spot)
    {
        TokenReserve storage inTokenReserve = reserves[inToken];
        TokenReserve storage outTokenReserve = reserves[outToken];

        return _calcSpotPrice(inTokenReserve, outTokenReserve, data.swapFee());
    }

    function _calcSpotPrice(
        TokenReserve memory inTokenReserve,
        TokenReserve memory outTokenReserve,
        uint256 swapFee
    ) internal pure returns (uint256 spot) {
        uint256 numer = Math.rdiv(inTokenReserve.balance, inTokenReserve.weight);
        uint256 denom = Math.rdiv(outTokenReserve.balance, outTokenReserve.weight);
        uint256 ratio = Math.rdiv(numer, denom);
        uint256 scale = Math.rdiv(Math.RONE, Math.RONE.sub(swapFee));

        spot = Math.rmul(ratio, scale);
    }

    function _calcOutAmountLp(
        uint256 inAmount,
        TokenReserve memory inTokenReserve,
        uint256 swapFee,
        uint256 totalSupplyLp,
        uint256 totalWeight
    ) internal pure returns (uint256 exactOutLp) {
        uint256 nWeight = Math.rdiv(inTokenReserve.weight, totalWeight);
        uint256 feePortion = Math.rmul(Math.RONE.sub(nWeight), swapFee);
        uint256 inAmoutAfterFee = Math.rmul(inAmount, Math.RONE.sub(feePortion));

        uint256 inBalanceUpdated = inTokenReserve.balance.add(inAmoutAfterFee);
        uint256 inTokenRatio = Math.rdiv(inBalanceUpdated, inTokenReserve.balance);

        uint256 lpTokenRatio = Math.rpow(inTokenRatio, nWeight);
        uint256 totalSupplyLpUpdated = Math.rmul(lpTokenRatio, totalSupplyLp);
        exactOutLp = totalSupplyLpUpdated.sub(totalSupplyLp);
        return exactOutLp;
    }

    function _calcOutAmountToken(
        TokenReserve memory outTokenReserve,
        uint256 totalSupplyLp,
        uint256 totalWeight,
        uint256 inLp
    ) internal view returns (uint256 exactOutToken) {
        uint256 nWeight = Math.rdiv(outTokenReserve.weight, totalWeight);
        uint256 inLpAfterExitFee = Math.rmul(inLp, Math.RONE.sub(data.exitFee()));
        uint256 totalSupplyLpUpdated = totalSupplyLp.sub(inLpAfterExitFee);
        uint256 lpRatio = Math.rdiv(totalSupplyLpUpdated, totalSupplyLp);

        uint256 outTokenRatio = Math.rpow(lpRatio, Math.rdiv(Math.RONE, nWeight));
        uint256 outTokenBalanceUpdated = Math.rmul(outTokenRatio, outTokenReserve.balance);

        uint256 outAmountTOkenBeforeSwapFee = outTokenReserve.balance.sub(outTokenBalanceUpdated);

        uint256 feePortion = Math.rmul(Math.RONE.sub(nWeight), data.swapFee());
        exactOutToken = Math.rmul(outAmountTOkenBeforeSwapFee, Math.RONE.sub(feePortion));
        return exactOutToken;
    }

    /// @notice Sends fees as LP to Treasury
    function _collectFees(uint256 _amount) internal {
        IERC20(address(this)).safeTransfer(data.treasury(), _amount);
    }

    /// @dev Inbound transfer from router to market
    function _transferIn(address _token, uint256 _amount) internal {
        IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);
        if (_token == xyt) {
            // if its an XYT transfer, interests for the market is updated.
            lastInterestUpdate = block.timestamp;
        }
    }

    /// @dev Outbound transfer from market to router
    function _transferOut(address _token, uint256 _amount) internal {
        IERC20(_token).safeTransfer(msg.sender, _amount);
        if (_token == xyt) {
            // if its an XYT transfer, interests for the market is updated.
            lastInterestUpdate = block.timestamp;
        }
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

    // update the token reserve storage
    function _updateWeight() internal {
        uint256 xytWeight = reserves[xyt].weight;
        uint256 tokenWeight = reserves[token].weight;

        (uint256 xytWeightUpdated, uint256 tokenWeightUpdated, uint256 priceNow) =
            _updateWeightDry();

        reserves[xyt].weight = xytWeightUpdated;
        reserves[token].weight = tokenWeightUpdated;
        priceLast = priceNow;
        emit Shift(xytWeight, tokenWeight, xytWeightUpdated, tokenWeightUpdated);
    }

    // do the weight update calucation but don't update the token reserve storage
    function _updateWeightDry()
        internal
        view
        returns (
            uint256 xytWeightUpdated,
            uint256 tokenWeightUpdated,
            uint256 priceNow
        )
    {
        // get current timestamp currentTime
        uint256 currentTime = block.timestamp;
        uint256 endTime = expiry;
        uint256 startTime = xytStartTime;
        uint256 duration = endTime - startTime;

        uint256 xytWeight = reserves[xyt].weight;
        uint256 tokenWeight = reserves[token].weight;

        uint256 timeLeft;
        if (endTime >= currentTime) {
            timeLeft = endTime - currentTime;
        } else {
            timeLeft = 0;
        }

        // get time_to_mature = (endTime - currentTime) / (endTime - startTime)
        uint256 timeToMature = Math.rdiv(timeLeft * Math.RONE, duration * Math.RONE);

        // get price for now = ln(3.14 * t + 1) / ln(4.14)
        priceNow = Math.rdiv(
            Math.ln(Math.rmul(Math.PI, timeToMature).add(Math.RONE), Math.RONE),
            Math.ln(Math.PI_PLUSONE, Math.RONE)
        );

        uint256 r = Math.rdiv(priceNow, priceLast);
        require(Math.RONE >= r, "MATH_ERROR");

        uint256 thetaNumerator = Math.rmul(Math.rmul(xytWeight, tokenWeight), Math.RONE.sub(r));
        uint256 thetaDenominator = Math.rmul(r, xytWeight).add(tokenWeight);

        // calc weight changes theta
        uint256 theta = Math.rdiv(thetaNumerator, thetaDenominator);

        xytWeightUpdated = xytWeight.sub(theta);
        tokenWeightUpdated = tokenWeight.add(theta);
    }

    //curve shift will be called before any calculation using weight
    function _curveShift(IPendleData _data) internal {
        if (block.number > blockNumLast) {
            _updateWeight();
            _data.updateMarketInfo(xyt, token, factory);
            blockNumLast = block.number;
        }
    }

    // sends out any due interests to msg.sender if he's an LP holder
    // this should be called before any functions that change someone's LPs
    function _settleLpInterests(address account) internal returns (uint256 dueInterests) {
        _updateGlobalIncomeIndex();
        if (lastGlobalIncomeIndex[account] == 0) {
            lastGlobalIncomeIndex[account] = globalIncomeIndex;
            return 0;
        }

        dueInterests = balanceOf[account]
            .mul(globalIncomeIndex - lastGlobalIncomeIndex[account])
            .div(GLOBAL_INCOME_INDEX_MULTIPLIER);

        lastGlobalIncomeIndex[account] = globalIncomeIndex;
        if (dueInterests == 0) return 0;
        lastUnderlyingYieldTokenBalance = lastUnderlyingYieldTokenBalance.sub(dueInterests);
        IERC20(IPendleYieldToken(xyt).underlyingYieldToken()).safeTransfer(account, dueInterests);
    }

    // this function should be called whenver the total amount of LP changes
    //
    function _updateGlobalIncomeIndex() internal {
        if (block.timestamp.sub(lastInterestUpdate) > data.interestUpdateDelta()) {
            // get due interests for the XYT being held in the market
            router.redeemDueInterests(forgeId, underlyingAsset, expiry);
            lastInterestUpdate = block.timestamp;
        }

        uint256 currentUnderlyingYieldTokenBalance =
            IERC20(IPendleYieldToken(xyt).underlyingYieldToken()).balanceOf(address(this));
        uint256 interestsEarned =
            currentUnderlyingYieldTokenBalance - lastUnderlyingYieldTokenBalance;
        lastUnderlyingYieldTokenBalance = currentUnderlyingYieldTokenBalance;

        globalIncomeIndex = globalIncomeIndex.add(
            interestsEarned.mul(GLOBAL_INCOME_INDEX_MULTIPLIER).div(totalSupply)
        );
        // console.log("\tglobalIncomeIndex, totalSupply = ", globalIncomeIndex, totalSupply);
    }

    function _beforeTokenTransfer(address from, address to) internal override {
        _settleLpInterests(from);
        _settleLpInterests(to);
    }

    function _initializeLock() internal {
        uint256 duration = expiry - xytStartTime; // market expiry = xyt expiry
        uint256 lockDuration = (duration * data.lockNumerator()) / data.lockDenominator();
        lockStartTime = expiry - lockDuration;
    }
}
