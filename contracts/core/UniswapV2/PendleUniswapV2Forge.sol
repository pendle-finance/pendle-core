// SPDX-License-Identifier: BUSL-1.1
// solhint-disable ordering
pragma solidity 0.7.6;
pragma abicoder v2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../../interfaces/IUniswapV2Pair.sol";
import "../../interfaces/IPendleGenericForge.sol";
import "../abstractV2/PendleForgeBaseV2.sol";
import "../../libraries/UniswapV2Lib.sol";

/*
- For UniswapV2, the container of each underlyingAsset will be empty
*/
contract PendleUniswapV2Forge is PendleForgeBaseV2, IPendleGenericForge {
    using SafeMath for uint256;
    using Math for uint256;

    mapping(address => uint256) public lastRateForUnderlyingAsset;
    mapping(address => mapping(uint256 => uint256)) public lastRateBeforeExpiry;
    mapping(address => mapping(uint256 => mapping(address => uint256))) public lastRate;
    bytes32 public immutable codeHash;
    address public immutable pairFactory;

    constructor(
        address _governanceManager,
        IPendleRouter _router,
        bytes32 _forgeId,
        address _rewardToken,
        address _rewardManager,
        address _yieldContractDeployer,
        bytes32 _codeHash,
        address _pairFactory
    )
        PendleForgeBaseV2(
            _governanceManager,
            _router,
            _forgeId,
            _rewardToken,
            _rewardManager,
            _yieldContractDeployer
        )
    {
        codeHash = _codeHash;
        pairFactory = _pairFactory;
    }

    /**
    @dev the logic of verifying tokens is the same as how Uniswap does it
    */
    function verifyToken(address _underlyingAsset, uint256[] calldata _tokenInfo)
        public
        virtual
        override
    {
        // in the case of Uniswap, _underlyingAsset == tokenAddr
        require(
            _tokenInfo.length == 1 && address(_tokenInfo[0]) == _underlyingAsset,
            "INVALID_TOKEN_INFO"
        );

        IUniswapV2Pair pair = IUniswapV2Pair(_underlyingAsset);
        address poolAddr = UniswapV2Library.pairFor(
            pairFactory,
            pair.token0(),
            pair.token1(),
            codeHash
        );
        require(poolAddr == _underlyingAsset, "INVALID_TOKEN_ADDR");
    }

    /**
    @dev please refer to the specs
    */
    function getExchangeRate(address _underlyingAsset) public override returns (uint256 rate) {
        (uint256 reserve0, uint256 reserve1, ) = IUniswapV2Pair(_underlyingAsset).getReserves();

        uint256 currentK = Math.sqrt(reserve0.mul(reserve1));
        uint256 totalSupply = IUniswapV2Pair(_underlyingAsset).totalSupply();
        rate = Math.max(currentK.rdiv(totalSupply), lastRateForUnderlyingAsset[_underlyingAsset]);
        lastRateForUnderlyingAsset[_underlyingAsset] = rate;
    }

    /**
    @dev for Uniswap, the yieldBearingToken of an asset is itself
    */
    function getYieldBearingToken(address _underlyingAsset)
        public
        view
        override(IPendleForge, PendleForgeBaseV2)
        returns (address yieldBearingToken)
    {
        require(tokenInfo[_underlyingAsset].registered, "INVALID_UNDERLYING_ASSET");
        return _underlyingAsset;
    }

    /**
    @dev please refer to the specs
    */
    function _calcTotalAfterExpiry(
        address _underlyingAsset,
        uint256 _expiry,
        uint256 _redeemedAmount
    ) internal view override returns (uint256 totalAfterExpiry) {
        totalAfterExpiry = _redeemedAmount.rdiv(lastRateBeforeExpiry[_underlyingAsset][_expiry]);
    }

    function getExchangeRateBeforeExpiry(address _underlyingAsset, uint256 _expiry)
        internal
        returns (uint256 exchangeRate)
    {
        if (block.timestamp > _expiry) {
            return lastRateBeforeExpiry[_underlyingAsset][_expiry];
        }
        exchangeRate = getExchangeRate(_underlyingAsset);

        lastRateBeforeExpiry[_underlyingAsset][_expiry] = exchangeRate;
    }

    /**
    @dev please refer to the specs
    */
    function _calcUnderlyingToRedeem(address _underlyingAsset, uint256 _amountToRedeem)
        internal
        override
        returns (uint256 underlyingToRedeem)
    {
        underlyingToRedeem = _amountToRedeem.rdiv(getExchangeRate(_underlyingAsset));
    }

    /**
    @dev please refer to the specs
    */
    function _calcAmountToMint(address _underlyingAsset, uint256 _amountToTokenize)
        internal
        override
        returns (uint256 amountToMint)
    {
        amountToMint = _amountToTokenize.rmul(getExchangeRate(_underlyingAsset));
    }

    /**
    @dev please refer to the specs
    */
    function _updateDueInterests(
        uint256 _principal,
        address _underlyingAsset,
        uint256 _expiry,
        address _user
    ) internal override {
        uint256 prevRate = lastRate[_underlyingAsset][_expiry][_user];
        uint256 currentRate = getExchangeRateBeforeExpiry(_underlyingAsset, _expiry);

        lastRate[_underlyingAsset][_expiry][_user] = currentRate;
        // first time getting XYT, or there is no update in exchangeRate
        if (prevRate == 0 || prevRate == currentRate) {
            return;
        }

        uint256 interestFromXyt = _principal.mul(currentRate.sub(prevRate)).rdiv(
            prevRate.mul(currentRate)
        );

        dueInterests[_underlyingAsset][_expiry][_user] = dueInterests[_underlyingAsset][_expiry][
            _user
        ]
        .add(interestFromXyt);
    }

    /**
    @dev please refer to the specs
    */
    function _updateForgeFee(
        address _underlyingAsset,
        uint256 _expiry,
        uint256 _feeAmount
    ) internal override {
        totalFee[_underlyingAsset][_expiry] = totalFee[_underlyingAsset][_expiry].add(_feeAmount);
    }
}
