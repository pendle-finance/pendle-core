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


import "@openzeppelin/contracts/math/Math.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/EnumerableSet.sol";
import "../interfaces/IBenchmarkData.sol";
import "../interfaces/IBenchmarkMarketFactory.sol";
import "../periphery/Permissions.sol";

contract BenchmarkData is IBenchmarkData, Permissions {
    using SafeMath for uint256;
    using EnumerableSet for EnumerableSet.AddressSet;

    struct MarketInfo {
        uint80 xytWeight;
        uint80 tokenWeight;
        uint256 liquidity;
    }

    struct SortedMarkets {
        EnumerableSet.AddressSet markets;
        bytes32 indices;
    }

    mapping(address => bytes32) public override getForgeId;
    mapping(bytes32 => mapping(bytes32 => address)) public override getMarketFactoryAddress;
    mapping(bytes32 => address) public override getForgeAddress;

    // getMarket[forgeId][marketFactoryId][xyt][token]
    mapping(bytes32 => mapping(bytes32 => mapping(address => mapping(address => address))))
        public
        override getMarket;
    mapping(bytes32 => mapping(address => mapping(uint256 => IBenchmarkYieldToken)))
        public
        override otTokens;
    mapping(bytes32 => mapping(address => mapping(uint256 => IBenchmarkYieldToken)))
        public
        override xytTokens;
    uint256 public override swapFee;
    uint256 public override exitFee;
    IBenchmark public override core;
    mapping(address => bool) internal isMarket;
    mapping(bytes32 => SortedMarkets) private markets;
    mapping(address => mapping(bytes32 => MarketInfo)) private infos;
    address[] private allMarkets;

    constructor(address _governance) Permissions(_governance) {}

    modifier onlyCore() {
        require(msg.sender == address(core), "Benchmark: only core");
        _;
    }

    modifier onlyForge(bytes32 _forgeId) {
        require(getForgeAddress[_forgeId] == msg.sender, "Benchmark: only forge");
        _;
    }

    modifier onlyMarketFactory(bytes32 _forgeId, bytes32 _marketFactoryId) {
        require(
            msg.sender == getMarketFactoryAddress[_forgeId][_marketFactoryId],
            "Benchmark: only market factory"
        );
        _;
    }

    function initialize(IBenchmark _core) external {
        require(msg.sender == initializer, "Benchmark: forbidden");
        require(address(_core) != address(0), "Benchmark: zero address");

        initializer = address(0);
        core = _core;
    }

    function setCore(IBenchmark _core) external override initialized onlyGovernance {
        require(address(_core) != address(0), "Benchmark: zero address");

        core = _core;

        emit CoreSet(address(_core));
    }

    /**********
     *  FORGE *
     **********/

    function addForge(bytes32 _forgeId, address _forgeAddress)
        external
        override
        initialized
        onlyCore
    {
        getForgeId[_forgeAddress] = _forgeId;
        getForgeAddress[_forgeId] = _forgeAddress;

        emit ForgeAdded(_forgeId, _forgeAddress);
    }

    function removeForge(bytes32 _forgeId) external override initialized onlyCore {
        address _forgeAddress = getForgeAddress[_forgeId];

        getForgeAddress[_forgeId] = address(0);
        getForgeId[_forgeAddress] = _forgeId;

        emit ForgeRemoved(_forgeId, _forgeAddress);
    }

    function storeTokens(
        bytes32 _forgeId,
        address _ot,
        address _xyt,
        address _underlyingAsset,
        uint256 _expiry
    ) external override initialized onlyForge(_forgeId) {
        otTokens[_forgeId][_underlyingAsset][_expiry] = IBenchmarkYieldToken(_ot);
        xytTokens[_forgeId][_underlyingAsset][_expiry] = IBenchmarkYieldToken(_xyt);
    }

    function getBenchmarkYieldTokens(
        bytes32 _forgeId,
        address _underlyingAsset,
        uint256 _expiry
    ) external view override returns (IBenchmarkYieldToken ot, IBenchmarkYieldToken xyt) {
        ot = otTokens[_forgeId][_underlyingAsset][_expiry];
        xyt = xytTokens[_forgeId][_underlyingAsset][_expiry];
    }

    function isValidXYT(address _xyt) external view override returns (bool) {
        address forge = IBenchmarkYieldToken(_xyt).forge();
        return getForgeId[forge] != bytes32(0);
    }

    /***********
     *  MARKET *
     ***********/
    function addMarketFactory(
        bytes32 forgeId,
        bytes32 marketFactoryId,
        address _marketFactoryAddress
    ) external override initialized onlyCore {
        getMarketFactoryAddress[forgeId][marketFactoryId] = _marketFactoryAddress;
    }

    function addMarket(
        bytes32 forgeId,
        bytes32 marketFactoryId,
        address _market,
        address _xyt,
        address _token
    ) external override initialized onlyMarketFactory(forgeId, marketFactoryId) {
        allMarkets.push(_market);

        bytes32 key = _createKey(_xyt, _token);
        markets[key].markets.add(_market);

        infos[_market][key] = MarketInfo({
            xytWeight: uint80(IBenchmarkMarket(_market).getDenormalizedWeight(_xyt)),
            tokenWeight: uint80(IBenchmarkMarket(_market).getDenormalizedWeight(_token)),
            liq: uint256(0)
        });

        emit MarketPairAdded(_market, _xyt, _token);
    }

    function setMarketFees(uint256 _swapFee, uint256 _exitFee) external override onlyGovernance {
        swapFee = _swapFee;
        exitFee = _exitFee;
    }

     function sortMarkets(address[] calldata xyts, address[] calldata tokens, uint256 lengthLimit) external {
        for (uint i = 0; i < xyts.length; i++) {
            for (uint j = 0; j < tokens.length; j++) {

            }
        }
    }

    function sortMarketsWithPurge(address[] calldata xyts, address[] calldata tokens, uint256 lengthLimit) external {
        for (uint i = 0; i < xyts.length; i++) {
            for (uint j = 0; j < tokens.length; j++) {

            }
        }
    }

    function storeMarket(
        bytes32 _forgeId,
        bytes32 _marketFactoryId,
        address _xyt,
        address _token,
        address _market
    ) external override initialized onlyMarketFactory(_forgeId, _marketFactoryId) {
        getMarket[_forgeId][_marketFactoryId][_xyt][_token] = _market;
        isMarket[_market] = true;
    }

    function allMarketsLength() external view override returns (uint256) {
        return allMarkets.length;
    }

    function getAllMarkets() public view override returns (address[] memory) {
        return allMarkets;
    }

    function getMarketInfo(address market, address source, address destination)
        external view returns(uint256 xytWeight, uint256 tokenWeight)
    {
        bytes32 key = _createKey(source, destination);
        MarketInfo memory info = infos[market][key];
        return (info.xytWeight, info.tokenWeight);
    }

    function getMarketsWithLimit(address source, address destination, uint256 offset, uint256 limit)
        public view returns(address[] memory result)
    {
        bytes32 key = _createKey(source, destination);
        result = new address[](Math.min(limit, allMarkets[key].markets.values.length - offset));
        for (uint i = 0; i < result.length; i++) {
            result[i] = allMarkets[key].markets.values[offset + i];
        }
    }

    function getBestMarkets(address source, address destination)
        external view returns(address[] memory markets)
    {
        return getBestMarketsWithLimit(source, destination, 32);
    }

    function getBestMarketsWithLimit(address source, address destination, uint256 limit)
        public view returns(address[] memory markets)
    {
        bytes32 key = _createKey(source, destination);
        bytes32 indices = allMarkets[key].indices;
        uint256 len = 0;
        while (indices[len] > 0 && len < Math.min(limit, indices.length)) {
            len++;
        }

        markets = new address[](len);
        for (uint i = 0; i < len; i++) {
            uint256 index = uint256(uint8(indices[i])).sub(1);
            markets[i] = allMarkets[key].pools.values[index];
        }
    }

    function _createKey(address xyt, address token)
        internal pure returns(bytes32)
    {
        return bytes32(
            (uint256(uint128((xyt < token) ? xyt : token)) << 128) |
            (uint256(uint128((xyt < token) ? token : xyt)))
        );
    }
}
