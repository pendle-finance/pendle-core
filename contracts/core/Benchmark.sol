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

contract Benchmark is IBenchmark, Permissions {
    using SafeMath for uint256;

    IBenchmarkData public override data;

    address public immutable override weth;
    address public override treasury;

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

    function swapXytToToken(
        bytes32 _forgeId,
        bytes32 _marketFactoryId,
        address xyt,
        address token,
        uint256 xytAmountDesired,
        uint256 tokenAmountMin,
        uint256 maxPrice
    ) public override returns (uint256 amount, uint256 priceAfter) {
        IBenchmarkMarket market =
            IBenchmarkMarket(data.getMarket(_forgeId, _marketFactoryId, xyt, token));
        require(address(market) != address(0), "Benchmark: market not found");
        (amount, priceAfter) = market.swapAmountIn(
            msg.sender,
            xytAmountDesired,
            xyt,
            token,
            tokenAmountMin,
            maxPrice
        );
    }

    function swapTokenToXyt(
        bytes32 _forgeId,
        bytes32 _marketFactoryId,
        address xyt,
        address token,
        uint256 tokenAmountDesired,
        uint256 xytAmountMin,
        uint256 maxPrice
    ) public override returns (uint256 amount, uint256 priceAfter) {
        IBenchmarkMarket market =
            IBenchmarkMarket(data.getMarket(_forgeId, _marketFactoryId, xyt, token));
        require(address(market) != address(0), "Benchmark: market not found");
        (amount, priceAfter) = market.swapAmountIn(
            msg.sender,
            tokenAmountDesired,
            token,
            xyt,
            xytAmountMin,
            maxPrice
        );
    }

    function swapXytFromToken(
        bytes32 _forgeId,
        bytes32 _marketFactoryId,
        address xyt,
        address token,
        uint256 xytAmountDesired,
        uint256 tokenAmountMax,
        uint256 maxPrice
    ) public override returns (uint256 amount, uint256 priceAfter) {
        IBenchmarkMarket market =
            IBenchmarkMarket(data.getMarket(_forgeId, _marketFactoryId, xyt, token));
        require(address(market) != address(0), "Benchmark: market not found");
        (amount, priceAfter) = market.swapAmountOut(
            msg.sender,
            token,
            tokenAmountMax,
            xyt,
            xytAmountDesired,
            maxPrice
        );
    }

    function swapTokenFromXyt(
        bytes32 _forgeId,
        bytes32 _marketFactoryId,
        address xyt,
        address token,
        uint256 tokenAmountDesired,
        uint256 xytAmountMax,
        uint256 maxPrice
    ) public override returns (uint256 amount, uint256 priceAfter) {
        IBenchmarkMarket market =
            IBenchmarkMarket(data.getMarket(_forgeId, _marketFactoryId, xyt, token));
        require(address(market) != address(0), "Benchmark: market not found");
        (amount, priceAfter) = market.swapAmountOut(
            msg.sender,
            xyt,
            xytAmountMax,
            token,
            tokenAmountDesired,
            maxPrice
        );
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
    }

    /*
    function addMarketLiquidity(
        address xyt,
        address token,
        uint256 xytAmountDesired,
        uint256 tokenAmountDesired,
        uint256 xytAmountMin,
        uint256 tokenAmountMin,
        address to
    )
        public
        override
        returns (
            uint256 xytAmount,
            uint256 tokenAmount,
            uint256 liquidity
        )
    {}

    function addMarketLiquidityETH(
        address xyt,
        uint256 xytAmountDesired,
        uint256 xytAmountMin,
        uint256 ethAmountMin,
        address to
    )
        public
        payable
        override
        returns (
            uint256 amountToken,
            uint256 amountETH,
            uint256 liquidity
        )
    {}

    function removeMarketLiquidity(
        address xyt,
        address token,
        uint256 liquidity,
        uint256 xytAmountMin,
        uint256 tokenAmountMin,
        address to
    ) public override returns (uint256 xytAmount, uint256 tokenAmount) {}

    function removeMarketLiquidityETH(
        address token,
        uint256 liquidity,
        uint256 tokenAmountMin,
        uint256 ethAmountMin,
        address to
    ) public override returns (uint256 tokenAmount, uint256 ethAmount) {}

    function swapTokenToToken(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) public override returns (uint256[] memory amounts) {}

    function swapEthToToken(
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) public payable override returns (uint256[] memory amounts) {}

    function swapTokenToEth(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) public override returns (uint256[] memory amounts) {}

    function getDestAmount(
        uint256 srcAmount,
        uint256 srcMarket,
        uint256 destMarket
    ) public pure override returns (uint256 destAmount) {}

    function getSrcAmount(
        uint256 destAmount,
        uint256 srcMarket,
        uint256 destMarket
    ) public pure override returns (uint256 srcAmount) {}

    function getDestAmounts(uint256 srcAmount, address[] calldata path)
        public
        view
        override
        returns (uint256[] memory destAmounts)
    {}

    function getSrcAmounts(uint256 destAmount, address[] calldata path)
        public
        view
        override
        returns (uint256[] memory srcAmounts)
    {}

    function getMarketRate(
        uint256 srcAmount,
        uint256 marketA,
        uint256 marketB
    ) public pure override returns (uint256 destAmount) {}
    */
}
