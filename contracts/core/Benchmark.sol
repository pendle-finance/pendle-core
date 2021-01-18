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

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import {Math} from "../libraries/BenchmarkLibrary.sol";
import "../interfaces/IBenchmark.sol";
import "../interfaces/IBenchmarkForge.sol";
import "../interfaces/IBenchmarkMarketFactory.sol";
import "../interfaces/IBenchmarkMarket.sol";
import "../periphery/Permissions.sol";


contract Benchmark is IBenchmark, Permissions {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    IWETH public immutable override weth;
    IBenchmarkData public override data;
    address public override treasury;
    address private constant ETH_ADDRESS = address(0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE);

    constructor(address _governance, IWETH _weth) Permissions(_governance) {
        weth = _weth;
    }

    /**
     * @dev Accepts ETH via fallback from the WETH contract.
     **/
    receive() external payable {}

    function initialize(IBenchmarkData _data, address _treasury) external {
        require(msg.sender == initializer, "Benchmark: forbidden");
        require(address(_data) != address(0), "Benchmark: zero address");
        require(_treasury != address(0), "Benchmark: zero address");

        initializer = address(0);
        data = _data;
        treasury = _treasury;
    }

    function setTreasury(address _treasury) external override initialized onlyGovernance {
        require(_treasury != address(0), "Benchmark: zero address");

        treasury = _treasury;
        emit TreasurySet(_treasury);
    }

    /***********
     *  FORGE  *
     ***********/

    function addForge(bytes32 _forgeId, address _forgeAddress)
        external
        override
        initialized
        onlyGovernance
    {
        require(_forgeId != bytes32(0), "Benchmark: zero bytes");
        require(_forgeAddress != address(0), "Benchmark: zero address");
        require(_forgeId == IBenchmarkForge(_forgeAddress).forgeId(), "Benchmark: wrong id");
        require(data.getForgeAddress(_forgeId) == address(0), "Benchmark: existing id");

        data.addForge(_forgeId, _forgeAddress);
    }

    function newYieldContracts(
        bytes32 _forgeId,
        address _underlyingAsset,
        uint256 _expiry
    ) public override returns (address ot, address xyt) {
        IBenchmarkForge forge = IBenchmarkForge(data.getForgeAddress(_forgeId));
        (ot, xyt) = forge.newYieldContracts(_underlyingAsset, _expiry);
    }

    function redeemDueInterests(
        bytes32 _forgeId,
        address _underlyingAsset,
        uint256 _expiry
    ) public override returns (uint256 interests) {
        IBenchmarkForge forge = IBenchmarkForge(data.getForgeAddress(_forgeId));
        interests = forge.redeemDueInterests(msg.sender, _underlyingAsset, _expiry);
    }

    function redeemAfterExpiry(
        bytes32 _forgeId,
        address _underlyingAsset,
        uint256 _expiry,
        address _to
    ) public override returns (uint256 redeemedAmount) {
        IBenchmarkForge forge = IBenchmarkForge(data.getForgeAddress(_forgeId));
        redeemedAmount = forge.redeemAfterExpiry(msg.sender, _underlyingAsset, _expiry, _to);
    }

    function redeemUnderlying(
        bytes32 _forgeId,
        address _underlyingAsset,
        uint256 _expiry,
        uint256 _amountToRedeem,
        address _to
    ) public override returns (uint256 redeemedAmount) {
        IBenchmarkForge forge = IBenchmarkForge(data.getForgeAddress(_forgeId));
        redeemedAmount = forge.redeemUnderlying(
            msg.sender,
            _underlyingAsset,
            _expiry,
            _amountToRedeem,
            _to
        );
    }

    function renewYield(
        bytes32 _forgeId,
        uint256 _oldExpiry,
        address _underlyingAsset,
        uint256 _newExpiry,
        uint256 _amountToTokenize,
        address _yieldTo
    )
        public
        override
        returns (
            uint256 redeemedAmount,
            address ot,
            address xyt
        )
    {
        redeemedAmount = redeemAfterExpiry(_forgeId, _underlyingAsset, _oldExpiry, msg.sender);
        (ot, xyt) = tokenizeYield(
            _forgeId,
            _underlyingAsset,
            _newExpiry,
            _amountToTokenize,
            _yieldTo
        );
    }

    function tokenizeYield(
        bytes32 _forgeId,
        address _underlyingAsset,
        uint256 _expiry,
        uint256 _amountToTokenize,
        address _to
    ) public override returns (address ot, address xyt) {
        IBenchmarkForge forge = IBenchmarkForge(data.getForgeAddress(_forgeId));
        (ot, xyt) = forge.tokenizeYield(
            msg.sender,
            _underlyingAsset,
            _expiry,
            _amountToTokenize,
            _to
        );
    }

    /***********
     *  MARKET *
     ***********/

    function addMarketFactory(
        bytes32 _forgeId,
        bytes32 _marketFactoryId,
        address _marketFactoryAddress
    ) external override initialized onlyGovernance {
        require(_forgeId != 0, "Benchmark: empty bytes");
        require(_marketFactoryId != bytes32(0), "Benchmark: zero bytes");
        require(_marketFactoryAddress != address(0), "Benchmark: zero address");
        require(
            _marketFactoryId == IBenchmarkMarketFactory(_marketFactoryAddress).marketFactoryId(),
            "Benchmark: wrong id"
        );
        require(
            data.getMarketFactoryAddress(_forgeId, _marketFactoryId) == address(0),
            "Benchmark: existing id"
        );
        data.addMarketFactory(_forgeId, _marketFactoryId, _marketFactoryAddress);
    }

    function addMarketLiquidity(
        bytes32 _forgeId,
        bytes32 _marketFactoryId,
        address xyt,
        address token,
        uint256 lpAmountDesired,
        uint256 xytAmountMax,
        uint256 tokenAmountMax
    ) public payable override {
        if (_isETH(token)) {
            require(msg.value == tokenAmountMax, "Pendle: eth sent mismatch");
            weth.deposit();
            token = address(weth);
        }

        IBenchmarkMarket market =
            IBenchmarkMarket(data.getMarket(_forgeId, _marketFactoryId, xyt, token));
        require(address(market) != address(0), "Benchmark: market not found");

        _approveMarketAllowance(IERC20(xyt), address(market), xytAmountMax);
        _approveMarketAllowance(IERC20(token), address(market), tokenAmountMax);
        _transferIn(xyt, msg.sender, address(market), xytAmountMax);
        _transferIn(token, msg.sender, address(market), tokenAmountMax);

        market.joinPoolByAll(msg.sender, lpAmountDesired, xytAmountMax, tokenAmountMax);
    }

    function addMarketLiquidityETH(
        bytes32 _forgeId,
        bytes32 _marketFactoryId,
        address xyt,
        uint256 ethAmountDesired,
        uint256 lpAmountMin
    ) public payable override {
        require(msg.value == ethAmountDesired, "Pendle: eth sent mismatch");

        address token = address(weth);
        IBenchmarkMarket market =
            IBenchmarkMarket(data.getMarket(_forgeId, _marketFactoryId, xyt, token));
        require(address(market) != address(0), "Benchmark: market not found");

        _approveMarketAllowance(weth, address(market), ethAmountDesired);
        _transferIn(ETH_ADDRESS, msg.sender, address(market), ethAmountDesired);

        market.joinPoolSingleToken(msg.sender, token, ethAmountDesired, lpAmountMin);
    }

    function addMarketLiquidityToken(
        bytes32 _forgeId,
        bytes32 _marketFactoryId,
        address xyt,
        address token,
        uint256 tokenAmountDesired,
        uint256 lpAmountMin
    ) public override {
        if (_isETH(token)) {
            token = address(weth);
        }

        IBenchmarkMarket market =
            IBenchmarkMarket(data.getMarket(_forgeId, _marketFactoryId, xyt, token));
        require(address(market) != address(0), "Benchmark: market not found");

        _approveMarketAllowance(IERC20(token), address(market), tokenAmountDesired);
        _transferIn(token, msg.sender, address(market), tokenAmountDesired);

        market.joinPoolSingleToken(msg.sender, token, tokenAmountDesired, lpAmountMin);
    }

    function addMarketLiquidityXyt(
        bytes32 _forgeId,
        bytes32 _marketFactoryId,
        address xyt,
        address token,
        uint256 xytAmountDesired,
        uint256 lpAmountMin
    ) public override {
        if (_isETH(token)) token = address(weth);

        IBenchmarkMarket market =
            IBenchmarkMarket(data.getMarket(_forgeId, _marketFactoryId, xyt, token));
        require(address(market) != address(0), "Benchmark: market not found");

        _approveMarketAllowance(IERC20(xyt), address(market), xytAmountDesired);
        _transferIn(xyt, msg.sender, address(market), xytAmountDesired);

        market.joinPoolSingleToken(msg.sender, xyt, xytAmountDesired, lpAmountMin);
    }

    function removeMarketLiquidity(
        bytes32 _forgeId,
        bytes32 _marketFactoryId,
        address xyt,
        address token,
        uint256 lpAmountDesired,
        uint256 xytAmountMin,
        uint256 tokenAmountMin
    ) public override {
        if (_isETH(token)) token = address(weth);

        IBenchmarkMarket market =
            IBenchmarkMarket(data.getMarket(_forgeId, _marketFactoryId, xyt, token));
        require(address(market) != address(0), "Benchmark: market not found");
        market.exitPoolByAll(msg.sender, lpAmountDesired, xytAmountMin, tokenAmountMin);
    }

    function removeMarketLiquidityETH(
        bytes32 _forgeId,
        bytes32 _marketFactoryId,
        address xyt,
        uint256 lpAmountDesired,
        uint256 ethAmountMin
    ) public override {
        address token = address(weth);
        IBenchmarkMarket market =
            IBenchmarkMarket(data.getMarket(_forgeId, _marketFactoryId, xyt, token));
        require(address(market) != address(0), "Benchmark: market not found");
        market.exitPoolSingleToken(msg.sender, token, lpAmountDesired, ethAmountMin);
    }

    function removeMarketLiquidityToken(
        bytes32 _forgeId,
        bytes32 _marketFactoryId,
        address xyt,
        address token,
        uint256 lpAmountDesired,
        uint256 tokenAmountMin
    ) public override {
        IBenchmarkMarket market =
            IBenchmarkMarket(data.getMarket(_forgeId, _marketFactoryId, xyt, token));
        require(address(market) != address(0), "Benchmark: market not found");
        market.exitPoolSingleToken(msg.sender, token, lpAmountDesired, tokenAmountMin);
    }

    function removeMarketLiquidityXyt(
        bytes32 _forgeId,
        bytes32 _marketFactoryId,
        address xyt,
        address token,
        uint256 lpAmountDesired,
        uint256 xytAmountMin
    ) public override {
        IBenchmarkMarket market =
            IBenchmarkMarket(data.getMarket(_forgeId, _marketFactoryId, xyt, token));
        require(address(market) != address(0), "Benchmark: market not found");
        market.exitPoolSingleToken(msg.sender, xyt, lpAmountDesired, xytAmountMin);
    }

    function batchExactSwapIn(
        Swap[] memory swaps,
        IERC20 tokenIn,
        IERC20 tokenOut,
        uint256 totalAmountIn,
        uint256 minTotalAmountOut
    ) public payable override returns (uint256 totalAmountOut) {
        // _transferIn(tokenIn, msg.sender, totalAmountIn); // TODO: last here

        for (uint256 i = 0; i < swaps.length; i++) {
            Swap memory swap = swaps[i];
            IERC20 swapTokenIn = IERC20(swap.tokenIn);
            IBenchmarkMarket market = IBenchmarkMarket(swap.market);

            if (swapTokenIn.allowance(address(this), swap.market) > 0) {
                swapTokenIn.approve(swap.market, 0);
            }
            swapTokenIn.approve(swap.market, swap.swapAmount);

            (uint256 tokenAmountOut, ) =
                market.swapAmountIn(
                    msg.sender,
                    swap.tokenIn,
                    swap.swapAmount,
                    swap.tokenOut,
                    swap.limitReturnAmount,
                    swap.maxPrice
                );
            totalAmountOut = tokenAmountOut.add(totalAmountOut);
        }

        require(totalAmountOut >= minTotalAmountOut, "Benchmark: limit out error");

        // _transferOut(tokenOut, totalAmountOut);
        // _transferOut(tokenIn, _getBalance(tokenIn));
    }

    function batchSwapExactOut(
        Swap[] memory swaps,
        IERC20 tokenIn,
        IERC20 tokenOut,
        uint256 maxTotalAmountIn
    ) public payable override returns (uint256 totalAmountIn) {
        // _transferIn(tokenIn, maxTotalAmountIn);

        for (uint256 i = 0; i < swaps.length; i++) {
            Swap memory swap = swaps[i];
            IERC20 swapTokenIn = IERC20(swap.tokenIn);

            IBenchmarkMarket market = IBenchmarkMarket(swap.market);
            _approveMarketAllowance(swapTokenIn, swap.market, swap.limitReturnAmount);

            (uint256 tokenAmountIn, ) =
                market.swapAmountOut(
                    msg.sender,
                    swap.tokenIn,
                    swap.limitReturnAmount,
                    swap.tokenOut,
                    swap.swapAmount,
                    swap.maxPrice
                );
            totalAmountIn = tokenAmountIn.add(totalAmountIn);
        }
        require(totalAmountIn <= maxTotalAmountIn, "Benchmark: limit in error");

        // _transferOut(tokenOut, _getBalance(tokenOut));
        // _transferOut(tokenIn, _getBalance(tokenIn));
    }

    function multStepBatchExactSwapIn(
        Swap[][] memory swapSequences,
        IERC20 tokenIn,
        IERC20 tokenOut,
        uint256 totalAmountIn,
        uint256 minTotalAmountOut
    ) public payable override returns (uint256 totalAmountOut) {
        // _transferIn(tokenIn, totalAmountIn);

        for (uint256 i = 0; i < swapSequences.length; i++) {
            uint256 tokenAmountOut;
            for (uint256 k = 0; k < swapSequences[i].length; k++) {
                Swap memory swap = swapSequences[i][k];
                IERC20 swapTokenIn = IERC20(swap.tokenIn);
                if (k == 1) {
                    swap.swapAmount = tokenAmountOut;
                }

                IBenchmarkMarket market = IBenchmarkMarket(swap.market);
                _approveMarketAllowance(swapTokenIn, swap.market, swap.swapAmount);

                (tokenAmountOut, ) = market.swapAmountIn(
                    msg.sender,
                    swap.tokenIn,
                    swap.swapAmount,
                    swap.tokenOut,
                    swap.limitReturnAmount,
                    swap.maxPrice
                );
            }
            // This takes the amountOut of the last swap
            totalAmountOut = tokenAmountOut.add(totalAmountOut);
        }

        require(totalAmountOut >= minTotalAmountOut, "Benchmark: limit out error");

        // _transferOut(tokenOut, totalAmountOut);
        // _transferOut(tokenIn, _getBalance(tokenIn));
    }

    function multStepBatchExactSwapOut(
        Swap[][] memory swapSequences,
        IERC20 tokenIn,
        IERC20 tokenOut,
        uint256 maxTotalAmountIn
    ) public payable override returns (uint256 totalAmountIn) {
        // _transferIn(tokenIn, maxTotalAmountIn);

        IBenchmarkMarket.TokenReserve memory inTokenReserve;
        IBenchmarkMarket.TokenReserve memory outTokenReserve;

        for (uint256 i = 0; i < swapSequences.length; i++) {
            uint256 tokenAmountInFirstSwap;
            if (swapSequences[i].length == 1) {
                Swap memory swap = swapSequences[i][0];
                IERC20 swapTokenIn = IERC20(swap.tokenIn);

                IBenchmarkMarket market = IBenchmarkMarket(swap.market);
                _approveMarketAllowance(swapTokenIn, swap.market, swap.limitReturnAmount);
                _transferIn(address(swapTokenIn), msg.sender, swap.market, swap.limitReturnAmount);

                (tokenAmountInFirstSwap, ) = market.swapAmountOut(
                    msg.sender,
                    swap.tokenIn,
                    swap.limitReturnAmount,
                    swap.tokenOut,
                    swap.swapAmount,
                    swap.maxPrice
                );
            } else {
                uint256 intermediateTokenAmount;
                Swap memory secondSwap = swapSequences[i][1];
                IBenchmarkMarket marketSecondSwap = IBenchmarkMarket(secondSwap.market);

                inTokenReserve.balance = marketSecondSwap.getBalance(secondSwap.tokenIn);
                inTokenReserve.weight = marketSecondSwap.getWeight(secondSwap.tokenIn);
                outTokenReserve.balance = marketSecondSwap.getBalance(secondSwap.tokenOut);
                outTokenReserve.weight = marketSecondSwap.getWeight(secondSwap.tokenOut);

                intermediateTokenAmount = marketSecondSwap.calcOutAmount(
                    inTokenReserve,
                    outTokenReserve,
                    secondSwap.swapAmount,
                    data.swapFee()
                );

                Swap memory firstSwap = swapSequences[i][0];
                IERC20 firstSwapTokenIn = IERC20(firstSwap.tokenIn);
                IBenchmarkMarket marketFirstSwap = IBenchmarkMarket(firstSwap.market);
                if (
                    firstSwapTokenIn.allowance(address(this), firstSwap.market) <
                    Math.UINT_MAX_VALUE
                ) {
                    firstSwapTokenIn.approve(firstSwap.market, Math.UINT_MAX_VALUE);
                }

                (tokenAmountInFirstSwap, ) = marketFirstSwap.swapAmountOut(
                    msg.sender,
                    firstSwap.tokenIn,
                    firstSwap.limitReturnAmount,
                    firstSwap.tokenOut,
                    intermediateTokenAmount, // This is the amount of token B we need
                    firstSwap.maxPrice
                );

                IERC20 secondSwapTokenIn = IERC20(secondSwap.tokenIn);
                if (
                    secondSwapTokenIn.allowance(address(this), secondSwap.market) <
                    Math.UINT_MAX_VALUE
                ) {
                    secondSwapTokenIn.approve(secondSwap.market, Math.UINT_MAX_VALUE);
                }

                marketSecondSwap.swapAmountOut(
                    msg.sender,
                    secondSwap.tokenIn,
                    secondSwap.limitReturnAmount,
                    secondSwap.tokenOut,
                    secondSwap.swapAmount,
                    secondSwap.maxPrice
                );
            }
            totalAmountIn = tokenAmountInFirstSwap.add(totalAmountIn);
        }

        require(totalAmountIn <= maxTotalAmountIn, "Benchmark: limit in error");

        // _transferOut(tokenOut, _getBalance(tokenOut));
        // _transferOut(tokenIn, _getBalance(tokenIn));
    }

    function swapExactIn(
        address tokenIn,
        address tokenOut,
        uint256 totalAmountIn,
        uint256 minTotalAmountOut,
        uint256 numMarkets
    ) public payable override returns (uint256 amount) {
        Swap[] memory swaps;
        if (_isETH(tokenIn)) {
            (swaps, ) = getMarketRateExactIn(address(weth), tokenOut, totalAmountIn, numMarkets);
        } else if (_isETH(tokenOut)) {
            (swaps, ) = getMarketRateExactIn(tokenIn, address(weth), totalAmountIn, numMarkets);
        } else {
            (swaps, ) = getMarketRateExactIn(tokenIn, tokenOut, totalAmountIn, numMarkets);
        }

        amount = batchExactSwapIn(
            swaps,
            IERC20(tokenIn),
            IERC20(tokenOut),
            totalAmountIn,
            minTotalAmountOut
        );
    }

    function swapExactOut(
        address tokenIn,
        address tokenOut,
        uint256 totalAmountOut,
        uint256 maxTotalAmountIn,
        uint256 numMarkets
    ) public payable override returns (uint256 amount) {
        Swap[] memory swaps;
        if (_isETH(tokenIn)) {
            (swaps, ) = getMarketRateExactOut(address(weth), tokenOut, totalAmountOut, numMarkets);
        } else if (_isETH(tokenOut)) {
            (swaps, ) = getMarketRateExactOut(tokenIn, address(weth), totalAmountOut, numMarkets);
        } else {
            (swaps, ) = getMarketRateExactOut(tokenIn, tokenOut, totalAmountOut, numMarkets);
        }

        amount = batchSwapExactOut(swaps, IERC20(tokenIn), IERC20(tokenOut), maxTotalAmountIn);
    }

    function getAllMarkets() public view override returns (address[] memory) {
        return (data.getAllMarkets());
    }

    // @@Vu TODO: This is not returning the list of markets for the underlying token. We will need to add some structs to BenchmarkData to query this
    function getMarketByUnderlyingToken(
        bytes32 _forgeId,
        bytes32 _marketFactoryId,
        address _underlyingAsset,
        uint256 _expiry
    ) public view override returns (address market) {
        (IBenchmarkYieldToken xyt, IBenchmarkYieldToken token) =
            data.getBenchmarkYieldTokens(_forgeId, _underlyingAsset, _expiry);
        market = data.getMarket(_forgeId, _marketFactoryId, address(xyt), address(token));
    }

    function getMarketRateExactIn(
        address tokenIn,
        address tokenOut,
        uint256 swapAmount,
        uint256 nMarkets
    ) public view override returns (Swap[] memory swaps, uint256 totalOutput) {
        address[] memory marketAddresses =
            data.getBestMarketsWithLimit(tokenIn, tokenOut, nMarkets);

        Market[] memory markets = new Market[](marketAddresses.length);
        uint256 sumEffectiveLiquidity;
        for (uint256 i = 0; i < marketAddresses.length; i++) {
            markets[i] = _getMarketData(tokenIn, tokenOut, marketAddresses[i]);
            sumEffectiveLiquidity = sumEffectiveLiquidity.add(markets[i].effectiveLiquidity);
        }

        uint256[] memory bestInputAmounts = new uint256[](markets.length);
        uint256 totalInputAmount;
        for (uint256 i = 0; i < markets.length; i++) {
            bestInputAmounts[i] = swapAmount.mul(markets[i].effectiveLiquidity).div(
                sumEffectiveLiquidity
            );
            totalInputAmount = totalInputAmount.add(bestInputAmounts[i]);
        }

        if (totalInputAmount < swapAmount) {
            bestInputAmounts[0] = bestInputAmounts[0].add(swapAmount.sub(totalInputAmount));
        } else {
            bestInputAmounts[0] = bestInputAmounts[0].sub(totalInputAmount.sub(swapAmount));
        }

        swaps = new Swap[](markets.length);

        for (uint256 i = 0; i < markets.length; i++) {
            swaps[i] = Swap({
                market: markets[i].market,
                tokenIn: tokenIn,
                tokenOut: tokenOut,
                swapAmount: bestInputAmounts[i],
                limitReturnAmount: 0,
                maxPrice: Math.UINT_MAX_VALUE
            });
        }

        totalOutput = _calcTotalOutExactIn(bestInputAmounts, markets);

        return (swaps, totalOutput);
    }

    function getMarketRateExactOut(
        address tokenIn,
        address tokenOut,
        uint256 swapAmount,
        uint256 nMarkets
    ) public view override returns (Swap[] memory swaps, uint256 totalOutput) {
        address[] memory marketAddresses =
            data.getBestMarketsWithLimit(tokenIn, tokenOut, nMarkets);

        Market[] memory markets = new Market[](marketAddresses.length);
        uint256 sumEffectiveLiquidity;
        for (uint256 i = 0; i < marketAddresses.length; i++) {
            markets[i] = _getMarketData(tokenIn, tokenOut, marketAddresses[i]);
            sumEffectiveLiquidity = sumEffectiveLiquidity.add(markets[i].effectiveLiquidity);
        }

        uint256[] memory bestInputAmounts = new uint256[](markets.length);
        uint256 totalInputAmount;
        for (uint256 i = 0; i < markets.length; i++) {
            bestInputAmounts[i] = swapAmount.mul(markets[i].effectiveLiquidity).div(
                sumEffectiveLiquidity
            );
            totalInputAmount = totalInputAmount.add(bestInputAmounts[i]);
        }

        if (totalInputAmount < swapAmount) {
            bestInputAmounts[0] = bestInputAmounts[0].add(swapAmount.sub(totalInputAmount));
        } else {
            bestInputAmounts[0] = bestInputAmounts[0].sub(totalInputAmount.sub(swapAmount));
        }

        swaps = new Swap[](markets.length);

        for (uint256 i = 0; i < markets.length; i++) {
            swaps[i] = Swap({
                market: markets[i].market,
                tokenIn: tokenIn,
                tokenOut: tokenOut,
                swapAmount: bestInputAmounts[i],
                limitReturnAmount: Math.UINT_MAX_VALUE,
                maxPrice: Math.UINT_MAX_VALUE
            });
        }

        totalOutput = _calcTotalOutExactOut(bestInputAmounts, markets);

        return (swaps, totalOutput);
    }

    function getMarketReserves(
        bytes32 _forgeId,
        bytes32 _marketFactoryId,
        address xyt,
        address token
    )
        public
        view
        override
        returns (
            uint256 xytAmount,
            uint256 tokenAmount,
            uint256 currentTime
        )
    {
        IBenchmarkMarket market =
            IBenchmarkMarket(data.getMarket(_forgeId, _marketFactoryId, xyt, token));
        require(address(market) != address(0), "Benchmark: market not found");
        (xytAmount, tokenAmount, currentTime) = market.getReserves();
    }

    function getMarketTokenAddresses(address market)
        public
        view
        override
        returns (address token, address xyt)
    {
        require(address(market) != address(0), "Benchmark: market not found");
        IBenchmarkMarket benmarkMarket = IBenchmarkMarket(market);
        token = benmarkMarket.token();
        xyt = benmarkMarket.xyt();
    }

    function _approveMarketAllowance(
        IERC20 token,
        address market,
        uint256 amount
    ) internal {
        if (token.allowance(address(this), market) < amount) {
            token.approve(market, 0);
            token.approve(market, Math.UINT_MAX_VALUE);
        }
    }

    function _getMarketData(
        address tokenIn,
        address tokenOut,
        address marketAddress
    ) internal view returns (Market memory) {
        IBenchmarkMarket market = IBenchmarkMarket(marketAddress);
        uint256 tokenBalanceIn = market.getBalance(tokenIn);
        uint256 tokenBalanceOut = market.getBalance(tokenOut);
        uint256 tokenWeightIn = market.getWeight(tokenIn);
        uint256 tokenWeightOut = market.getWeight(tokenOut);

        uint256 effectiveLiquidity =
            _calcEffectiveLiquidity(tokenWeightIn, tokenBalanceOut, tokenWeightOut);
        Market memory returnMarket =
            Market({
                market: marketAddress,
                tokenBalanceIn: tokenBalanceIn,
                tokenWeightIn: tokenWeightIn,
                tokenBalanceOut: tokenBalanceOut,
                tokenWeightOut: tokenWeightOut,
                swapFee: data.swapFee(),
                effectiveLiquidity: effectiveLiquidity
            });

        return returnMarket;
    }

    function _calcEffectiveLiquidity(
        uint256 tokenWeightIn,
        uint256 tokenBalanceOut,
        uint256 tokenWeightOut
    ) internal pure returns (uint256 effectiveLiquidity) {
        effectiveLiquidity = tokenWeightIn
            .mul(Math.WAD)
            .div(tokenWeightOut.add(tokenWeightIn))
            .mul(tokenBalanceOut)
            .div(Math.WAD);

        return effectiveLiquidity;
    }

    function _calcTotalOutExactIn(uint256[] memory bestInAmounts, Market[] memory bestMarkets)
        internal
        view
        returns (uint256 totalOutput)
    {
        totalOutput = 0;
        IBenchmarkMarket.TokenReserve memory inTokenReserve;
        IBenchmarkMarket.TokenReserve memory outTokenReserve;

        for (uint256 i = 0; i < bestInAmounts.length; i++) {
            inTokenReserve.balance = bestMarkets[i].tokenBalanceIn;
            inTokenReserve.weight = bestMarkets[i].tokenWeightIn;
            outTokenReserve.balance = bestMarkets[i].tokenBalanceOut;
            outTokenReserve.weight = bestMarkets[i].tokenWeightOut;

            uint256 output =
                IBenchmarkMarket(bestMarkets[i].market).calcOutAmount(
                    inTokenReserve,
                    outTokenReserve,
                    bestInAmounts[i],
                    data.swapFee()
                );

            totalOutput = totalOutput.add(output);
        }
        return totalOutput;
    }

    function _calcTotalOutExactOut(uint256[] memory bestInputAmounts, Market[] memory bestMarkets)
        internal
        view
        returns (uint256 totalOutput)
    {
        totalOutput = 0;
        IBenchmarkMarket.TokenReserve memory inTokenReserve;
        IBenchmarkMarket.TokenReserve memory outTokenReserve;

        for (uint256 i = 0; i < bestInputAmounts.length; i++) {
            inTokenReserve.balance = bestMarkets[i].tokenBalanceIn;
            inTokenReserve.weight = bestMarkets[i].tokenWeightIn;
            outTokenReserve.balance = bestMarkets[i].tokenBalanceOut;
            outTokenReserve.weight = bestMarkets[i].tokenWeightOut;

            uint256 output =
                IBenchmarkMarket(bestMarkets[i].market).calcInAmount(
                    inTokenReserve,
                    outTokenReserve,
                    bestInputAmounts[i],
                    data.swapFee()
                );

            totalOutput = totalOutput.add(output);
        }
        return totalOutput;
    }

    function _getBalance(IERC20 token) internal view returns (uint256) {
        if (_isETH(address(token))) {
            return weth.balanceOf(address(this));
        } else {
            return token.balanceOf(address(this));
        }
    }

    function _isETH(address token) internal pure returns (bool) {
        return (token == ETH_ADDRESS);
    }

    function _transferIn(
        address token,
        address source,
        address destination,
        uint256 amount
    ) internal {
        if (amount == 0) return;

        if (_isETH(token)) {
            weth.deposit{value: msg.value}();
            weth.transfer(destination, amount);
        } else {
            IERC20(token).safeTransferFrom(source, destination, amount);
        }
    }
}
