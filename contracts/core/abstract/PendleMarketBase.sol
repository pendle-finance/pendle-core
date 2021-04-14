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

import "../../interfaces/IPendleData.sol";
import "../../interfaces/IPendleMarket.sol";
import "../../interfaces/IPendleForge.sol";
import "../../interfaces/IPendleMarketFactory.sol";
import "../../interfaces/IPendleYieldToken.sol";
import "../../tokens/PendleBaseToken.sol";
import "../../libraries/MathLib.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "hardhat/console.sol";

abstract contract PendleMarketBase is IPendleMarket, PendleBaseToken {
    using Math for uint256;
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    address private immutable factory;
    bytes32 public immutable override factoryId;
    address internal immutable forge;
    address public immutable override token;
    address public immutable override xyt;
    bool public bootstrapped;
    string private constant NAME = "Pendle Market";
    string private constant SYMBOL = "PENDLE-LPT";
    uint256 private constant MINIMUM_LIQUIDITY = 10**3;
    uint8 private constant DECIMALS = 18;
    uint256 private priceLast = Math.RONE;
    uint256 private blockNumLast;
    uint256 private constant LN_PI_PLUSONE = 1562071538258; // this is equal to Math.ln(Math.PI_PLUSONE,Math.RONE)
    uint256 internal paramL;
    uint256 internal lastNYield;
    mapping(address => uint256) internal lastParamL;

    uint256 private constant MULTIPLIER = 10**20;
    uint256 private reserveData;
    uint256 private lastInterestUpdate;

    uint256 private constant MASK_148_TO_255 = type(uint256).max ^ ((1 << 148) - 1);
    uint256 private constant MASK_40_TO_147 = ((1 << 148) - 1) ^ ((1 << 40) - 1);
    uint256 private constant MASK_0_TO_39 = ((1 << 40) - 1);
    uint256 private constant MAX_TOKEN_RESERVE_BALANCE = (1 << 108) - 1;

    // the lockStartTime is set at the bootstrap time of the market, and will not
    // be changed for the entire market duration
    uint256 public lockStartTime;

    /* these variables are used often, so we get them once in the constructor
    and save gas for retrieving them afterwards */
    bytes32 private immutable forgeId;
    address internal immutable underlyingAsset;
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

    function checkMarketIsOpen() internal view {
        require(block.timestamp < lockStartTime, "MARKET_LOCKED");
    }

    function decodeReserveData(uint256 _reserveData)
        internal
        pure
        returns (
            uint256 xytBalance,
            uint256 tokenBalance,
            uint256 xytWeight,
            uint256 tokenWeight
        )
    {
        xytBalance = (_reserveData & MASK_148_TO_255) >> 148;
        tokenBalance = (_reserveData & MASK_40_TO_147) >> 40;
        xytWeight = _reserveData & MASK_0_TO_39;
        tokenWeight = Math.RONE - xytWeight;
    }

    function parseTokenReserveData(address _asset, uint256 _reserveData)
        internal
        view
        returns (TokenReserve memory tokenReserve)
    {
        (uint256 xytBalance, uint256 tokenBalance, uint256 xytWeight, uint256 tokenWeight) =
            decodeReserveData(_reserveData);
        if (_asset == xyt) {
            tokenReserve = TokenReserve(xytWeight, xytBalance);
        } else {
            tokenReserve = TokenReserve(tokenWeight, tokenBalance);
        }
    }

    function dryUpdateReserveData(
        TokenReserve memory tokenReserve,
        address _asset,
        uint256 oldReserveData
    ) internal view returns (uint256 _updatedReserveData) {
        require(tokenReserve.balance <= MAX_TOKEN_RESERVE_BALANCE, "EXCEED_TOKEN_BALANCE_LIMIT");
        (uint256 xytBalance, uint256 tokenBalance, uint256 xytWeight, uint256 tokenWeight) =
            decodeReserveData(oldReserveData);
        if (_asset == xyt) {
            (xytWeight, xytBalance) = (tokenReserve.weight, tokenReserve.balance);
        } else {
            (tokenWeight, tokenBalance) = (tokenReserve.weight, tokenReserve.balance);
            xytWeight = Math.RONE.sub(tokenWeight);
        }
        _updatedReserveData = encodeReserveData(xytBalance, tokenBalance, xytWeight);
    }

    function encodeReserveData(
        uint256 xytBalance,
        uint256 tokenBalance,
        uint256 xytWeight
    ) internal pure returns (uint256 _updatedReserveData) {
        require(xytBalance <= MAX_TOKEN_RESERVE_BALANCE, "EXCEED_TOKEN_BALANCE_LIMIT");
        require(tokenBalance <= MAX_TOKEN_RESERVE_BALANCE, "EXCEED_TOKEN_BALANCE_LIMIT");
        _updatedReserveData = (xytBalance << 148) | (tokenBalance << 40) | xytWeight;
    }

    function bootstrap(uint256 initialXytLiquidity, uint256 initialTokenLiquidity)
        external
        override
        returns (PendingTransfer[3] memory transfers)
    {
        checkOnlyRouter();
        require(!bootstrapped, "ALREADY_BOOTSTRAPPED");
        _initializeLock(); // market's lock params should be initialized at bootstrap time

        reserveData = encodeReserveData(initialXytLiquidity, initialTokenLiquidity, Math.RONE / 2);

        emit Sync(initialXytLiquidity, Math.RONE / 2, initialTokenLiquidity);

        uint256 liquidity =
            Math.sqrt(initialXytLiquidity.mul(initialTokenLiquidity)).sub(MINIMUM_LIQUIDITY);
        _mintLp(MINIMUM_LIQUIDITY.add(liquidity));

        transfers[0].amount = initialXytLiquidity;
        transfers[0].isOut = false;
        transfers[1].amount = initialTokenLiquidity;
        transfers[1].isOut = false;
        transfers[2].amount = liquidity;
        transfers[2].isOut = true;

        blockNumLast = block.number;
        bootstrapped = true;
        _afterBootstrap();
    }

    /**
   * @notice Join the market by specifying the desired (and max) amount of xyts
   *    and tokens to put in.
   * @param _desiredXytAmount amount of XYTs user wants to contribute
   * @param _desiredTokenAmount amount of tokens user wants to contribute
   * @param _xytMinAmount min amount of XYTs user wants to be able to contribute
   * @param _tokenMinAmount min amount of tokens user wants to be able to contribute
   * @dev no curveShift to save gas because this function
              doesn't depend on weights of tokens
   */
    function addMarketLiquidityDual(
        uint256 _desiredXytAmount,
        uint256 _desiredTokenAmount,
        uint256 _xytMinAmount,
        uint256 _tokenMinAmount
    ) external override returns (PendingTransfer[3] memory transfers, uint256 lpOut) {
        checkIsBootstrapped();
        checkOnlyRouter();
        checkMarketIsOpen();
        _updateParamL();

        (uint256 xytBalance, uint256 tokenBalance, uint256 xytWeight, ) =
            decodeReserveData(reserveData);

        uint256 amountXytUsed;
        uint256 amountTokenUsed = _desiredXytAmount.mul(tokenBalance).div(xytBalance);
        if (amountTokenUsed <= _desiredTokenAmount) {
            // using _desiredXytAmount to determine the LP and add liquidity
            require(amountTokenUsed >= _tokenMinAmount, "INSUFFICIENT_TOKEN_AMOUNT");
            amountXytUsed = _desiredXytAmount;
            lpOut = _desiredXytAmount.mul(totalSupply).div(xytBalance);
        } else {
            // using _desiredTokenAmount to determine the LP and add liquidity
            amountXytUsed = _desiredTokenAmount.mul(xytBalance).div(tokenBalance);
            require(amountXytUsed >= _xytMinAmount, "INSUFFICIENT_XYT_AMOUNT");
            amountTokenUsed = _desiredTokenAmount;
            lpOut = _desiredTokenAmount.mul(totalSupply).div(tokenBalance);
        }

        xytBalance = xytBalance.add(amountXytUsed);
        transfers[0].amount = amountXytUsed;
        transfers[0].isOut = false;

        tokenBalance = tokenBalance.add(amountTokenUsed);
        transfers[1].amount = amountTokenUsed;
        transfers[1].isOut = false;

        reserveData = encodeReserveData(xytBalance, tokenBalance, xytWeight);
        emit Sync(xytBalance, xytWeight, tokenBalance);

        // Mint and push LP token.
        _mintLp(lpOut);
        transfers[2].amount = lpOut;
        transfers[2].isOut = true;
    }

    function addMarketLiquiditySingle(
        address _inToken,
        uint256 _exactIn,
        uint256 _minOutLp
    ) external override returns (PendingTransfer[3] memory transfers) {
        checkIsBootstrapped();
        checkOnlyRouter();
        checkMarketIsOpen();
        uint256 updatedReserveData = _curveShift();
        _updateParamL();
        TokenReserve memory inTokenReserve = parseTokenReserveData(_inToken, updatedReserveData);

        uint256 totalLp = totalSupply;

        // Calc out amount of LP token.
        uint256 exactOutLp = _calcOutAmountLp(_exactIn, inTokenReserve, data.swapFee(), totalLp);
        require(exactOutLp >= _minOutLp, "HIGH_LP_OUT_LIMIT");

        // Update reserves and operate underlying LP and inToken.
        inTokenReserve.balance = inTokenReserve.balance.add(_exactIn);
        transfers[0].amount = _exactIn;
        transfers[0].isOut = false;

        // Mint and push LP token.
        _mintLp(exactOutLp);
        transfers[2].amount = exactOutLp;
        transfers[2].isOut = true;

        // repack data
        updatedReserveData = dryUpdateReserveData(inTokenReserve, _inToken, updatedReserveData);
        reserveData = updatedReserveData;
        (uint256 xytBalance, uint256 tokenBalance, uint256 xytWeight, ) =
            decodeReserveData(updatedReserveData); // unpack data
        emit Sync(xytBalance, xytWeight, tokenBalance);
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
    function removeMarketLiquidityDual(
        uint256 _inLp,
        uint256 _minOutXyt,
        uint256 _minOutToken
    ) external override returns (PendingTransfer[3] memory transfers) {
        checkIsBootstrapped();
        checkOnlyRouter();
        _updateParamL();
        uint256 exitFee = data.exitFee();
        uint256 totalLp = totalSupply;
        uint256 exitFees = Math.rmul(_inLp, exitFee);
        uint256 inLpAfterExitFee = _inLp.sub(exitFee);
        uint256 ratio = Math.rdiv(inLpAfterExitFee, totalLp);
        require(ratio != 0, "ZERO_RATIO");
        (uint256 xytBalance, uint256 tokenBalance, uint256 xytWeight, ) =
            decodeReserveData(reserveData); // unpack data

        // Calc and withdraw xyt token.
        uint256 balanceToken = xytBalance;
        uint256 xytOut = Math.rmul(ratio, balanceToken);
        require(xytOut != 0, "MATH_ERROR");
        require(xytOut >= _minOutXyt, "INSUFFICIENT_XYT_OUT");
        xytBalance = xytBalance.sub(xytOut);
        transfers[0].amount = xytOut;
        transfers[0].isOut = true;

        // Calc and withdraw pair token.
        balanceToken = tokenBalance;
        uint256 tokenOut = Math.rmul(ratio, balanceToken);
        require(tokenOut != 0, "MATH_ERROR");
        require(tokenOut >= _minOutToken, "INSUFFICIENT_TOKEN_OUT");
        tokenBalance = tokenBalance.sub(tokenOut);
        transfers[1].amount = tokenOut;
        transfers[1].isOut = true;

        reserveData = encodeReserveData(xytBalance, tokenBalance, xytWeight); // repack data
        emit Sync(xytBalance, xytWeight, tokenBalance);

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
    ) external override returns (PendingTransfer[3] memory transfers) {
        checkIsBootstrapped();
        checkOnlyRouter();
        checkMarketIsOpen();
        uint256 updatedReserveData = _curveShift();
        _updateParamL();
        TokenReserve memory outTokenReserve = parseTokenReserveData(_outToken, updatedReserveData);

        uint256 swapFee = data.swapFee();
        uint256 exitFee = data.exitFee();
        uint256 exitFees = Math.rmul(_inLp, exitFee);
        uint256 totalLp = totalSupply;

        uint256 outAmountToken =
            _calcOutAmountToken(outTokenReserve, totalLp, _inLp, swapFee, exitFee);
        require(outAmountToken >= _minOutAmountToken, "INSUFFICIENT_TOKEN_OUT");

        // Update reserves and operate underlying LP and outToken
        outTokenReserve.balance = outTokenReserve.balance.sub(outAmountToken);

        updatedReserveData = dryUpdateReserveData(outTokenReserve, _outToken, updatedReserveData);
        reserveData = updatedReserveData;
        _collectFees(exitFee);
        _burnLp(_inLp.sub(exitFees));
        transfers[0].amount = outAmountToken;
        transfers[0].isOut = true;

        (uint256 xytBalance, uint256 tokenBalance, uint256 xytWeight, ) =
            decodeReserveData(updatedReserveData); // unpack data
        emit Sync(xytBalance, xytWeight, tokenBalance);
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
        returns (
            uint256 outAmount,
            uint256 spotPriceAfter,
            PendingTransfer[3] memory transfers
        )
    {
        checkIsBootstrapped();
        checkOnlyRouter();
        checkMarketIsOpen();
        uint256 swapFee = data.swapFee();
        uint256 updatedReserveData = _curveShift();

        TokenReserve memory inTokenReserve = parseTokenReserveData(inToken, updatedReserveData);
        TokenReserve memory outTokenReserve = parseTokenReserveData(outToken, updatedReserveData);

        uint256 spotPriceBefore = _calcSpotPrice(inTokenReserve, outTokenReserve, swapFee);
        require(spotPriceBefore <= maxPrice, "LOW_MAX_PRICE");

        // calc out amount of token to be swapped out
        outAmount = calcExactOut(inTokenReserve, outTokenReserve, inAmount, swapFee);
        require(outAmount >= minOutAmount, "HIGH_OUT_LIMIT");

        inTokenReserve.balance = inTokenReserve.balance.add(inAmount);
        outTokenReserve.balance = outTokenReserve.balance.sub(outAmount);

        spotPriceAfter = _calcSpotPrice(inTokenReserve, outTokenReserve, swapFee);

        require(spotPriceAfter >= spotPriceBefore, "MATH_ERROR");
        require(spotPriceAfter <= maxPrice, "LOW_MAX_PRICE");
        require(spotPriceBefore <= Math.rdiv(inAmount, outAmount), "MATH_ERROR");

        // repack data
        updatedReserveData = dryUpdateReserveData(inTokenReserve, inToken, updatedReserveData);
        updatedReserveData = dryUpdateReserveData(outTokenReserve, outToken, updatedReserveData);
        reserveData = updatedReserveData;
        (uint256 xytBalance, uint256 tokenBalance, uint256 xytWeight, ) =
            decodeReserveData(updatedReserveData); // unpack data
        emit Sync(xytBalance, xytWeight, tokenBalance);

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
        returns (
            uint256 inAmount,
            uint256 spotPriceAfter,
            PendingTransfer[3] memory transfers
        )
    {
        checkIsBootstrapped();
        checkOnlyRouter();
        checkMarketIsOpen();
        uint256 swapFee = data.swapFee();
        uint256 updatedReserveData = _curveShift();

        TokenReserve memory inTokenReserve = parseTokenReserveData(inToken, updatedReserveData);
        TokenReserve memory outTokenReserve = parseTokenReserveData(outToken, updatedReserveData);

        // Calc spot price.
        uint256 spotPriceBefore = _calcSpotPrice(inTokenReserve, outTokenReserve, swapFee);
        require(spotPriceBefore <= maxPrice, "LOW_MAX_PRICE");

        // Calc in amount.
        inAmount = calcExactIn(inTokenReserve, outTokenReserve, outAmount, swapFee);
        require(inAmount <= maxInAmount, "LOW_IN_LIMIT");

        inTokenReserve.balance = inTokenReserve.balance.add(inAmount);
        outTokenReserve.balance = outTokenReserve.balance.sub(outAmount);

        spotPriceAfter = _calcSpotPrice(inTokenReserve, outTokenReserve, swapFee);

        require(spotPriceAfter >= spotPriceBefore, "MATH_ERROR");
        require(spotPriceAfter <= maxPrice, "LOW_MAX_PRICE");
        require(spotPriceBefore <= Math.rdiv(inAmount, outAmount), "MATH_ERROR");

        // repack data
        updatedReserveData = dryUpdateReserveData(inTokenReserve, inToken, updatedReserveData);
        updatedReserveData = dryUpdateReserveData(outTokenReserve, outToken, updatedReserveData);

        reserveData = updatedReserveData;
        (uint256 xytBalance, uint256 tokenBalance, uint256 xytWeight, ) =
            decodeReserveData(updatedReserveData); // unpack data
        emit Sync(xytBalance, xytWeight, tokenBalance);

        transfers[0].amount = inAmount;
        transfers[0].isOut = false;
        transfers[1].amount = outAmount;
        transfers[1].isOut = true;
    }

    function claimLpInterests(address account) external override returns (uint256 interests) {
        checkIsBootstrapped();
        checkOnlyRouter();
        interests = _settleLpInterests(account);
    }

    function getReserves()
        external
        view
        override
        returns (
            uint256 xytBalance,
            uint256 xytWeight,
            uint256 tokenBalance,
            uint256 tokenWeight,
            uint256 lastUpdatedBlock
        )
    {
        // get the weight right now of the market, not the weight of the last update
        (xytWeight, tokenWeight, ) = _updateWeightDry(reserveData, priceLast);
        (xytBalance, tokenBalance, , ) = decodeReserveData(reserveData);
        lastUpdatedBlock = blockNumLast;
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

    function spotPrice(address inToken, address outToken)
        external
        view
        override
        returns (uint256 spot)
    {
        uint256 localReserveData = reserveData;
        TokenReserve memory inTokenReserve = parseTokenReserveData(inToken, localReserveData);
        TokenReserve memory outTokenReserve = parseTokenReserveData(outToken, localReserveData);
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
        uint256 totalSupplyLp
    ) internal pure returns (uint256 exactOutLp) {
        uint256 nWeight = inTokenReserve.weight;
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
        uint256 inLp,
        uint256 swapFee,
        uint256 exitFee
    ) internal pure returns (uint256 exactOutToken) {
        uint256 nWeight = outTokenReserve.weight;
        uint256 inLpAfterExitFee = Math.rmul(inLp, Math.RONE.sub(exitFee));
        uint256 totalSupplyLpUpdated = totalSupplyLp.sub(inLpAfterExitFee);
        uint256 lpRatio = Math.rdiv(totalSupplyLpUpdated, totalSupplyLp);

        uint256 outTokenRatio = Math.rpow(lpRatio, Math.rdiv(Math.RONE, nWeight));
        uint256 outTokenBalanceUpdated = Math.rmul(outTokenRatio, outTokenReserve.balance);

        uint256 outAmountTOkenBeforeSwapFee = outTokenReserve.balance.sub(outTokenBalanceUpdated);

        uint256 feePortion = Math.rmul(Math.RONE.sub(nWeight), swapFee);
        exactOutToken = Math.rmul(outAmountTOkenBeforeSwapFee, Math.RONE.sub(feePortion));
        return exactOutToken;
    }

    /// @notice Sends fees as LP to Treasury
    function _collectFees(uint256 _amount) internal {
        IERC20(address(this)).transfer(data.treasury(), _amount);
    }

    function _burnLp(uint256 amount) internal {
        _burn(address(this), amount);
    }

    function _mintLp(uint256 amount) internal {
        _mint(address(this), amount);
    }

    /**
    * @notice update the priceLast & emit event, but not the real weight
    * @dev this function read the reserveData directly from storage. But the reserveData is guaranteed
    not to be obsolete because:
    * this function will be called at most ONCE in every transaction
    * all functions that call this function will eventually update the reserveData
    => it doesn't matter if the reserveData gets updated immediately or not
     */
    function _updateWeightPartial() internal returns (uint256 updatedReserveData) {
        updatedReserveData = reserveData;
        (uint256 xytBalance, uint256 tokenBalance, uint256 xytWeight, ) =
            decodeReserveData(updatedReserveData); // unpack data
        (uint256 xytWeightUpdated, , uint256 priceNow) =
            _updateWeightDry(updatedReserveData, priceLast);
        updatedReserveData = encodeReserveData(xytBalance, tokenBalance, xytWeightUpdated); // repack data

        priceLast = priceNow;
        // the weight is not updated yet, but all functions that call curveShift will eventually update the weight, so we just emit event first
        emit Shift(xytWeight, xytWeightUpdated);
    }

    // do the weight update calucation but don't update the token reserve memory
    function _updateWeightDry(uint256 _reserveData, uint256 _priceLast)
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

        (, , uint256 xytWeight, uint256 tokenWeight) = decodeReserveData(_reserveData); // unpack data

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
            LN_PI_PLUSONE
        );

        uint256 r = Math.rdiv(priceNow, _priceLast);
        require(Math.RONE >= r, "MATH_ERROR");

        uint256 thetaNumerator = Math.rmul(Math.rmul(xytWeight, tokenWeight), Math.RONE.sub(r));
        uint256 thetaDenominator = Math.rmul(r, xytWeight).add(tokenWeight);

        // calc weight changes theta
        uint256 theta = Math.rdiv(thetaNumerator, thetaDenominator);

        xytWeightUpdated = xytWeight.sub(theta);
        tokenWeightUpdated = tokenWeight.add(theta);
    }

    //curve shift will be called before any calculation using weight
    function _curveShift() internal returns (uint256 updatedReserveData) {
        if (block.number > blockNumLast) {
            updatedReserveData = _updateWeightPartial();
            blockNumLast = block.number;
        } else {
            updatedReserveData = reserveData;
        }
    }

    function _settleLpInterests(address account) internal returns (uint256 dueInterests) {
        if (account == address(this)) return 0;

        _updateParamL();
        uint256 interestValuePerLP = _getInterestValuePerLP(account);
        if (interestValuePerLP == 0) return 0;

        dueInterests = balanceOf[account].mul(interestValuePerLP).div(MULTIPLIER);

        if (dueInterests == 0) {
            return 0;
        }

        lastNYield = lastNYield.sub(dueInterests);
        underlyingYieldToken.safeTransfer(account, dueInterests);
    }

    function checkNeedUpdateParamL() internal returns (bool) {
        if (_getIncomeIndexIncreaseRate() > data.interestUpdateRateDelta()) {
            return true;
        }
        if (block.timestamp.sub(lastInterestUpdate) > data.interestUpdateTimeDelta()) {
            return true;
        }
        return false;
    }

    function _updateParamL() internal {
        if (!checkNeedUpdateParamL()) {
            return;
        }
        router.redeemDueInterests(forgeId, underlyingAsset, expiry);
        uint256 currentNYield = underlyingYieldToken.balanceOf(address(this));
        (uint256 firstTerm, uint256 paramR) = _getFirstTermAndParamR(currentNYield);

        uint256 secondTerm = paramR.mul(MULTIPLIER).div(totalSupply);

        // update new states
        paramL = firstTerm.add(secondTerm);
        lastNYield = currentNYield;
        lastInterestUpdate = block.timestamp;
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

    function _afterBootstrap() internal virtual;

    function _getInterestValuePerLP(address account)
        internal
        virtual
        returns (uint256 interestValuePerLP);

    function _getFirstTermAndParamR(uint256 currentNYield)
        internal
        virtual
        returns (uint256 firstTerm, uint256 paramR);

    function _getIncomeIndexIncreaseRate() internal virtual returns (uint256 increaseRate);
}
