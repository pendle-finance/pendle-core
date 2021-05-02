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
import "../periphery/Withdrawable.sol";

contract PendleData is IPendleData, Permissions, Withdrawable {
    using SafeMath for uint256;

    // It's not guaranteed that every market factory can work with
    // every forge, so we need to check against this mapping
    mapping(bytes32 => mapping(bytes32 => bool)) public override validForgeFactoryPair;

    mapping(address => bytes32) public override getForgeId;
    mapping(bytes32 => address) public override getForgeAddress;
    mapping(address => bytes32) public override getMarketFactoryId;
    mapping(bytes32 => address) public override getMarketFactoryAddress;

    // getMarket[marketFactoryId][xyt][token]
    mapping(bytes32 => mapping(address => mapping(address => address))) public override getMarket;
    mapping(bytes32 => mapping(address => mapping(uint256 => IPendleYieldToken)))
        public
        override otTokens; // [forgeId][underlyingAsset][expiry]
    mapping(bytes32 => mapping(address => mapping(uint256 => IPendleYieldToken)))
        public
        override xytTokens; // [forgeId][underlyingAsset][expiry]

    IPendleRouter public override router;
    address public override treasury;
    mapping(address => bool) public override isMarket;
    mapping(address => bool) public override isXyt;
    mapping(bytes32 => address) private markets;
    address[] private allMarkets;

    uint256 private constant FEE_HARD_LIMIT = 109951162777; // equals to MATH.RONE / 10 = 10%

    // Parameters to be set by governance;
    uint256 public override forgeFee; // portion of interests from XYT for the protocol
    uint256 public override interestUpdateRateDeltaForMarket;
    uint256 public override interestUpdateRateDeltaForForge;
    uint256 public override expiryDivisor = 1 days;
    uint256 public override swapFee;
    uint256 public override exitFee;
    uint256 public override protocolSwapFee; // as a portion of swapFee
    // lock duration = duration * lockNumerator / lockDenominator
    uint256 public override lockNumerator;
    uint256 public override lockDenominator;
    uint256 public override curveShiftBlockDelta;

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

    function setInterestUpdateRateDeltaForMarket(uint256 _interestUpdateRateDeltaForMarket)
        external
        override
        initialized
        onlyGovernance
    {
        interestUpdateRateDeltaForMarket = _interestUpdateRateDeltaForMarket;
        emit InterestUpdateRateDeltaForMarketSet(_interestUpdateRateDeltaForMarket);
    }

    function setInterestUpdateRateDeltaForForge(uint256 _interestUpdateRateDeltaForForge)
        external
        override
        initialized
        onlyGovernance
    {
        interestUpdateRateDeltaForForge = _interestUpdateRateDeltaForForge;
        emit InterestUpdateRateDeltaForForgeSet(_interestUpdateRateDeltaForForge);
    }

    function setLockParams(uint256 _lockNumerator, uint256 _lockDenominator)
        external
        override
        initialized
        onlyGovernance
    {
        require(0 < _lockNumerator && _lockNumerator < _lockDenominator, "INVALID_LOCK_PARAMS");
        lockNumerator = _lockNumerator;
        lockDenominator = _lockDenominator;
        emit LockParamsSet(_lockNumerator, _lockDenominator);
    }

    function setExpiryDivisor(uint256 _expiryDivisor)
        external
        override
        initialized
        onlyGovernance
    {
        require(0 < _expiryDivisor, "INVALID_EXPIRY_DIVISOR");
        expiryDivisor = _expiryDivisor;
        emit ExpiryDivisorSet(_expiryDivisor);
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
        isXyt[_xyt] = true;
    }

    function setForgeFee(uint256 _forgeFee) external override onlyGovernance {
        require(_forgeFee <= FEE_HARD_LIMIT, "FEE_EXCEED_LIMIT");
        forgeFee = _forgeFee;
        emit ForgeFeeSet(_forgeFee);
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

    function setForgeFactoryValidity(
        bytes32 _forgeId,
        bytes32 _marketFactoryId,
        bool _valid
    ) external override initialized onlyGovernance {
        validForgeFactoryPair[_forgeId][_marketFactoryId] = _valid;
        emit ForgeFactoryValiditySet(_forgeId, _marketFactoryId, _valid);
    }

    function setMarketFees(
        uint256 _swapFee,
        uint256 _exitFee,
        uint256 _protocolSwapFee
    ) external override onlyGovernance {
        require(_swapFee <= FEE_HARD_LIMIT && _exitFee <= FEE_HARD_LIMIT, "FEE_EXCEED_LIMIT");
        require(_protocolSwapFee < Math.RONE, "PROTOCOL_FEE_EXCEED_LIMIT");
        swapFee = _swapFee;
        exitFee = _exitFee;
        protocolSwapFee = _protocolSwapFee;
        emit MarketFeesSet(_swapFee, _exitFee, _protocolSwapFee);
    }

    function setCurveShiftBlockDelta(uint256 _blockDelta) external override onlyGovernance {
        curveShiftBlockDelta = _blockDelta;
        emit CurveShiftBlockDeltaSet(_blockDelta);
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
