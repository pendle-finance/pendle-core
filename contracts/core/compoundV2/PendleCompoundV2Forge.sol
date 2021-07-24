// SPDX-License-Identifier: BUSL-1.1
// solhint-disable ordering
pragma solidity 0.7.6;
pragma abicoder v2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../../interfaces/IPendleGenericForge.sol";
import "../abstractV2/PendleForgeBaseV2.sol";
import "../../interfaces/IComptroller.sol";
import "../../interfaces/ICToken.sol";

/*
- For this Forge, the container of each underlyingAsset will contain only the address of its
corresponding cToken
*/
contract PendleCompoundV2Forge is PendleForgeBaseV2, IPendleGenericForge {
    using SafeMath for uint256;
    using Math for uint256;

    IComptroller public immutable comptroller;
    mapping(address => mapping(uint256 => uint256)) public lastRateBeforeExpiry;
    mapping(address => mapping(uint256 => mapping(address => uint256))) public lastRate;

    constructor(
        address _governanceManager,
        IPendleRouter _router,
        IComptroller _comptroller,
        bytes32 _forgeId,
        address _rewardToken,
        address _rewardManager,
        address _yieldContractDeployer,
        address _coumpoundEth
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
        require(address(_comptroller) != address(0), "ZERO_ADDRESS");

        comptroller = _comptroller;

        // Pre-register for cEther
        address weth = address(_router.weth());
        tokenInfo[weth].registered = true;
        tokenInfo[weth].container = new uint256[](1);
        tokenInfo[weth].container[0] = uint256(_coumpoundEth);
    }

    /// @inheritdoc PendleForgeBaseV2
    function verifyToken(address _underlyingAsset, uint256[] calldata _tokenInfo)
        public
        virtual
        override
    {
        require(_tokenInfo.length == 1, "INVALID_TOKEN_INFO");
        address cTokenAddr = address(_tokenInfo[0]);
        require(
            comptroller.markets(cTokenAddr).isListed &&
                ICToken(cTokenAddr).isCToken() &&
                ICToken(cTokenAddr).underlying() == _underlyingAsset,
            "INVALID_TOKEN_INFO"
        );
    }

    function getExchangeRate(address _underlyingAsset) public override returns (uint256 rate) {
        address cTokenAddr = address(tokenInfo[_underlyingAsset].container[0]);
        return ICToken(cTokenAddr).exchangeRateCurrent();
    }

    /// @inheritdoc PendleForgeBaseV2
    function getYieldBearingToken(address _underlyingAsset)
        public
        view
        override(IPendleForge, PendleForgeBaseV2)
        returns (address)
    {
        require(tokenInfo[_underlyingAsset].registered, "INVALID_UNDERLYING_ASSET");
        address cTokenAddr = address(tokenInfo[_underlyingAsset].container[0]);
        return cTokenAddr;
    }

    /// @inheritdoc PendleForgeBaseV2
    function _calcTotalAfterExpiry(
        address _underlyingAsset,
        uint256 _expiry,
        uint256 _redeemedAmount
    ) internal view override returns (uint256 totalAfterExpiry) {
        totalAfterExpiry = _redeemedAmount.rdiv(lastRateBeforeExpiry[_underlyingAsset][_expiry]);
    }

    /**
    @dev this function serves functions that take into account the lastRateBeforeExpiry
    Else, call getExchangeRate instead
    */
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

    /// @inheritdoc PendleForgeBaseV2
    function _calcUnderlyingToRedeem(address _underlyingAsset, uint256 _amountToRedeem)
        internal
        override
        returns (uint256 underlyingToRedeem)
    {
        underlyingToRedeem = _amountToRedeem.rdiv(getExchangeRate(_underlyingAsset));
    }

    /// @inheritdoc PendleForgeBaseV2
    function _calcAmountToMint(address _underlyingAsset, uint256 _amountToTokenize)
        internal
        override
        returns (uint256 amountToMint)
    {
        amountToMint = _amountToTokenize.rmul(getExchangeRate(_underlyingAsset));
    }

    /**
    @dev no compound interest like AaveForge
    @dev Since there is no compound effect, we don't need to calc the compound interest of the XYT
    after it has expired like Aave, and also we don't need to update the dueInterest
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
    @dev different from AaveForge, here there is no compound interest occurred because the amount
    of cToken always remains unchanged, so just add the _feeAmount in
    */
    function _updateForgeFee(
        address _underlyingAsset,
        uint256 _expiry,
        uint256 _feeAmount
    ) internal override {
        totalFee[_underlyingAsset][_expiry] = totalFee[_underlyingAsset][_expiry].add(_feeAmount);
    }
}
