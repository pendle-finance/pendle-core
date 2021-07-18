// SPDX-License-Identifier: BUSL-1.1
// solhint-disable ordering
pragma solidity 0.7.6;
pragma abicoder v2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../../interfaces/IUniswapV2Pair.sol";
import "../../interfaces/IPendleGenOneForge.sol";
import "../abstractV2/PendleForgeBaseV2.sol";
import "../../libraries/UniswapV2Lib.sol";

/*
 * Most of the calculation logic of this contract is the same as CompoundV2
 */
contract PendleUniswapV2Forge is PendleForgeBaseV2, IPendleGenOneForge {
    using SafeMath for uint256;
    using Math for uint256;

    mapping(address => mapping(uint256 => uint256)) public lastRateBeforeExpiry;
    mapping(address => mapping(uint256 => mapping(address => uint256))) public lastRate;
    bytes private constant CODE_HASH =
        hex"96e8ac4277198ff8b6f785478aa9a39f403cb768dd02cbee326c3e7da348845f";

    constructor(
        address _governanceManager,
        IPendleRouter _router,
        bytes32 _forgeId,
        address _rewardToken,
        address _rewardManager,
        address _yieldContractDeployer
    )
        PendleForgeBaseV2(
            _governanceManager,
            _router,
            _forgeId,
            _rewardToken,
            _rewardManager,
            _yieldContractDeployer
        )
    {}

    /**
    @dev the logic of verifying tokens is the same as Uniswap
    */
    function verifyToken(address _underlyingAsset, uint256[] calldata _tokenInfo)
        public
        virtual
        override
    {
        // in the case of Uniswap, _underlyingAsset == tokenAddr
        require(_tokenInfo.length == 0, "INVALID_TOKEN_INFO");
        IUniswapV2Pair pair = IUniswapV2Pair(_underlyingAsset);
        address poolAddr = UniswapV2Library.pairFor(
            pair.factory(),
            pair.token0(),
            pair.token1(),
            CODE_HASH
        );
        require(poolAddr == _underlyingAsset, "INVALID_TOKEN_ADDR");
    }

    /**
    @dev for the logic of the exchangeRate, please refer to the specs
    */
    function getExchangeRate(address _underlyingAsset)
        public
        view
        override
        returns (uint256 rate)
    {
        (uint256 reserve0, uint256 reserve1, ) = IUniswapV2Pair(_underlyingAsset).getReserves();

        uint256 currentK = Math.sqrt(reserve0.mul(reserve1));
        uint256 totalSupply = IUniswapV2Pair(_underlyingAsset).totalSupply();
        rate = currentK.rdiv(totalSupply);
    }

    /**
    @dev for Uniswap, the yieldBearingToken of an asset is itself
    */
    function getYieldBearingToken(address _underlyingAsset)
        public
        view
        override(IPendleForge, PendleForgeBaseV2)
        returns (address)
    {
        require(tokenInfo[_underlyingAsset].registered, "INVALID_UNDERLYING_ASSET");
        return _underlyingAsset;
    }

    function _calcTotalAfterExpiry(
        address _underlyingAsset,
        uint256 _expiry,
        uint256 _redeemedAmount
    ) internal view override returns (uint256 totalAfterExpiry) {
        totalAfterExpiry = _redeemedAmount.rdiv(lastRateBeforeExpiry[_underlyingAsset][_expiry]);
    }

    function getExchangeRateBeforeExpiry(address _underlyingAsset, uint256 _expiry)
        internal
        returns (uint256)
    {
        if (block.timestamp > _expiry) {
            return lastRateBeforeExpiry[_underlyingAsset][_expiry];
        }
        uint256 exchangeRate = getExchangeRate(_underlyingAsset);

        lastRateBeforeExpiry[_underlyingAsset][_expiry] = exchangeRate;
        return exchangeRate;
    }

    function _calcUnderlyingToRedeem(address _underlyingAsset, uint256 _amountToRedeem)
        internal
        view
        override
        returns (uint256 underlyingToRedeem)
    {
        underlyingToRedeem = _amountToRedeem.rdiv(getExchangeRate(_underlyingAsset));
    }

    function _calcAmountToMint(address _underlyingAsset, uint256 _amountToTokenize)
        internal
        view
        override
        returns (uint256 amountToMint)
    {
        amountToMint = _amountToTokenize.rmul(getExchangeRate(_underlyingAsset));
    }

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

    function _updateForgeFee(
        address _underlyingAsset,
        uint256 _expiry,
        uint256 _feeAmount
    ) internal override {
        totalFee[_underlyingAsset][_expiry] = totalFee[_underlyingAsset][_expiry].add(_feeAmount);
    }
}
