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
import {Enumerable, Math} from "../libraries/PendleLibrary.sol";
import "../interfaces/IPendleData.sol";
import "../interfaces/IPendleMarket.sol";
import "../interfaces/IPendleMarketFactory.sol";
import "../periphery/Permissions.sol";

contract PendleData is IPendleData, Permissions {
    using SafeMath for uint256;
    using Enumerable for Enumerable.AddressSet;

    struct MarketInfo {
        uint80 xytWeight;
        uint80 tokenWeight;
        uint256 liquidity;
    }

    struct SortedMarkets {
        Enumerable.AddressSet markets;
        bytes32 indices;
    }

    mapping(address => bytes32) public override getForgeId;
    mapping(bytes32 => address) public override getForgeAddress;
    mapping(address => bytes32) public override getMarketFactoryId;
    mapping(bytes32 => address) public override getMarketFactoryAddress;

    // getMarket[forgeId][marketFactoryId][xyt][token]
    mapping(bytes32 => mapping(bytes32 => mapping(address => mapping(address => address))))
        public
        override getMarket;
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
    mapping(bytes32 => SortedMarkets) private markets;
    mapping(address => mapping(bytes32 => MarketInfo)) private infos;
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
        require(msg.sender == getMarketFactoryAddress[_marketFactoryId], "only market factory");
        _;
    }

    function initialize(IPendleRouter _router) external {
        require(msg.sender == initializer, "FORBIDDEN");
        require(address(_router) != address(0), "ZERO_ADDRESS");

        initializer = address(0);
        router = _router;
    }

    function setRouter(IPendleRouter _router) external override initialized onlyGovernance {
        require(address(_router) != address(0), "ZERO_ADDRESS");

        router = _router;

        emit RouterSet(address(_router));
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

    function isRelatedForgeXYT(bytes32 _forgeId, address _xyt)
        external
        view
        override
        returns (bool)
    {
        bytes32 forgeId = getForgeId[IPendleYieldToken(_xyt).forge()];
        return forgeId == _forgeId;
    }

    function isValidXYT(address _xyt) external view override returns (bool) {
        address forge = IPendleYieldToken(_xyt).forge();
        return getForgeId[forge] != bytes32(0);
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
        bytes32 _forgeId,
        bytes32 _marketFactoryId,
        address _xyt,
        address _token,
        address _market
    ) external override initialized onlyMarketFactory(_marketFactoryId) {
        allMarkets.push(_market);

        bytes32 key = _createKey(_xyt, _token);
        markets[key].markets.add(_market);

        getMarket[_forgeId][_marketFactoryId][_xyt][_token] = _market;
        isMarket[_market] = true;

        emit MarketPairAdded(_market, _xyt, _token);
    }

    function setMarketFees(uint256 _swapFee, uint256 _exitFee) external override onlyGovernance {
        swapFee = _swapFee;
        exitFee = _exitFee;
    }

    function sortMarkets(
        address[] calldata xyts,
        address[] calldata tokens,
        uint256 lengthLimit
    ) external override {
        bytes32 key;
        bytes32 indices;
        address[] memory fetchedMarkets;
        uint256[] memory effectiveLiquidity;

        for (uint256 i = 0; i < xyts.length; i++) {
            for (uint256 j = 0; j < tokens.length; j++) {
                key = _createKey(xyts[i], tokens[j]);
                fetchedMarkets = getMarketsWithLimit(
                    xyts[i],
                    tokens[j],
                    Math.min(256, lengthLimit)
                );
                effectiveLiquidity = getEffectiveLiquidityForMarkets(
                    xyts[i],
                    tokens[j],
                    fetchedMarkets
                );
                indices = _buildSortIndices(effectiveLiquidity);
                if (indices != markets[key].indices) markets[key].indices = indices;
            }
        }
    }

    function sortMarketsWithPurge(
        address[] calldata xyts,
        address[] calldata tokens,
        uint256 lengthLimit
    ) external override {
        bytes32 key;
        address[] memory fetchedMarkets;
        uint256[] memory effectiveLiquidity;
        bytes32 indices;

        for (uint256 i = 0; i < xyts.length; i++) {
            for (uint256 j = 0; j < tokens.length; j++) {
                key = _createKey(tokens[i], tokens[j]);
                fetchedMarkets = getMarketsWithLimit(
                    xyts[i],
                    tokens[j],
                    Math.min(256, lengthLimit)
                );
                effectiveLiquidity = purgeMarketsEffectiveLiquidity(
                    xyts[i],
                    tokens[j],
                    fetchedMarkets
                );
                indices = _buildSortIndices(effectiveLiquidity);
                if (indices != markets[key].indices) markets[key].indices = indices;
            }
        }
    }

    /// @dev Purge any market that aren't greater than threshold (10% of total)
    function purgeMarketsEffectiveLiquidity(
        address _xyt,
        address _token,
        address[] memory _markets
    ) public override returns (uint256[] memory effectiveLiquidity) {
        uint256 totalLiq = 0;
        bytes32 key = _createKey(_xyt, _token);

        for (uint256 i = 0; i < _markets.length; i++) {
            MarketInfo memory info = infos[_markets[i]][key];

            infos[_markets[i]][key].liquidity = Math.rdiv(
                uint256(info.xytWeight),
                uint256(info.xytWeight).add(uint256(info.tokenWeight))
            );
            infos[_markets[i]][key].liquidity = infos[_markets[i]][key].liquidity.mul(
                IPendleMarket(_markets[i]).getBalance(_token)
            );
            totalLiq = totalLiq.add(infos[_markets[i]][key].liquidity);
        }

        uint256 threshold = Math.rmul(totalLiq, ((10 * Math.FORMULA_PRECISION) / 100));

        for (uint256 i = 0; i < markets[key].markets.length(); i++) {
            if (infos[markets[key].markets.values[i]][key].liquidity < threshold) {
                markets[key].markets.remove(markets[key].markets.values[i]);
            }
        }

        effectiveLiquidity = new uint256[](markets[key].markets.length());

        for (uint256 i = 0; i < markets[key].markets.length(); i++) {
            effectiveLiquidity[i] = infos[markets[key].markets.values[i]][key].liquidity;
        }
    }

    function updateMarketInfo(
        address _xyt,
        address _token,
        address _market
    ) public override {
        bytes32 key = _createKey(_xyt, _token);
        MarketInfo memory info = infos[_market][key];

        info.xytWeight = uint80(IPendleMarket(_market).getWeight(_xyt));
        info.tokenWeight = uint80(IPendleMarket(_market).getWeight(_token));
        info.liquidity = Math.rdiv(
            uint256(info.xytWeight),
            uint256(info.xytWeight).add(uint256(info.tokenWeight))
        );

        infos[_market][key] = info;
    }

    function allMarketsLength() external view override returns (uint256) {
        return allMarkets.length;
    }

    function getAllMarkets() external view override returns (address[] memory) {
        return allMarkets;
    }

    function getBestMarkets(address source, address destination)
        external
        view
        override
        returns (address[] memory bestMarkets)
    {
        return getBestMarketsWithLimit(source, destination, 3);
    }

    function getMarketInfo(
        address market,
        address source,
        address destination
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
        bytes32 key = _createKey(source, destination);
        MarketInfo memory info = infos[market][key];
        xytWeight = info.xytWeight;
        tokenWeight = info.tokenWeight;
        liquidity = info.liquidity;
    }

    function getBestMarketsWithLimit(
        address _tokenIn,
        address _tokenOut,
        uint256 _limit
    ) public view override returns (address[] memory bestMarkets) {
        bytes32 key = _createKey(_tokenIn, _tokenOut);
        bytes32 indices = markets[key].indices;
        uint256 len = 0;
        while (indices[len] > 0 && len < Math.min(_limit, indices.length)) {
            len++;
        }

        bestMarkets = new address[](len);
        for (uint256 i = 0; i < len; i++) {
            uint256 index = uint256(uint8(indices[i])).sub(1);
            bestMarkets[i] = markets[key].markets.values[index];
        }
    }

    function getEffectiveLiquidityForMarkets(
        address _xyt,
        address _token,
        address[] memory _markets
    ) public view override returns (uint256[] memory effectiveLiquidity) {
        effectiveLiquidity = new uint256[](_markets.length);
        for (uint256 i = 0; i < _markets.length; i++) {
            bytes32 key = _createKey(_xyt, _token);
            MarketInfo memory info = infos[_markets[i]][key];
            effectiveLiquidity[i] = Math.rdiv(
                uint256(info.xytWeight),
                uint256(info.xytWeight).add(uint256(info.tokenWeight))
            );
            effectiveLiquidity[i] = effectiveLiquidity[i].mul(
                IPendleMarket(_markets[i]).getBalance(_token)
            );
        }
    }

    function getMarketsWithLimit(
        address source,
        address destination,
        uint256 limit
    ) public view override returns (address[] memory result) {
        bytes32 key = _createKey(source, destination);
        result = new address[](Math.min(limit, markets[key].markets.values.length));
        for (uint256 i = 0; i < result.length; i++) {
            result[i] = markets[key].markets.values[i];
        }
    }

    function _buildSortIndices(uint256[] memory effectiveLiquidity)
        internal
        pure
        returns (bytes32)
    {
        uint256 bestIndex;
        uint256 result = 0;
        uint256 prevEffectiveLiquidity = uint256(-1);
        for (uint256 i = 0; i < Math.min(effectiveLiquidity.length, 32); i++) {
            bestIndex = 0;
            for (uint256 j = 0; j < effectiveLiquidity.length; j++) {
                if (
                    (effectiveLiquidity[j] > effectiveLiquidity[bestIndex] &&
                        effectiveLiquidity[j] < prevEffectiveLiquidity) ||
                    effectiveLiquidity[bestIndex] >= prevEffectiveLiquidity
                ) {
                    bestIndex = j;
                }
            }
            prevEffectiveLiquidity = effectiveLiquidity[bestIndex];
            result |= (bestIndex + 1) << (248 - i * 8);
        }

        return bytes32(result);
    }

    function _createKey(address xyt, address token) internal pure returns (bytes32) {
        return
            bytes32(
                (uint256(uint128((xyt < token) ? xyt : token)) << 128) |
                    (uint256(uint128((xyt < token) ? token : xyt)))
            );
    }
}
