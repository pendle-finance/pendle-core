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
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

contract PendleMarket is IPendleMarket, PendleBaseToken {
    using Math for uint256;
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    address public immutable override factory;
    bytes32 public immutable override factoryId;
    address private immutable forge;
    address public immutable override token;
    address public immutable override xyt;
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
    IERC20 private immutable underlyingYieldToken;
    IPendleData private immutable data;
    IPendleRouter private immutable router;
    uint256 private immutable xytStartTime;

    constructor(
        address _forge,
        address _xyt,
        address _token,
        uint256 _expiry
    ) PendleBaseToken(NAME, SYMBOL, DECIMALS, block.timestamp, _expiry) {
        require(_xyt != address(0), "ZERO_ADDRESS");
        require(_token != address(0), "ZERO_ADDRESS");
        IPendleYieldToken xytContract = IPendleYieldToken(_xyt);

        factory = msg.sender;
        forge = _forge;
        xyt = _xyt;
        token = _token;
        bootstrapped = false;
        globalIncomeIndex = 1;

        forgeId = IPendleForge(_forge).forgeId();
        underlyingAsset = xytContract.underlyingAsset();
        underlyingYieldToken = IERC20(IPendleYieldToken(_xyt).underlyingYieldToken());
        expiry = _expiry;
        address routerAddress = address(IPendleMarketFactory(msg.sender).router());
        router = IPendleRouter(routerAddress);
        data = IPendleForge(_forge).data();
        xytStartTime = IPendleYieldToken(_xyt).start();
        factoryId = IPendleMarketFactory(msg.sender).marketFactoryId();

        _approve(address(this), routerAddress, type(uint256).max);
        IERC20(_xyt).safeApprove(routerAddress, type(uint256).max);
        IERC20(_token).safeApprove(routerAddress, type(uint256).max);
    }

    function checkIsBootstrapped() internal view {
        require(bootstrapped, "NOT_BOOTSTRAPPED");
    }

    function checkOnlyRouter() internal view {
        require(msg.sender == address(router), "ONLY_ROUTER");
    }

    modifier marketIsOpen() {
        require(block.timestamp < lockStartTime, "MARKET_LOCKED");
        _;
    }

    function bootstrap(uint256 initialXytLiquidity, uint256 initialTokenLiquidity)
        external
        override
        returns (PendingTransfer[3] memory transfers)
    {
        checkOnlyRouter();
        require(!bootstrapped, "ALREADY_BOOTSTRAPPED");
        _initializeLock(); // market's lock params should be initialized at bootstrap time

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

        transfers[0].amount = initialXytLiquidity;
        transfers[0].isOut = false;
        transfers[1].amount = initialTokenLiquidity;
        transfers[1].isOut = false;
        transfers[2].amount = INITIAL_LP;
        transfers[2].isOut = true;

        blockNumLast = block.number;
        bootstrapped = true;
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
    ) external override marketIsOpen returns (PendingTransfer[3] memory transfers) {
        checkIsBootstrapped();
        checkOnlyRouter();
        uint256 totalLp = totalSupply;
        uint256 ratio = Math.rdiv(_exactOutLp, totalLp);
        require(ratio != 0, "ZERO_RATIO");

        // Calc and inject XYT token.
        uint256 balanceXyt = reserves[xyt].balance;
        uint256 amountXytUsed = Math.rmul(ratio, balanceXyt);
        require(amountXytUsed != 0, "ZERO_XYT_IN_AMOUNT");
        require(amountXytUsed <= _maxInXyt, "LOW_XYT_IN_LIMIT");
        reserves[xyt].balance = reserves[xyt].balance.add(amountXytUsed);
        transfers[0].amount = amountXytUsed;
        transfers[0].isOut = false;

        // Calc and inject pair token.
        uint256 balanceToken = reserves[token].balance;
        uint256 amountTokenUsed = Math.rmul(ratio, balanceToken);
        require(amountTokenUsed != 0, "ZERO_TOKEN_IN_AMOUNT");
        require(amountTokenUsed <= _maxInToken, "LOW_TOKEN_IN_LIMIT");
        reserves[token].balance = reserves[token].balance.add(amountTokenUsed);
        transfers[1].amount = amountTokenUsed;
        transfers[1].isOut = false;

        emit Sync(
            reserves[xyt].balance,
            reserves[xyt].weight,
            reserves[token].balance,
            reserves[token].weight
        );

        // Mint and push LP token.
        _mintLp(_exactOutLp);
        transfers[2].amount = _exactOutLp;
        transfers[2].isOut = true;
    }

    function addMarketLiquiditySingle(
        address _inToken,
        uint256 _exactIn,
        uint256 _minOutLp
    ) external override marketIsOpen returns (PendingTransfer[3] memory transfers) {
        checkIsBootstrapped();
        checkOnlyRouter();
        _curveShift(data);

        TokenReserve storage inTokenReserve = reserves[_inToken];
        uint256 totalLp = totalSupply;
        uint256 totalWeight = reserves[xyt].weight.add(reserves[token].weight);

        // Calc out amount of LP token.
        uint256 exactOutLp =
            _calcOutAmountLp(_exactIn, inTokenReserve, data.swapFee(), totalLp, totalWeight);
        require(exactOutLp >= _minOutLp, "HIGH_LP_OUT_LIMIT");

        // Update reserves and operate underlying LP and inToken.
        inTokenReserve.balance = inTokenReserve.balance.add(_exactIn);
        transfers[0].amount = _exactIn;
        transfers[0].isOut = false;

        // Mint and push LP token.
        _mintLp(exactOutLp);
        transfers[2].amount = exactOutLp;
        transfers[2].isOut = true;

        emit Sync(
            reserves[xyt].balance,
            reserves[xyt].weight,
            reserves[token].balance,
            reserves[token].weight
        );
    }

    /**
     * @notice Exit the market by putting in the desired amount of LP tokens
     *         and getting back XYT and pair tokens.
     * @dev With remove liquidity functions, LPs are always transfered in
     *  first in the Router, to make sure we have enough LPs in the market to burn
     *  as such, we don't need to set transfers[2]
     * @dev no curveShift to save gas because this function
                doesn't depend on weights of tokens
     * @dev this function will never be locked since we always let users withdraw
                their funds
     */
    function removeMarketLiquidityAll(
        uint256 _inLp,
        uint256 _minOutXyt,
        uint256 _minOutToken
    ) external override returns (PendingTransfer[3] memory transfers) {
        checkIsBootstrapped();
        checkOnlyRouter();
        uint256 exitFee = data.exitFee();
        uint256 totalLp = totalSupply;
        uint256 exitFees = Math.rmul(_inLp, exitFee);
        uint256 inLpAfterExitFee = _inLp.sub(exitFee);
        uint256 ratio = Math.rdiv(inLpAfterExitFee, totalLp);
        require(ratio != 0, "ZERO_RATIO");

        // Calc and withdraw xyt token.
        uint256 balanceToken = reserves[xyt].balance;
        uint256 xytOut = Math.rmul(ratio, balanceToken);
        require(xytOut != 0, "MATH_ERROR");
        require(xytOut >= _minOutXyt, "INSUFFICIENT_XYT_OUT");
        reserves[xyt].balance = reserves[xyt].balance.sub(xytOut);
        transfers[0].amount = xytOut;
        transfers[0].isOut = true;

        // Calc and withdraw pair token.
        balanceToken = reserves[token].balance;
        uint256 tokenOut = Math.rmul(ratio, balanceToken);
        require(tokenOut != 0, "MATH_ERROR");
        require(tokenOut >= _minOutToken, "INSUFFICIENT_TOKEN_OUT");
        reserves[token].balance = reserves[token].balance.sub(tokenOut);
        transfers[1].amount = tokenOut;
        transfers[1].isOut = true;

        // Deal with lp last.
        _collectFees(exitFees);
        _burnLp(inLpAfterExitFee);
    }

    /// @dev With remove liquidity functions, LPs are always transfered in
    /// first in the Router, to make sure we have enough LPs in the market to burn
    /// as such, we don't need to set transfers[2]
    function removeMarketLiquiditySingle(
        address _outToken,
        uint256 _inLp,
        uint256 _minOutAmountToken
    ) external override marketIsOpen returns (PendingTransfer[3] memory transfers) {
        checkIsBootstrapped();
        checkOnlyRouter();
        _curveShift(data);

        TokenReserve storage outTokenReserve = reserves[_outToken];
        uint256 exitFee = data.exitFee();
        uint256 exitFees = Math.rmul(_inLp, data.exitFee());
        uint256 totalLp = totalSupply;
        uint256 totalWeight = reserves[xyt].weight.add(reserves[token].weight);

        uint256 outAmountToken = _calcOutAmountToken(outTokenReserve, totalLp, totalWeight, _inLp);
        require(outAmountToken >= _minOutAmountToken, "INSUFFICIENT_TOKEN_OUT");

        // Update reserves and operate underlying LP and outToken
        outTokenReserve.balance = outTokenReserve.balance.sub(outAmountToken);

        _collectFees(exitFee);
        _burnLp(_inLp.sub(exitFees));
        transfers[0].amount = outAmountToken;
        transfers[0].isOut = true;
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
        marketIsOpen
        returns (
            uint256 outAmount,
            uint256 spotPriceAfter,
            PendingTransfer[3] memory transfers
        )
    {
        checkIsBootstrapped();
        checkOnlyRouter();
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

        transfers[0].amount = inAmount;
        transfers[0].isOut = false;
        transfers[1].amount = outAmount;
        transfers[1].isOut = true;
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
        marketIsOpen
        returns (
            uint256 inAmount,
            uint256 spotPriceAfter,
            PendingTransfer[3] memory transfers
        )
    {
        checkIsBootstrapped();
        checkOnlyRouter();
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

        transfers[0].amount = inAmount;
        transfers[0].isOut = false;
        transfers[1].amount = outAmount;
        transfers[1].isOut = true;
    }

    function claimLpInterests(address account) public override returns (uint256 interests) {
        checkIsBootstrapped();
        checkOnlyRouter();
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
    //
    // How we keep track of LP interests:
    //    - Whenever there is new interests iNew1 into the Market, it is distributed equally
    //      to the Lp holders. Alice who has lpBalance will be entitled to lpBalance/totalLpSupply1*iNew1
    //    - If there is another interest iNew2, or if totalLpSupply changes, Alice will receive an additional
    //      lpBalance/totalSupply2*iNew2.
    //    - Therefore, we can just keep track of globalIncomeIndex = iNew1/totalSupply1 + iNew2/totalSupply2
    //      as well as the lastGlobalIncomeIndex of each user, when they last received interests.
    //    - When Alice wants to redeem her interests, it will be lpBalance * (globalIncomeIndex - lastGlobalIncomeIndex[Alice])
    function _settleLpInterests(address account) internal returns (uint256 dueInterests) {
        if (account == address(this)) return 0;
        _updateGlobalIncomeIndex();
        if (lastGlobalIncomeIndex[account] == 0) {
            lastGlobalIncomeIndex[account] = globalIncomeIndex;
            return 0;
        }

        dueInterests = balanceOf[account]
            .mul(globalIncomeIndex.sub(lastGlobalIncomeIndex[account]))
            .div(GLOBAL_INCOME_INDEX_MULTIPLIER);

        lastGlobalIncomeIndex[account] = globalIncomeIndex;
        if (dueInterests == 0) return 0;
        lastUnderlyingYieldTokenBalance = lastUnderlyingYieldTokenBalance.sub(dueInterests);
        IERC20(IPendleYieldToken(xyt).underlyingYieldToken()).safeTransfer(account, dueInterests);
    }

    // this function should be called whenver the total amount of LP changes
    function _updateGlobalIncomeIndex() internal {
        if (block.timestamp.sub(lastInterestUpdate) > data.interestUpdateDelta()) {
            // get due interests for the XYT being held in the market if it has not been updated
            // for interestUpdateDelta seconds

            router.redeemDueInterests(forgeId, underlyingAsset, expiry);
            lastInterestUpdate = block.timestamp;
        }

        uint256 currentUnderlyingYieldTokenBalance = underlyingYieldToken.balanceOf(address(this));
        uint256 interestsEarned =
            currentUnderlyingYieldTokenBalance - lastUnderlyingYieldTokenBalance;
        lastUnderlyingYieldTokenBalance = currentUnderlyingYieldTokenBalance;
        globalIncomeIndex = globalIncomeIndex.add(
            interestsEarned.mul(GLOBAL_INCOME_INDEX_MULTIPLIER).div(totalSupply)
        );
    }

    // before we send LPs, we need to settle due interests for both the to and from addresses
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
