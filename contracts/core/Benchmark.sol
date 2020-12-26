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

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../interfaces/IBenchmark.sol";
import "../interfaces/IBenchmarkForge.sol";
import "../interfaces/IBenchmarkMarketFactory.sol";
import "../interfaces/IBenchmarkMarket.sol";
import "../periphery/Permissions.sol";

interface IToken {
    function balanceOf(address) external view returns (uint256);

    function allowance(address, address) external view returns (uint256);

    function approve(address, uint256) external returns (bool);

    function transfer(address, uint256) external returns (bool);

    function transferFrom(
        address,
        address,
        uint256
    ) external returns (bool);

    function deposit() external payable;

    function withdraw(uint256) external;
}


contract Benchmark is IBenchmark, Permissions {
    using SafeMath for uint256;

    struct Market {
        address market;
        uint256 tokenBalanceIn;
        uint256 tokenWeightIn;
        uint256 tokenBalanceOut;
        uint256 tokenWeightOut;
        uint256 tradeFee;
        uint256 effectiveLiquidity;
    }

    struct Trade {
        address market;
        address tokenIn;
        address tokenOut;
        uint256 tradeAmount;
        uint256 limitReturnAmount;
        uint256 maxPrice;
    }

    IBenchmarkData public override data;

    address public immutable override weth;
    address public override treasury;
    address private constant ETH_ADDRESS = address(0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE);
    uint256 private constant WAD = 10**18;

    constructor(address _governance, address _weth) Permissions(_governance) {
        weth = _weth;
    }

    /**
     * @dev Accepts ETH via fallback from the WETH contract.
     **/
    receive() external payable {
        assert(msg.sender == weth);
    }

    function initialize(IBenchmarkData _data, address _treasury) external {
        require(msg.sender == initializer, "Benchmark: forbidden");
        require(address(_data) != address(0), "Benchmark: zero address");
        require(_treasury != address(0), "Benchmark: zero address");

        initializer = address(0);
        data = _data;
        treasury = _treasury;
    }

    function addForge(bytes32 _forgeId, address _forgeAddress)
        external
        override
        initialized
        onlyGovernance
    {
        require(_forgeId != 0, "Benchmark: empty bytes");
        require(_forgeAddress != address(0), "Benchmark: zero address");
        require(_forgeId == IBenchmarkForge(_forgeAddress).forgeId(), "Benchmark: wrong id");
        require(data.getForgeAddress(_forgeId) == address(0), "Benchmark: existing id");
        data.addForge(_forgeId, _forgeAddress);
    }

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

    // @@Vu TODO: do we ever want to remove a forge? It will render all existing XYTs and OTs and Markets for that forge invalid
    function removeForge(bytes32 _forgeId) external override initialized onlyGovernance {
        require(data.getForgeAddress(_forgeId) != address(0), "Benchmark: forge doesn't exist");
        data.removeForge(_forgeId);
    }

    // @@Vu Notice: setting a different BenchmarkData is basically rendering the whole existing system invalid. Will we ever want that?
    function setContracts(IBenchmarkData _data, address _treasury)
        external
        override
        initialized
        onlyGovernance
    {
        require(address(_data) != address(0), "Benchmark: zero address");
        require(_treasury != address(0), "Benchmark: zero address");

        data = _data;
        treasury = _treasury;
        emit ContractsSet(address(_data), _treasury);
    }

    /***********
     *  FORGE  *
     ***********/

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

    // function renew(
    //     Utils.Protocols _protocol,
    //     address underlyingToken,
    //     uint256 oldExpiry,
    //     uint256 newExpiry,
    //     address to
    // ) public override returns (uint256 redeemedAmount) {}

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

    /***********
     *  MARKET *
     ***********/

    function addMarketLiquidity(
        bytes32 _forgeId,
        bytes32 _marketFactoryId,
        address xyt,
        address token,
        uint256 lpAmountDesired,
        uint256 xytAmountMax,
        uint256 tokenAmountMax
    ) public override {
        IBenchmarkMarket market =
            IBenchmarkMarket(data.getMarket(_forgeId, _marketFactoryId, xyt, token));
        require(address(market) != address(0), "Benchmark: market not found");
        market.joinPoolByAll(msg.sender, lpAmountDesired, xytAmountMax, tokenAmountMax);
    }

    function addMarketLiquidityXyt(
        bytes32 _forgeId,
        bytes32 _marketFactoryId,
        address xyt,
        address token,
        uint256 xytAmountDesired,
        uint256 lpAmountMin
    ) public override {
        IBenchmarkMarket market =
            IBenchmarkMarket(data.getMarket(_forgeId, _marketFactoryId, xyt, token));
        require(address(market) != address(0), "Benchmark: market not found");
        market.joinPoolSingleToken(msg.sender, xyt, xytAmountDesired, lpAmountMin);
    }

    function addMarketLiquidityToken(
        bytes32 _forgeId,
        bytes32 _marketFactoryId,
        address xyt,
        address token,
        uint256 tokenAmountDesired,
        uint256 lpAmountMin
    ) public override {
        IBenchmarkMarket market =
            IBenchmarkMarket(data.getMarket(_forgeId, _marketFactoryId, xyt, token));
        require(address(market) != address(0), "Benchmark: market not found");
        market.joinPoolSingleToken(msg.sender, token, tokenAmountDesired, lpAmountMin);
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
        IBenchmarkMarket market =
            IBenchmarkMarket(data.getMarket(_forgeId, _marketFactoryId, xyt, token));
        require(address(market) != address(0), "Benchmark: market not found");
        market.exitPoolByAll(msg.sender, lpAmountDesired, xytAmountMin, tokenAmountMin);
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

    // function swapXytFromToken(
    //     bytes32 _forgeId,
    //     bytes32 _marketFactoryId,
    //     address xyt,
    //     address token,
    //     uint256 xytAmountDesired,
    //     uint256 tokenAmountMax,
    //     uint256 maxPrice
    // ) public override returns (uint256 amount, uint256 priceAfter) {
    //     IBenchmarkMarket market =
    //         IBenchmarkMarket(data.getMarket(_forgeId, _marketFactoryId, xyt, token));
    //     require(address(market) != address(0), "Benchmark: market not found");
    //     (amount, priceAfter) = market.swapAmountOut(
    //         msg.sender,
    //         token,
    //         tokenAmountMax,
    //         xyt,
    //         xytAmountDesired,
    //         maxPrice
    //     );
    // }

    // function swapTokenFromXyt(
    //     bytes32 _forgeId,
    //     bytes32 _marketFactoryId,
    //     address xyt,
    //     address token,
    //     uint256 tokenAmountDesired,
    //     uint256 xytAmountMax,
    //     uint256 maxPrice
    // ) public override returns (uint256 amount, uint256 priceAfter) {
    //     IBenchmarkMarket market =
    //         IBenchmarkMarket(data.getMarket(_forgeId, _marketFactoryId, xyt, token));
    //     require(address(market) != address(0), "Benchmark: market not found");
    //     (amount, priceAfter) = market.swapAmountOut(
    //         msg.sender,
    //         xyt,
    //         xytAmountMax,
    //         token,
    //         tokenAmountDesired,
    //         maxPrice
    //     );
    // }

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

    function getMarketRateXyt(
        bytes32 _forgeId,
        bytes32 _marketFactoryId,
        address xyt,
        address token
    ) public view override returns (uint256 price) {
        IBenchmarkMarket market =
            IBenchmarkMarket(data.getMarket(_forgeId, _marketFactoryId, xyt, token));
        if (address(market) == address(0)) return 0;
        price = market.spotPrice(xyt, token);
    }

    function getMarketRateToken(
        bytes32 _forgeId,
        bytes32 _marketFactoryId,
        address xyt,
        address token
    ) public view override returns (uint256 price) {
        IBenchmarkMarket market =
            IBenchmarkMarket(data.getMarket(_forgeId, _marketFactoryId, xyt, token));
        if (address(market) == address(0)) return 0;
        price = market.spotPrice(token, xyt);
    }

    function createMarket(
        bytes32 _forgeId,
        bytes32 _marketFactoryId,
        address xyt,
        address token,
        uint256 expiry
    ) public override returns (address market) {
        IBenchmarkMarketFactory factory =
            IBenchmarkMarketFactory(data.getMarketFactoryAddress(_forgeId, _marketFactoryId));
        market = factory.createMarket(_forgeId, xyt, token, expiry); //@@XM should use forge directly? otherwise need to add in msg.sender here
    }

    function bootStrapMarket(
        bytes32 _forgeId,
        bytes32 _marketFactoryId,
        address xyt,
        address token,
        uint256 initialXytLiquidity,
        uint256 initialTokenLiquidity
    ) public override {
        IBenchmarkMarket market =
            IBenchmarkMarket(data.getMarket(_forgeId, _marketFactoryId, xyt, token));
        require(address(market) != address(0), "Benchmark: market not found");
        market.bootstrap(msg.sender, initialXytLiquidity, initialTokenLiquidity);
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

    function getMarketTokenAddresses(address market)
        public
        view
        override
        returns (address token, address xyt)
    {
        require(address(market) != address(0), "Benchmark: market not exist");
        IBenchmarkMarket benmarkMarket = IBenchmarkMarket(market);
        token = benmarkMarket.token();
        xyt = benmarkMarket.xyt();
        uint256 initialXytLiquidity,
        uint256 initialTokenLiquidity
    ) public override {
        IBenchmarkMarket market = IBenchmarkMarket(data.getMarket(_forgeId, xyt, token));
        require(address(market) != address(0), "Benchmark: market not found");
        market.bootstrap(initialXytLiquidity, initialTokenLiquidity);
    }

    function batchExactTradeIn(
        Trade[] memory trades,
        IToken tokenIn,
        IToken tokenOut,
        uint256 totalAmountIn,
        uint256 minTotalAmountOut
    ) public payable returns (uint256 totalAmountOut) {
        _transferFromAll(tokenIn, totalAmountIn);

        for (uint256 i = 0; i < trades.length; i++) {
            Trade memory trade = trades[i];
            IToken TradeTokenIn = IToken(trade.tokenIn);
            IBenchmarkMarket market = IBenchmarkMarket(trade.market);

            if (TradeTokenIn.allowance(address(this), trade.market) > 0) {
                TradeTokenIn.approve(trade.market, 0);
            }
            TradeTokenIn.approve(trade.market, trade.tradeAmount);

            (uint256 tokenAmountOut, ) =
                market.tradeExactAmountIn(
                    trade.tokenIn,
                    trade.tradeAmount,
                    trade.tokenOut,
                    trade.limitReturnAmount,
                    trade.maxPrice
                );
            totalAmountOut = tokenAmountOut.add(totalAmountOut);
        }

        require(totalAmountOut >= minTotalAmountOut, "Benchmark: limit out error");

        _transferAll(tokenOut, totalAmountOut);
        _transferAll(tokenIn, _getBalance(tokenIn));
    }

    function batchTradeExactOut(
        Trade[] memory trades,
        IToken tokenIn,
        IToken tokenOut,
        uint256 maxTotalAmountIn
    ) public payable returns (uint256 totalAmountIn) {
        _transferFromAll(tokenIn, maxTotalAmountIn);

        for (uint256 i = 0; i < trades.length; i++) {
            Trade memory trade = trades[i];
            IToken TradeTokenIn = IToken(trade.tokenIn);
            IBenchmarkMarket market = IBenchmarkMarket(trade.market);

            if (TradeTokenIn.allowance(address(this), trade.market) > 0) {
                TradeTokenIn.approve(trade.market, 0);
            }
            TradeTokenIn.approve(trade.market, trade.limitReturnAmount);

            (uint256 tokenAmountIn, ) =
                market.tradeExactAmountOut(
                    trade.tokenIn,
                    trade.limitReturnAmount,
                    trade.tokenOut,
                    trade.tradeAmount,
                    trade.maxPrice
                );
            totalAmountIn = tokenAmountIn.add(totalAmountIn);
        }
        require(totalAmountIn <= maxTotalAmountIn, "Benchmark: limit in error");

        _transferAll(tokenOut, _getBalance(tokenOut));
        _transferAll(tokenIn, _getBalance(tokenIn));
    }

    function multihopBatchExactTradeIn(
        Trade[][] memory tradesequences,
        IToken tokenIn,
        IToken tokenOut,
        uint256 totalAmountIn,
        uint256 minTotalAmountOut
    ) public payable returns (uint256 totalAmountOut) {
        _transferFromAll(tokenIn, totalAmountIn);

        for (uint256 i = 0; i < tradesequences.length; i++) {
            uint256 tokenAmountOut;
            for (uint256 k = 0; k < tradesequences[i].length; k++) {
                Trade memory trade = tradesequences[i][k];
                IToken TradeTokenIn = IToken(trade.tokenIn);
                if (k == 1) {
                    trade.tradeAmount = tokenAmountOut;
                }

                IBenchmarkMarket market = IBenchmarkMarket(trade.market);
                if (TradeTokenIn.allowance(address(this), trade.market) > 0) {
                    TradeTokenIn.approve(trade.market, 0);
                }
                TradeTokenIn.approve(trade.market, trade.tradeAmount);
                (tokenAmountOut, ) = market.tradeExactAmountIn(
                    trade.tokenIn,
                    trade.tradeAmount,
                    trade.tokenOut,
                    trade.limitReturnAmount,
                    trade.maxPrice
                );
            }
            // This takes the amountOut of the last trade
            totalAmountOut = tokenAmountOut.add(totalAmountOut);
        }

        require(totalAmountOut >= minTotalAmountOut, "Benchmark: limit out error");

        _transferAll(tokenOut, totalAmountOut);
        _transferAll(tokenIn, _getBalance(tokenIn));
    }

    function multihopBatchExactTradeOut(
        Trade[][] memory tradesequences,
        IToken tokenIn,
        IToken tokenOut,
        uint256 maxTotalAmountIn
    ) public payable returns (uint256 totalAmountIn) {
        _transferFromAll(tokenIn, maxTotalAmountIn);

        for (uint256 i = 0; i < tradesequences.length; i++) {
            uint256 tokenAmountInFirstTrade;
            if (tradesequences[i].length == 1) {
                Trade memory trade = tradesequences[i][0];
                IToken TradeTokenIn = IToken(trade.tokenIn);

                IBenchmarkMarket market = IBenchmarkMarket(trade.market);
                if (TradeTokenIn.allowance(address(this), trade.market) > 0) {
                    TradeTokenIn.approve(trade.market, 0);
                }
                TradeTokenIn.approve(trade.market, trade.limitReturnAmount);

                (tokenAmountInFirstTrade, ) = market.tradeExactAmountOut(
                    trade.tokenIn,
                    trade.limitReturnAmount,
                    trade.tokenOut,
                    trade.tradeAmount,
                    trade.maxPrice
                );
            } else {
                uint256 intermediateTokenAmount;
                Trade memory secondTrade = tradesequences[i][1];
                IBenchmarkMarket marketSecondTrade = IBenchmarkMarket(secondTrade.market);
                intermediateTokenAmount = marketSecondTrade.calcInGivenOut(
                    marketSecondTrade._getBalance(secondTrade.tokenIn),
                    marketSecondTrade.getDenormalizedWeight(secondTrade.tokenIn),
                    marketSecondTrade._getBalance(secondTrade.tokenOut),
                    marketSecondTrade.getDenormalizedWeight(secondTrade.tokenOut),
                    secondTrade.tradeAmount,
                    marketSecondTrade.getTradeFee()
                );

                Trade memory firstTrade = tradesequences[i][0];
                IToken FirstTradeTokenIn = IToken(firstTrade.tokenIn);
                IBenchmarkMarket marketFirstTrade = IBenchmarkMarket(firstTrade.market);
                if (FirstTradeTokenIn.allowance(address(this), firstTrade.market) < uint256(-1)) {
                    FirstTradeTokenIn.approve(firstTrade.market, uint256(-1));
                }

                (tokenAmountInFirstTrade, ) = marketFirstTrade.tradeExactAmountOut(
                    firstTrade.tokenIn,
                    firstTrade.limitReturnAmount,
                    firstTrade.tokenOut,
                    intermediateTokenAmount, // This is the amount of token B we need
                    firstTrade.maxPrice
                );

                IToken SecondTradeTokenIn = IToken(secondTrade.tokenIn);
                if (SecondTradeTokenIn.allowance(address(this), secondTrade.market) < uint256(-1)) {
                    SecondTradeTokenIn.approve(secondTrade.market, uint256(-1));
                }

                marketSecondTrade.tradeExactAmountOut(
                    secondTrade.tokenIn,
                    secondTrade.limitReturnAmount,
                    secondTrade.tokenOut,
                    secondTrade.tradeAmount,
                    secondTrade.maxPrice
                );
            }
            totalAmountIn = tokenAmountInFirstTrade.add(totalAmountIn);
        }

        require(totalAmountIn <= maxTotalAmountIn, "Benchmark: limit in error");

        _transferAll(tokenOut, _getBalance(tokenOut));
        _transferAll(tokenIn, _getBalance(tokenIn));
    }

    function smartTradeExactIn(
        IToken tokenIn,
        IToken tokenOut,
        uint256 totalAmountIn,
        uint256 minTotalAmountOut,
        uint256 nMarkets
    ) public payable returns (uint256 totalAmountOut) {
        Trade[] memory trades;
        if (_isETH(tokenIn)) {
            (trades, ) = viewSplitExactIn(address(weth), address(tokenOut), totalAmountIn, nMarkets);
        } else if (_isETH(tokenOut)) {
            (trades, ) = viewSplitExactIn(address(tokenIn), address(weth), totalAmountIn, nMarkets);
        } else {
            (trades, ) = viewSplitExactIn(
                address(tokenIn),
                address(tokenOut),
                totalAmountIn,
                nMarkets
            );
        }

        totalAmountOut = batchExactTradeIn(
            trades,
            tokenIn,
            tokenOut,
            totalAmountIn,
            minTotalAmountOut
        );
    }

    function smartTradeExactOut(
        IToken tokenIn,
        IToken tokenOut,
        uint256 totalAmountOut,
        uint256 maxTotalAmountIn,
        uint256 nMarkets
    ) public payable returns (uint256 totalAmountIn) {
        Trade[] memory trades;
        if (_isETH(tokenIn)) {
            (trades, ) = viewSplitExactOut(
                address(weth),
                address(tokenOut),
                totalAmountOut,
                nMarkets
            );
        } else if (_isETH(tokenOut)) {
            (trades, ) = viewSplitExactOut(address(tokenIn), address(weth), totalAmountOut, nMarkets);
        } else {
            (trades, ) = viewSplitExactOut(
                address(tokenIn),
                address(tokenOut),
                totalAmountOut,
                nMarkets
            );
        }

        totalAmountIn = batchTradeExactOut(trades, tokenIn, tokenOut, maxTotalAmountIn);
    }

    function viewSplitExactIn(
        address tokenIn,
        address tokenOut,
        uint256 tradeAmount,
        uint256 nMarkets
    ) public view returns (Trade[] memory trades, uint256 totalOutput) {
        address[] memory marketAddresses = data.getBestMarketsWithLimit(tokenIn, tokenOut, nMarkets);

        Market[] memory markets = new Market[](marketAddresses.length);
        uint256 sumEffectiveLiquidity;
        for (uint256 i = 0; i < marketAddresses.length; i++) {
            markets[i] = getMarketData(tokenIn, tokenOut, marketAddresses[i]);
            sumEffectiveLiquidity = sumEffectiveLiquidity.add(markets[i].effectiveLiquidity);
        }

        uint256[] memory bestInputAmounts = new uint256[](markets.length);
        uint256 totalInputAmount;
        for (uint256 i = 0; i < markets.length; i++) {
            bestInputAmounts[i] = tradeAmount.mul(markets[i].effectiveLiquidity).div(
                sumEffectiveLiquidity
            );
            totalInputAmount = totalInputAmount.add(bestInputAmounts[i]);
        }

        if (totalInputAmount < tradeAmount) {
            bestInputAmounts[0] = bestInputAmounts[0].add(tradeAmount.sub(totalInputAmount));
        } else {
            bestInputAmounts[0] = bestInputAmounts[0].sub(totalInputAmount.sub(tradeAmount));
        }

        trades = new Trade[](markets.length);

        for (uint256 i = 0; i < markets.length; i++) {
            trades[i] = Trade({
                market: markets[i].market,
                tokenIn: tokenIn,
                tokenOut: tokenOut,
                tradeAmount: bestInputAmounts[i],
                limitReturnAmount: 0,
                maxPrice: uint256(-1)
            });
        }

        totalOutput = calcTotalOutExactIn(bestInputAmounts, markets);

        return (trades, totalOutput);
    }

    function viewSplitExactOut(
        address tokenIn,
        address tokenOut,
        uint256 tradeAmount,
        uint256 nMarkets
    ) public view returns (Trade[] memory trades, uint256 totalOutput) {
        address[] memory marketAddresses = data.getBestMarketsWithLimit(tokenIn, tokenOut, nMarkets);

        Market[] memory markets = new Market[](marketAddresses.length);
        uint256 sumEffectiveLiquidity;
        for (uint256 i = 0; i < marketAddresses.length; i++) {
            markets[i] = getMarketData(tokenIn, tokenOut, marketAddresses[i]);
            sumEffectiveLiquidity = sumEffectiveLiquidity.add(markets[i].effectiveLiquidity);
        }

        uint256[] memory bestInputAmounts = new uint256[](markets.length);
        uint256 totalInputAmount;
        for (uint256 i = 0; i < markets.length; i++) {
            bestInputAmounts[i] = tradeAmount.mul(markets[i].effectiveLiquidity).div(
                sumEffectiveLiquidity
            );
            totalInputAmount = totalInputAmount.add(bestInputAmounts[i]);
        }

        if (totalInputAmount < tradeAmount) {
            bestInputAmounts[0] = bestInputAmounts[0].add(tradeAmount.sub(totalInputAmount));
        } else {
            bestInputAmounts[0] = bestInputAmounts[0].sub(totalInputAmount.sub(tradeAmount));
        }

        trades = new Trade[](markets.length);

        for (uint256 i = 0; i < markets.length; i++) {
            trades[i] = Trade({
                market: markets[i].market,
                tokenIn: tokenIn,
                tokenOut: tokenOut,
                tradeAmount: bestInputAmounts[i],
                limitReturnAmount: uint256(-1),
                maxPrice: uint256(-1)
            });
        }

        totalOutput = calcTotalOutExactOut(bestInputAmounts, markets);

        return (trades, totalOutput);
    }

    function getMarketData(
        address tokenIn,
        address tokenOut,
        address marketAddress
    ) internal view returns (Market memory) {
        IBenchmarkMarket market = IBenchmarkMarket(marketAddress);
        uint256 tokenBalanceIn = market._getBalance(tokenIn);
        uint256 tokenBalanceOut = market._getBalance(tokenOut);
        uint256 tokenWeightIn = market.getDenormalizedWeight(tokenIn);
        uint256 tokenWeightOut = market.getDenormalizedWeight(tokenOut);
        uint256 tradeFee = market.getTradeFee();

        uint256 effectiveLiquidity =
            calcEffectiveLiquidity(tokenWeightIn, tokenBalanceOut, tokenWeightOut);
        Market memory returnMarket =
            Market({
                market: marketAddress,
                tokenBalanceIn: tokenBalanceIn,
                tokenWeightIn: tokenWeightIn,
                tokenBalanceOut: tokenBalanceOut,
                tokenWeightOut: tokenWeightOut,
                tradeFee: tradeFee,
                effectiveLiquidity: effectiveLiquidity
            });

        return returnMarket;
    }

    function calcEffectiveLiquidity(
        uint256 tokenWeightIn,
        uint256 tokenBalanceOut,
        uint256 tokenWeightOut
    ) internal pure returns (uint256 effectiveLiquidity) {
        // Bo * wi/(wi+wo)
        effectiveLiquidity = tokenWeightIn
            .mul(WAD)
            .div(tokenWeightOut.add(tokenWeightIn))
            .mul(tokenBalanceOut)
            .div(WAD);

        return effectiveLiquidity;
    }

    function calcTotalOutExactIn(uint256[] memory bestInputAmounts, Market[] memory bestMarkets)
        internal
        pure
        returns (uint256 totalOutput)
    {
        totalOutput = 0;
        for (uint256 i = 0; i < bestInputAmounts.length; i++) {
            uint256 output =
                IBenchmarkMarket(bestMarkets[i].market).calcOutGivenIn(
                    bestMarkets[i].tokenBalanceIn,
                    bestMarkets[i].tokenWeightIn,
                    bestMarkets[i].tokenBalanceOut,
                    bestMarkets[i].tokenWeightOut,
                    bestInputAmounts[i],
                    bestMarkets[i].tradeFee
                );

            totalOutput = totalOutput.add(output);
        }
        return totalOutput;
    }

    function calcTotalOutExactOut(uint256[] memory bestInputAmounts, Market[] memory bestMarkets)
        internal
        pure
        returns (uint256 totalOutput)
    {
        totalOutput = 0;
        for (uint256 i = 0; i < bestInputAmounts.length; i++) {
            uint256 output =
                IBenchmarkMarket(bestMarkets[i].market).calcInGivenOut(
                    bestMarkets[i].tokenBalanceIn,
                    bestMarkets[i].tokenWeightIn,
                    bestMarkets[i].tokenBalanceOut,
                    bestMarkets[i].tokenWeightOut,
                    bestInputAmounts[i],
                    bestMarkets[i].tradeFee
                );

            totalOutput = totalOutput.add(output);
        }
        return totalOutput;
    }

    function _transferFromAll(IToken token, uint256 amount) internal returns (bool) {
        if (_isETH(token)) {
            weth.deposit.value(msg.value)();
        } else {
            require(token.transferFrom(msg.sender, address(this), amount), "ERR_TRANSFER_FAILED");
        }
    }

    function _getBalance(IToken token) internal view returns (uint256) {
        if (_isETH(token)) {
            return weth.balanceOf(address(this));
        } else {
            return token.balanceOf(address(this));
        }
    }

    function _transferAll(IToken token, uint256 amount) internal returns (bool) {
        if (amount == 0) {
            return true;
        }

        if (_isETH(token)) {
            weth.withdraw(amount);
            (bool xfer, ) = msg.sender.call.value(amount)("");
            require(xfer, "ERR_ETH_FAILED");
        } else {
            require(token.transfer(msg.sender, amount), "ERR_TRANSFER_FAILED");
        }
    }

    function _isETH(IToken token) internal pure returns (bool) {
        return (address(token) == ETH_ADDRESS);
    }
}
