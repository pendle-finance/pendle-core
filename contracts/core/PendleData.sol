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

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../libraries/MathLib.sol";
import "../interfaces/IPendleData.sol";
import "../interfaces/IPendleMarket.sol";
import "../interfaces/IPendleMarketFactory.sol";
import "../periphery/Permissions.sol";

contract PendleData is IPendleData, Permissions {
    using SafeMath for uint256;

    struct MarketInfo {
        uint80 xytWeight;
        uint80 tokenWeight;
        uint256 liquidity;
    }

    mapping(address => bytes32) public override getForgeId;
    mapping(bytes32 => address) public override getForgeAddress;
    mapping(address => bytes32) public override getMarketFactoryId;
    mapping(bytes32 => address) public override getMarketFactoryAddress;

    mapping(bytes32 => mapping(address => mapping(address => address))) public override getMarket; // getMarket[marketFactoryId][xyt][token]
    mapping(bytes32 => mapping(address => mapping(uint256 => IPendleYieldToken)))
        public
        override otTokens; // [forgeId][underlyingAsset][expiry]
    mapping(bytes32 => mapping(address => mapping(uint256 => IPendleYieldToken)))
        public
        override xytTokens; // [forgeId][underlyingAsset][expiry]
    uint256 public override swapFee;
    uint256 public override exitFee;
    IPendleRouter public override router;
    address public override treasury;
    mapping(address => bool) public override isMarket;
    mapping(bytes32 => address) private markets;
    mapping(bytes32 => MarketInfo) private marketInfo;
    address[] private allMarkets;

    constructor(address _governance, address _treasury) Permissions(_governance) {
        require(_treasury != address(0), "ZERO_ADDRESS");
        treasury = _treasury;
    }

    modifier onlyRouter() {
        require(msg.sender == address(router), "ONLY_ROUTER");
        _;
    }

    modifier onlyForge(bytes32 _forgeId) {
        require(getForgeAddress[_forgeId] == msg.sender, "ONLY_FORGE");
        _;
    }

    modifier onlyMarketFactory(bytes32 _marketFactoryId) {
        require(msg.sender == getMarketFactoryAddress[_marketFactoryId], "ONLY_MARKET_FACTORY");
        _;
    }

    function initialize(IPendleRouter _router) external {
        require(msg.sender == initializer, "FORBIDDEN");
        require(address(_router) != address(0), "ZERO_ADDRESS");

        initializer = address(0);
        router = _router;
    }

    function setTreasury(address _treasury) external override initialized onlyGovernance {
        require(_treasury != address(0), "ZERO_ADDRESS");

        treasury = _treasury;
        emit TreasurySet(_treasury);
    }

    /**********
     *  FORGE *
     **********/

    function addForge(bytes32 _forgeId, address _forgeAddress)
        external
        override
        initialized
        onlyRouter
    {
        getForgeId[_forgeAddress] = _forgeId;
        getForgeAddress[_forgeId] = _forgeAddress;

        emit ForgeAdded(_forgeId, _forgeAddress);
    }

    function storeTokens(
        bytes32 _forgeId,
        address _ot,
        address _xyt,
        address _underlyingAsset,
        uint256 _expiry
    ) external override initialized onlyForge(_forgeId) {
        otTokens[_forgeId][_underlyingAsset][_expiry] = IPendleYieldToken(_ot);
        xytTokens[_forgeId][_underlyingAsset][_expiry] = IPendleYieldToken(_xyt);
    }

    function getPendleYieldTokens(
        bytes32 _forgeId,
        address _underlyingAsset,
        uint256 _expiry
    ) external view override returns (IPendleYieldToken ot, IPendleYieldToken xyt) {
        ot = otTokens[_forgeId][_underlyingAsset][_expiry];
        xyt = xytTokens[_forgeId][_underlyingAsset][_expiry];
    }

    function isValidXYT(
        address _forge,
        address _underlyingAsset,
        uint256 _expiry
    ) external view override returns (bool) {
        bytes32 forgeId = getForgeId[_forge];
        return (forgeId != bytes32(0) &&
            address(xytTokens[forgeId][_underlyingAsset][_expiry]) != address(0));
    }

    function isValidXYT(
        bytes32 _forgeId,
        address _underlyingAsset,
        uint256 _expiry
    ) external view override returns (bool) {
        return address(xytTokens[_forgeId][_underlyingAsset][_expiry]) != address(0);
    }

    /***********
     *  MARKET *
     ***********/
    function addMarketFactory(bytes32 _marketFactoryId, address _marketFactoryAddress)
        external
        override
        initialized
        onlyRouter
    {
        getMarketFactoryId[_marketFactoryAddress] = _marketFactoryId;
        getMarketFactoryAddress[_marketFactoryId] = _marketFactoryAddress;
    }

    function addMarket(
        bytes32 _marketFactoryId,
        address _xyt,
        address _token,
        address _market
    ) external override initialized onlyMarketFactory(_marketFactoryId) {
        allMarkets.push(_market);

        bytes32 key = _createKey(_xyt, _token, _marketFactoryId);
        markets[key] = _market;

        getMarket[_marketFactoryId][_xyt][_token] = _market;
        isMarket[_market] = true;

        emit MarketPairAdded(_market, _xyt, _token);
    }

    function setMarketFees(uint256 _swapFee, uint256 _exitFee) external override onlyGovernance {
        swapFee = _swapFee;
        exitFee = _exitFee;
    }

    function updateMarketInfo(
        address _xyt,
        address _token,
        address _marketFactory
    ) public override {
        bytes32 marketFactoryId = getMarketFactoryId[_marketFactory];
        _updateMarketInfo(_xyt, _token, marketFactoryId);
    }

    function updateMarketInfo(
        address _xyt,
        address _token,
        bytes32 _marketFactoryId
    ) public override {
        _updateMarketInfo(_xyt, _token, _marketFactoryId);
    }

    function _updateMarketInfo(
        address _xyt,
        address _token,
        bytes32 _marketFactoryId
    ) internal {
        bytes32 key = _createKey(_xyt, _token, _marketFactoryId);
        address market = markets[key];
        MarketInfo memory info = marketInfo[key];

        info.xytWeight = uint80(IPendleMarket(market).getWeight(_xyt));
        info.tokenWeight = uint80(IPendleMarket(market).getWeight(_token));
        info.liquidity = Math.rdiv(
            uint256(info.xytWeight),
            uint256(info.xytWeight).add(uint256(info.tokenWeight))
        );

        marketInfo[key] = info;
    }

    function allMarketsLength() external view override returns (uint256) {
        return allMarkets.length;
    }

    function getAllMarkets() external view override returns (address[] memory) {
        return allMarkets;
    }

    function getMarketFromKey(
        address _tokenIn,
        address _tokenOut,
        bytes32 _marketFactoryId
    ) external view override returns (address market) {
        bytes32 key = _createKey(_tokenIn, _tokenOut, _marketFactoryId);
        market = markets[key];
    }

    function getMarketInfo(
        address _tokenIn,
        address _tokenOut,
        bytes32 _marketFactoryId
    )
        external
        view
        override
        returns (
            uint256 xytWeight,
            uint256 tokenWeight,
            uint256 liquidity
        )
    {
        bytes32 key = _createKey(_tokenIn, _tokenOut, _marketFactoryId);
        MarketInfo memory info = marketInfo[key];

        xytWeight = info.xytWeight;
        tokenWeight = info.tokenWeight;
        liquidity = info.liquidity;
    }

    function getEffectiveLiquidityForMarket(
        address _tokenIn,
        address _tokenOut,
        bytes32 _marketFactoryId
    ) public view override returns (uint256 effectiveLiquidity) {
        bytes32 key = _createKey(_tokenIn, _tokenOut, _marketFactoryId);
        address market = markets[key];
        MarketInfo memory info = marketInfo[key];

        effectiveLiquidity = Math.rdiv(
            uint256(info.xytWeight),
            uint256(info.xytWeight).add(uint256(info.tokenWeight))
        );
        effectiveLiquidity = effectiveLiquidity.mul(IPendleMarket(market).getBalance(_tokenOut));
    }

    function _createKey(
        address _tokenA,
        address _tokenB,
        bytes32 _factoryId
    ) internal pure returns (bytes32) {
        (address tokenX, address tokenY) =
            _tokenA < _tokenB ? (_tokenA, _tokenB) : (_tokenB, _tokenA);
        return keccak256(abi.encode(tokenX, tokenY, _factoryId));
    }
}
