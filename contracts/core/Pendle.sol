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
import "../interfaces/IPendle.sol";
import "../interfaces/IPendleForge.sol";
import "../interfaces/IPendleMarketFactory.sol";
import "../interfaces/IPendleMarket.sol";
import "../periphery/Permissions.sol";

contract Pendle is IPendle, Permissions {
    using SafeMath for uint256;

    IPendleData public override data;

    address public immutable override weth;
    address public override treasury;

    string public constant ERR_ZERO_ADDRESS = "Pendle: zero address";
    string public constant ERR_ZERO_BYTES = "Pendle: zero bytes";
    string public constant ERR_MARKET_NOT_FOUND = "Pendle: market not found";
    string public constant ERR_FORGE_NOT_EXIST = "Pendle: forge doesn't exist";

    constructor(address _governance, address _weth) Permissions(_governance) {
        weth = _weth;
    }

    /**
     * @dev Accepts ETH via fallback from the WETH contract.
     **/
    receive() external payable {
        assert(msg.sender == weth);
    }

    function initialize(IPendleData _data, address _treasury) external {
        require(msg.sender == initializer, "Pendle: forbidden");
        require(address(_data) != address(0), ERR_ZERO_ADDRESS);
        require(_treasury != address(0), ERR_ZERO_ADDRESS);

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
        require(_forgeId != bytes32(0), ERR_ZERO_BYTES);
        require(_forgeAddress != address(0), ERR_ZERO_ADDRESS);
        require(_forgeId == IPendleForge(_forgeAddress).forgeId(), "Pendle: wrong id");
        require(data.getForgeAddress(_forgeId) == address(0), "Pendle: existing id");
        data.addForge(_forgeId, _forgeAddress);
    }

    function addMarketFactory(
        bytes32 _forgeId,
        bytes32 _marketFactoryId,
        address _marketFactoryAddress
    ) external override initialized onlyGovernance {
        require(_forgeId != bytes32(0), ERR_ZERO_BYTES);
        require(_marketFactoryId != bytes32(0), ERR_ZERO_BYTES);
        require(_marketFactoryAddress != address(0), ERR_ZERO_ADDRESS);
        require(
            _marketFactoryId == IPendleMarketFactory(_marketFactoryAddress).marketFactoryId(),
            "Pendle: wrong id"
        );
        require(
            data.getMarketFactoryAddress(_forgeId, _marketFactoryId) == address(0),
            "Pendle: existing id"
        );
        data.addMarketFactory(_forgeId, _marketFactoryId, _marketFactoryAddress);
    }

    // @@Vu TODO: do we ever want to remove a forge? It will render all existing XYTs and OTs and Markets for that forge invalid
    function removeForge(bytes32 _forgeId) external override initialized onlyGovernance {
        require(data.getForgeAddress(_forgeId) != address(0), ERR_FORGE_NOT_EXIST);
        data.removeForge(_forgeId);
    }

    // @@Vu Notice: setting a different PendleData is basically rendering the whole existing system invalid. Will we ever want that?
    function setContracts(IPendleData _data, address _treasury)
        external
        override
        initialized
        onlyGovernance
    {
        require(address(_data) != address(0), ERR_ZERO_ADDRESS);
        require(_treasury != address(0), ERR_ZERO_ADDRESS);

        data = _data;
        treasury = _treasury;
        emit ContractsSet(address(_data), _treasury);
    }

    /***********
     *  FORGE  *
     ***********/

    /**
     *@dev no checks on _expiry
     */
    function newYieldContracts(
        bytes32 _forgeId,
        address _underlyingAsset,
        uint256 _expiry
    ) public override returns (address ot, address xyt) {
        _checkValidYieldAndRedeemTransaction(_forgeId, _underlyingAsset);

        IPendleForge forge = IPendleForge(data.getForgeAddress(_forgeId));
        require(address(forge) != address(0), ERR_FORGE_NOT_EXIST);
        (ot, xyt) = forge.newYieldContracts(_underlyingAsset, _expiry);
    }

    /**
     *@dev no checks on _expiry
     */
    function redeemDueInterests(
        bytes32 _forgeId,
        address _underlyingAsset,
        uint256 _expiry
    ) public override returns (uint256 interests) {
        _checkValidYieldAndRedeemTransaction(_forgeId, _underlyingAsset);

        IPendleForge forge = IPendleForge(data.getForgeAddress(_forgeId));
        require(address(forge) != address(0), ERR_FORGE_NOT_EXIST);
        interests = forge.redeemDueInterests(msg.sender, _underlyingAsset, _expiry);
    }

    /**
     *@dev no checks on _expiry
     */
    function redeemAfterExpiry(
        bytes32 _forgeId,
        address _underlyingAsset,
        uint256 _expiry,
        address _to
    ) public override returns (uint256 redeemedAmount) {
        _checkValidYieldAndRedeemTransaction(_forgeId, _underlyingAsset);
        require(_to != address(0), ERR_ZERO_ADDRESS);

        IPendleForge forge = IPendleForge(data.getForgeAddress(_forgeId));
        require(address(forge) != address(0), ERR_FORGE_NOT_EXIST);
        redeemedAmount = forge.redeemAfterExpiry(msg.sender, _underlyingAsset, _expiry, _to);
    }

    /**
     *@dev no checks on _oldExpiry, _amountToRedeem
     */
    function redeemUnderlying(
        bytes32 _forgeId,
        address _underlyingAsset,
        uint256 _expiry,
        uint256 _amountToRedeem,
        address _to
    ) public override returns (uint256 redeemedAmount) {
        _checkValidYieldAndRedeemTransaction(_forgeId, _underlyingAsset);
        require(_to != address(0), ERR_ZERO_ADDRESS);

        IPendleForge forge = IPendleForge(data.getForgeAddress(_forgeId));
        require(address(forge) != address(0), ERR_FORGE_NOT_EXIST);
        redeemedAmount = forge.redeemUnderlying(
            msg.sender,
            _underlyingAsset,
            _expiry,
            _amountToRedeem,
            _to
        );
    }

    /**
     *@dev no checks on _oldExpiry, _amountToRedeem
     */
    function tokenizeYield(
        bytes32 _forgeId,
        address _underlyingAsset,
        uint256 _expiry,
        uint256 _amountToTokenize,
        address _to
    ) public override returns (address ot, address xyt) {
        _checkValidYieldAndRedeemTransaction(_forgeId, _underlyingAsset);
        require(_to != address(0), ERR_ZERO_ADDRESS);

        IPendleForge forge = IPendleForge(data.getForgeAddress(_forgeId));
        require(address(forge) != address(0), ERR_FORGE_NOT_EXIST);
        (ot, xyt) = forge.tokenizeYield(
            msg.sender,
            _underlyingAsset,
            _expiry,
            _amountToTokenize,
            _to
        );
    }

    /**
     *@dev no checks on _oldExpiry
     */
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
        _checkValidYieldAndRedeemTransaction(_forgeId, _underlyingAsset);
        require(_newExpiry > _oldExpiry, "Pendle: new expiry must be later than old expiry"); // strictly greater
        require(_yieldTo != address(0), ERR_ZERO_ADDRESS);

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

    /**
    *@dev if either _forgeId, _marketFactoryId, xyt, token is invalid
        => require(address(market) != address(0)) will fail
    *@dev no checks on exactOutLp, maxInXyt, max
    */
    function addMarketLiquidity(
        bytes32 _forgeId,
        bytes32 _marketFactoryId,
        address xyt,
        address token,
        uint256 exactOutLp,
        uint256 maxInXyt,
        uint256 maxInToken
    ) public override {
        IPendleMarket market =
            IPendleMarket(data.getMarket(_forgeId, _marketFactoryId, xyt, token));
        require(address(market) != address(0), ERR_MARKET_NOT_FOUND);
        market.joinPoolByAll(msg.sender, exactOutLp, maxInXyt, maxInToken);
    }

    /**
    *@dev if either _forgeId, _marketFactoryId, xyt, token is invalid
        => require(address(market) != address(0)) will fail
    *@dev no checks on exactInXyt, minOutLp
    */
    function addMarketLiquidityXyt(
        bytes32 _forgeId,
        bytes32 _marketFactoryId,
        address xyt,
        address token,
        uint256 exactInXyt,
        uint256 minOutLp
    ) public override {
        IPendleMarket market =
            IPendleMarket(data.getMarket(_forgeId, _marketFactoryId, xyt, token));
        require(address(market) != address(0), ERR_MARKET_NOT_FOUND);
        market.joinPoolSingleToken(msg.sender, xyt, exactInXyt, minOutLp);
    }

    /**
    *@dev if either _forgeId, _marketFactoryId, xyt, token is invalid
        => require(address(market) != address(0)) will fail
    *@dev no checks on exactInToken, minOutLp
    */
    function addMarketLiquidityToken(
        bytes32 _forgeId,
        bytes32 _marketFactoryId,
        address xyt,
        address token,
        uint256 exactInToken,
        uint256 minOutLp
    ) public override {
        IPendleMarket market =
            IPendleMarket(data.getMarket(_forgeId, _marketFactoryId, xyt, token));
        require(address(market) != address(0), ERR_MARKET_NOT_FOUND);
        market.joinPoolSingleToken(msg.sender, token, exactInToken, minOutLp);
    }

    /**
    *@dev if either _forgeId, _marketFactoryId, xyt, token is invalid
        => require(address(market) != address(0)) will fail
    *@dev no checks on exactInLp, minOutXyt, minOutToken
    */
    function removeMarketLiquidity(
        bytes32 _forgeId,
        bytes32 _marketFactoryId,
        address xyt,
        address token,
        uint256 exactInLp,
        uint256 minOutXyt,
        uint256 minOutToken
    ) public override {
        IPendleMarket market =
            IPendleMarket(data.getMarket(_forgeId, _marketFactoryId, xyt, token));
        require(address(market) != address(0), ERR_MARKET_NOT_FOUND);
        market.exitPoolByAll(msg.sender, exactInLp, minOutXyt, minOutToken);
    }

    /**
    *@dev if either _forgeId, _marketFactoryId, xyt, token is invalid
        => require(address(market) != address(0)) will fail
    *@dev no checks on exactInLp, minOutXyt
    */
    function removeMarketLiquidityXyt(
        bytes32 _forgeId,
        bytes32 _marketFactoryId,
        address xyt,
        address token,
        uint256 exactInLp,
        uint256 minOutXyt
    ) public override {
        IPendleMarket market =
            IPendleMarket(data.getMarket(_forgeId, _marketFactoryId, xyt, token));
        require(address(market) != address(0), ERR_MARKET_NOT_FOUND);
        market.exitPoolSingleToken(msg.sender, xyt, exactInLp, minOutXyt);
    }

    /**
    *@dev if either _forgeId, _marketFactoryId, xyt, token is invalid
        => require(address(market) != address(0)) will fail
    *@dev no checks on exactOutLp, minOutToken
    */
    function removeMarketLiquidityToken(
        bytes32 _forgeId,
        bytes32 _marketFactoryId,
        address xyt,
        address token,
        uint256 exactInLp,
        uint256 minOutToken
    ) public override {
        IPendleMarket market =
            IPendleMarket(data.getMarket(_forgeId, _marketFactoryId, xyt, token));
        require(address(market) != address(0), ERR_MARKET_NOT_FOUND);
        market.exitPoolSingleToken(msg.sender, token, exactInLp, minOutToken);
    }

    /**
    *@dev if either _forgeId, _marketFactoryId, xyt, token is invalid
        => require(address(market) != address(0)) will fail
    *@dev no checks on exactInXyt, minOutToken, maxPrice
    */
    function swapXytToToken(
        bytes32 _forgeId,
        bytes32 _marketFactoryId,
        address xyt,
        address token,
        uint256 exactInXyt,
        uint256 minOutToken,
        uint256 maxPrice
    ) public override returns (uint256 amount, uint256 priceAfter) {
        IPendleMarket market =
            IPendleMarket(data.getMarket(_forgeId, _marketFactoryId, xyt, token));
        require(address(market) != address(0), ERR_MARKET_NOT_FOUND);
        (amount, priceAfter) = market.swapAmountIn(
            msg.sender,
            exactInXyt,
            xyt,
            token,
            minOutToken,
            maxPrice
        );
    }

    /**
    *@dev if either _forgeId, _marketFactoryId, xyt, token is invalid
        => require(address(market) != address(0)) will fail
    *@dev no checks on exactInToken, minOutXyt, maxPrice
    */
    function swapTokenToXyt(
        bytes32 _forgeId,
        bytes32 _marketFactoryId,
        address xyt,
        address token,
        uint256 exactInToken,
        uint256 minOutXyt,
        uint256 maxPrice
    ) public override returns (uint256 amount, uint256 priceAfter) {
        IPendleMarket market =
            IPendleMarket(data.getMarket(_forgeId, _marketFactoryId, xyt, token));
        require(address(market) != address(0), ERR_MARKET_NOT_FOUND);
        (amount, priceAfter) = market.swapAmountIn(
            msg.sender,
            exactInToken,
            token,
            xyt,
            minOutXyt,
            maxPrice
        );
    }

    /**
    *@dev if either _forgeId, _marketFactoryId, xyt, token is invalid
        => require(address(market) != address(0)) will fail
    *@dev no checks on exactOutXyt, maxInToken, maxPrice
    */
    function swapXytFromToken(
        bytes32 _forgeId,
        bytes32 _marketFactoryId,
        address xyt,
        address token,
        uint256 exactOutXyt,
        uint256 maxInToken,
        uint256 maxPrice
    ) public override returns (uint256 amount, uint256 priceAfter) {
        IPendleMarket market =
            IPendleMarket(data.getMarket(_forgeId, _marketFactoryId, xyt, token));
        require(address(market) != address(0), ERR_MARKET_NOT_FOUND);
        (amount, priceAfter) = market.swapAmountOut(
            msg.sender,
            token,
            maxInToken,
            xyt,
            exactOutXyt,
            maxPrice
        );
    }

    /**
    *@dev if either _forgeId, _marketFactoryId, xyt, token is invalid
        => require(address(market) != address(0)) will fail
    *@dev no checks on exactOutToken, maxInXyt, maxPrice
    */
    function swapTokenFromXyt(
        bytes32 _forgeId,
        bytes32 _marketFactoryId,
        address xyt,
        address token,
        uint256 exactOutToken,
        uint256 maxInXyt,
        uint256 maxPrice
    ) public override returns (uint256 amount, uint256 priceAfter) {
        IPendleMarket market =
            IPendleMarket(data.getMarket(_forgeId, _marketFactoryId, xyt, token));
        require(address(market) != address(0), ERR_MARKET_NOT_FOUND);
        (amount, priceAfter) = market.swapAmountOut(
            msg.sender,
            xyt,
            maxInXyt,
            token,
            exactOutToken,
            maxPrice
        );
    }

    /**
    *@dev if either _forgeId, _marketFactoryId, xyt, token is invalid
        => require(address(market) != address(0)) will fail
    */
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
        IPendleMarket market =
            IPendleMarket(data.getMarket(_forgeId, _marketFactoryId, xyt, token));
        require(address(market) != address(0), ERR_MARKET_NOT_FOUND);
        (xytAmount, tokenAmount, currentTime) = market.getReserves();
    }

    /**
    *@dev if either _forgeId, _marketFactoryId, xyt, token is invalid
        => address(market) == address(0) and function will return 0
    */
    function getMarketRateXyt(
        bytes32 _forgeId,
        bytes32 _marketFactoryId,
        address xyt,
        address token
    ) public view override returns (uint256 price) {
        IPendleMarket market =
            IPendleMarket(data.getMarket(_forgeId, _marketFactoryId, xyt, token));
        if (address(market) == address(0)) return 0;
        price = market.spotPrice(xyt, token);
    }

    /**
    *@dev if either _forgeId, _marketFactoryId, xyt, token is invalid
        => address(market) == address(0) and function will return 0
    */
    function getMarketRateToken(
        bytes32 _forgeId,
        bytes32 _marketFactoryId,
        address xyt,
        address token
    ) public view override returns (uint256 price) {
        IPendleMarket market =
            IPendleMarket(data.getMarket(_forgeId, _marketFactoryId, xyt, token));
        if (address(market) == address(0)) return 0;
        price = market.spotPrice(token, xyt);
    }

    /**
    *@dev if either _forgeId, _marketFactoryId is invalid
        => require(address(factory) != address(0)) will fail
    *@dev no check on expiry
    */
    function createMarket(
        bytes32 _forgeId,
        bytes32 _marketFactoryId,
        address xyt,
        address token,
        uint256 expiry
    ) public override returns (address market) {
        require(xyt != address(0), ERR_ZERO_ADDRESS);
        require(token != address(0), ERR_ZERO_ADDRESS);

        IPendleMarketFactory factory =
            IPendleMarketFactory(data.getMarketFactoryAddress(_forgeId, _marketFactoryId));
        require(address(factory) != address(0), "Pendle: Factory not found");
        market = factory.createMarket(_forgeId, xyt, token, expiry); //@@XM should use forge directly? otherwise need to add in msg.sender here
    }

    /**
    *@dev if either _forgeId, _marketFactoryId, xyt, token is invalid
        => require(address(market) != address(0)) will fail
    */
    function bootStrapMarket(
        bytes32 _forgeId,
        bytes32 _marketFactoryId,
        address xyt,
        address token,
        uint256 initialXytLiquidity,
        uint256 initialTokenLiquidity
    ) public override {
        require(initialXytLiquidity > 0, "Pendle: initial Xyt amount must be greater than zero");
        require(
            initialTokenLiquidity > 0,
            "Pendle: initial token amount must be greater than zero"
        );

        IPendleMarket market =
            IPendleMarket(data.getMarket(_forgeId, _marketFactoryId, xyt, token));
        require(address(market) != address(0), ERR_MARKET_NOT_FOUND);
        market.bootstrap(msg.sender, initialXytLiquidity, initialTokenLiquidity);
    }

    function getAllMarkets() public view override returns (address[] memory) {
        return (data.getAllMarkets());
    }

    // @@Vu TODO: This is not returning the list of markets for the underlying token. We will need to add some structs to PendleData to query this
    function getMarketByUnderlyingToken(
        bytes32 _forgeId,
        bytes32 _marketFactoryId,
        address _underlyingAsset,
        uint256 _expiry
    ) public view override returns (address market) {
        // no checks since the function is not done yet
        (IPendleYieldToken xyt, IPendleYieldToken token) =
            data.getPendleYieldTokens(_forgeId, _underlyingAsset, _expiry);
        market = data.getMarket(_forgeId, _marketFactoryId, address(xyt), address(token));
    }

    function getMarketTokenAddresses(address market)
        public
        view
        override
        returns (address token, address xyt)
    {
        require(data.isMarket(market), ERR_MARKET_NOT_FOUND);

        IPendleMarket benmarkMarket = IPendleMarket(market);
        token = benmarkMarket.token();
        xyt = benmarkMarket.xyt();
    }

    function _checkValidYieldAndRedeemTransaction(bytes32 _forgeId, address _underlyingAsset)
        internal
        pure
    {
        require(_forgeId != bytes32(0), ERR_ZERO_BYTES);
        require(_underlyingAsset != address(0), ERR_ZERO_ADDRESS);
    }
}
