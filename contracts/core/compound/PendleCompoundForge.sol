// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.7.6;
pragma abicoder v2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../../interfaces/ICToken.sol";
import "../../interfaces/IPendleCompoundForge.sol";
import "../../interfaces/IComptroller.sol";
import "./../abstract/PendleForgeBase.sol";

contract PendleCompoundForge is PendleForgeBase, IPendleCompoundForge {
    using ExpiryUtils for string;
    using SafeMath for uint256;
    using Math for uint256;

    IComptroller public immutable comptroller;

    mapping(address => uint256) public initialRate;
    mapping(address => address) public underlyingToCToken;
    mapping(address => mapping(uint256 => uint256)) public lastRateBeforeExpiry;
    mapping(address => mapping(uint256 => mapping(address => uint256))) public lastRate;

    event RegisterCTokens(address[] underlyingAssets, address[] cTokens);

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
        PendleForgeBase(
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
        underlyingToCToken[weth] = _coumpoundEth;
        initialRate[weth] = ICToken(_coumpoundEth).exchangeRateCurrent();
    }

    /// For Compound we can't get the address of cToken directly, so we need to register it manually
    function registerCTokens(address[] calldata _underlyingAssets, address[] calldata _cTokens)
        external
        onlyGovernance
    {
        require(_underlyingAssets.length == _cTokens.length, "LENGTH_MISMATCH");

        for (uint256 i = 0; i < _cTokens.length; ++i) {
            // once the underlying CToken has been set, it cannot be changed
            require(underlyingToCToken[_underlyingAssets[i]] == address(0), "FORBIDDEN");
            verifyCToken(_underlyingAssets[i], _cTokens[i]);
            underlyingToCToken[_underlyingAssets[i]] = _cTokens[i];
            initialRate[_underlyingAssets[i]] = ICToken(_cTokens[i]).exchangeRateCurrent();
        }

        emit RegisterCTokens(_underlyingAssets, _cTokens);
    }

    /// Use to verify the validity of a cToken. The logic of this function is similar to how Compound verify an address is cToken
    function verifyCToken(address _underlyingAsset, address _cTokenAddress) internal {
        require(
            comptroller.markets(_cTokenAddress).isListed &&
                ICToken(_cTokenAddress).isCToken() &&
                ICToken(_cTokenAddress).underlying() == _underlyingAsset,
            "INVALID_CTOKEN_DATA"
        );
    }

    /// @inheritdoc PendleForgeBase
    function _calcTotalAfterExpiry(
        address _underlyingAsset,
        uint256 _expiry,
        uint256 redeemedAmount
    ) internal view override returns (uint256 totalAfterExpiry) {
        totalAfterExpiry = redeemedAmount.mul(initialRate[_underlyingAsset]).div(
            lastRateBeforeExpiry[_underlyingAsset][_expiry]
        );
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
        uint256 exchangeRate = ICToken(underlyingToCToken[_underlyingAsset]).exchangeRateCurrent();

        lastRateBeforeExpiry[_underlyingAsset][_expiry] = exchangeRate;
        return exchangeRate;
    }

    /// @inheritdoc IPendleCompoundForge
    function getExchangeRate(address _underlyingAsset) public override returns (uint256) {
        return ICToken(underlyingToCToken[_underlyingAsset]).exchangeRateCurrent();
    }

    /// @inheritdoc PendleForgeBase
    function _calcUnderlyingToRedeem(address _underlyingAsset, uint256 _amountToRedeem)
        internal
        override
        returns (uint256 underlyingToRedeem)
    {
        uint256 currentRate = getExchangeRate(_underlyingAsset);
        underlyingToRedeem = _amountToRedeem.mul(initialRate[_underlyingAsset]).div(currentRate);
    }

    /// @inheritdoc PendleForgeBase
    function _calcAmountToMint(address _underlyingAsset, uint256 _amountToTokenize)
        internal
        override
        returns (uint256 amountToMint)
    {
        uint256 currentRate = getExchangeRate(_underlyingAsset);
        amountToMint = _amountToTokenize.mul(currentRate).div(initialRate[_underlyingAsset]);
    }

    /// @inheritdoc PendleForgeBase
    function _getYieldBearingToken(address _underlyingAsset)
        internal
        view
        override
        returns (address)
    {
        require(underlyingToCToken[_underlyingAsset] != address(0), "INVALID_UNDERLYING_ASSET");
        return underlyingToCToken[_underlyingAsset];
    }

    /// @inheritdoc PendleForgeBase
    /**
    * Different from AaveForge, here there is no compound interest occurred because the amount
    of cToken always remains unchanged, only the exchangeRate does.
    * Since there is no compound effect, we don't need to calc the compound interest of the XYT after it has expired
     like Aave, and also we don't need to update the dueInterest
    */
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
        // split into 2 statements to avoid stack error
        uint256 interestFromXyt = principal.mul(currentRate).div(prevRate).sub(principal);
        interestFromXyt = interestFromXyt.mul(initialRate[_underlyingAsset]).div(currentRate);

        dueInterests[_underlyingAsset][_expiry][_user] = dueInterests[_underlyingAsset][_expiry][
            _user
        ]
            .add(interestFromXyt);
    }

    /// @inheritdoc PendleForgeBase
    /**
    * different from AaveForge, here there is no compound interest occurred because the amount
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
