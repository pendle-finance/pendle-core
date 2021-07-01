// SPDX-License-Identifier: BUSL-1.1
// solhint-disable ordering
pragma solidity 0.7.6;
pragma abicoder v2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../../interfaces/IUniswapV2Pair.sol";
import "../../interfaces/IPendleUniswapV2Forge.sol";
import "../abstractV2/PendleForgeBaseV2.sol";

contract PendleUniswapV2Forge is PendleForgeBaseV2, IPendleUniswapV2Forge {
    using SafeMath for uint256;
    using Math for uint256;

    struct TokenInfo {
        bool registered;
        uint256[] container;
    }

    mapping(address => TokenInfo) public tokenInfo;
    mapping(address => mapping(uint256 => uint256)) public lastRateBeforeExpiry;
    mapping(address => mapping(uint256 => mapping(address => uint256))) public lastRate;

    event RegisterUTokens(address[] uTokens);

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

    /// For Uniswap LP we have to register each LP token manually
    function registerUTokens(address[] calldata _tokenAddrs, uint256[][] calldata _tokenInfos)
        external
        virtual
        onlyGovernance
    {
        require(_tokenAddrs.length == _tokenInfos.length, "LENGTH_MISMATCH");
        for (uint256 i = 0; i < _tokenAddrs.length; ++i) {
            TokenInfo storage info = tokenInfo[_tokenAddrs[i]];
            require(!info.registered, "EXISTED_UTOKENS");
            // verifyCToken(_underlyingAssets[i], _cTokens[i]); // TODO
            info.registered = true;
            info.container = _tokenInfos[i];
        }
        emit RegisterUTokens(_tokenAddrs);
    }

    function _calcTotalAfterExpiry(
        address _underlyingAsset,
        uint256 _expiry,
        uint256 redeemedAmount
    ) internal view override returns (uint256 totalAfterExpiry) {
        totalAfterExpiry = redeemedAmount.div(lastRateBeforeExpiry[_underlyingAsset][_expiry]);
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

    function _calcUnderlyingToRedeem(address _underlyingAsset, uint256 _amountToRedeem)
        internal
        view
        override
        returns (uint256 underlyingToRedeem)
    {
        underlyingToRedeem = _amountToRedeem.div(getExchangeRate(_underlyingAsset));
    }

    function _calcAmountToMint(address _underlyingAsset, uint256 _amountToTokenize)
        internal
        view
        override
        returns (uint256 amountToMint)
    {
        amountToMint = _amountToTokenize.mul(getExchangeRate(_underlyingAsset));
    }

    function getYieldBearingToken(address _underlyingAsset)
        public
        view
        override(IPendleForge, PendleForgeBaseV2)
        returns (address)
    {
        require(tokenInfo[_underlyingAsset].registered, "INVALID_UNDERLYING_ASSET");
        return _underlyingAsset;
    }

    function getOptContainer(address _underlyingAsset)
        public
        view
        override
        returns (uint256[] memory)
    {
        require(tokenInfo[_underlyingAsset].registered, "INVALID_UNDERLYING_ASSET");
        return tokenInfo[_underlyingAsset].container;
    }

    function _updateDueInterests(
        uint256 principal,
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

        uint256 interestFromXyt =
            principal.mul(currentRate.sub(prevRate)).div(prevRate.mul(currentRate));

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
