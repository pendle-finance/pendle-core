// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.7.6;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../libraries/MathLib.sol";
import "../interfaces/IPendleData.sol";
import "../interfaces/IPendleForge.sol";
import "../interfaces/IPendleMarket.sol";
import "../interfaces/IPendleMarketFactory.sol";
import "../interfaces/IPendlePausingManager.sol";
import "../periphery/PermissionsV2.sol";

contract PendleData is IPendleData, PermissionsV2 {
    using SafeMath for uint256;

    // It's not guaranteed that every market factory can work with
    // every forge, so we need to check against this mapping
    mapping(bytes32 => mapping(bytes32 => bool)) public override validForgeFactoryPair;

    mapping(bytes32 => address) public override getForgeAddress;
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
    IPendlePausingManager public immutable override pausingManager;
    address public override treasury;
    mapping(address => bool) public override isMarket;
    mapping(address => bool) public override isXyt;
    mapping(bytes32 => address) private markets;
    address[] public allMarkets;

    uint256 private constant FEE_HARD_LIMIT = 109951162777; // equals to MATH.RONE / 10 = 10%
    uint256 private constant FORGE_FEE_HARD_LIMIT = 219902325555; // equals to MATH.RONE / 5 = 20%

    // Parameters to be set by governance;
    uint256 public override forgeFee; // portion of interests from XYT for the protocol
    uint256 public override interestUpdateRateDeltaForMarket;
    uint256 public override expiryDivisor = 1 days;
    uint256 public override swapFee;
    uint256 public override protocolSwapFee; // as a portion of swapFee
    // lock duration = duration * lockNumerator / lockDenominator
    uint256 public override lockNumerator;
    uint256 public override lockDenominator;
    uint256 public override curveShiftBlockDelta;

    constructor(
        address _governanceManager,
        address _treasury,
        address _pausingManager
    ) PermissionsV2(_governanceManager) {
        require(_treasury != address(0), "ZERO_ADDRESS");
        treasury = _treasury;
        pausingManager = IPendlePausingManager(_pausingManager);
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

    function setLockParams(uint256 _lockNumerator, uint256 _lockDenominator)
        external
        override
        initialized
        onlyGovernance
    {
        // => _lockDenominator > 0 since _lockNumerator >=0
        require(_lockNumerator < _lockDenominator, "INVALID_LOCK_PARAMS");
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

    /**
     * @notice add forge by _forgeId & _forgeAddress
     Conditions:
     * Only governance can call it. Hence no Reentrancy protection is needed
     **/
    function addForge(bytes32 _forgeId, address _forgeAddress)
        external
        override
        initialized
        onlyGovernance
    {
        require(_forgeId != bytes32(0), "ZERO_BYTES");
        require(_forgeAddress != address(0), "ZERO_ADDRESS");
        require(_forgeId == IPendleForge(_forgeAddress).forgeId(), "INVALID_ID");
        require(getForgeAddress[_forgeId] == address(0), "EXISTED_ID");

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

    function setForgeFee(uint256 _forgeFee) external override initialized onlyGovernance {
        require(_forgeFee <= FORGE_FEE_HARD_LIMIT, "FEE_EXCEED_LIMIT");
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
        bytes32 _forgeId,
        address _underlyingAsset,
        uint256 _expiry
    ) external view override returns (bool) {
        return address(xytTokens[_forgeId][_underlyingAsset][_expiry]) != address(0);
    }

    function isValidOT(
        bytes32 _forgeId,
        address _underlyingAsset,
        uint256 _expiry
    ) external view override returns (bool) {
        return address(otTokens[_forgeId][_underlyingAsset][_expiry]) != address(0);
    }

    /***********
     *  MARKET *
     ***********/

    /**
     * @notice add marketFactory by _marketFactoryId & _marketFactoryAddress
     * @dev A market factory can work with XYTs from one or more Forges,
          to be determined by data.validForgeFactoryPair mapping
     Conditions:
     * Only governance can call it. Hence no Reentrancy protection is needed
     **/
    function addMarketFactory(bytes32 _marketFactoryId, address _marketFactoryAddress)
        external
        override
        initialized
        onlyGovernance
    {
        require(_marketFactoryId != bytes32(0), "ZERO_BYTES");
        require(_marketFactoryAddress != address(0), "ZERO_ADDRESS");
        require(
            _marketFactoryId == IPendleMarketFactory(_marketFactoryAddress).marketFactoryId(),
            "INVALID_FACTORY_ID"
        );
        require(getMarketFactoryAddress[_marketFactoryId] == address(0), "EXISTED_ID");

        getMarketFactoryAddress[_marketFactoryId] = _marketFactoryAddress;

        emit NewMarketFactory(_marketFactoryId, _marketFactoryAddress);
    }

    function addMarket(
        bytes32 _marketFactoryId,
        address _xyt,
        address _token,
        address _market
    ) external override initialized onlyMarketFactory(_marketFactoryId) {
        allMarkets.push(_market);

        bytes32 key = _createKey(_xyt, _token, _marketFactoryId);
        require(markets[key] == address(0), "MARKET_KEY_EXISTED");
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

    function setMarketFees(uint256 _swapFee, uint256 _protocolSwapFee)
        external
        override
        initialized
        onlyGovernance
    {
        require(_swapFee <= FEE_HARD_LIMIT, "FEE_EXCEED_LIMIT");
        require(_protocolSwapFee <= Math.RONE, "PROTOCOL_FEE_EXCEED_LIMIT");
        swapFee = _swapFee;
        protocolSwapFee = _protocolSwapFee;
        emit MarketFeesSet(_swapFee, _protocolSwapFee);
    }

    function setCurveShiftBlockDelta(uint256 _blockDelta)
        external
        override
        initialized
        onlyGovernance
    {
        curveShiftBlockDelta = _blockDelta;
        emit CurveShiftBlockDeltaSet(_blockDelta);
    }

    function allMarketsLength() external view override returns (uint256) {
        return allMarkets.length;
    }

    function getMarketByIndex(uint256 index) external view override returns (address market) {
        require(index + 1 <= allMarkets.length, "INVALID_INDEX");
        market = allMarkets[index];
    }

    function getMarketFromKey(
        address _tokenIn,
        address _tokenOut,
        bytes32 _marketFactoryId
    ) public view override returns (address market) {
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
