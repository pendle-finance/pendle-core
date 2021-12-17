// SPDX-License-Identifier: BUSL-1.1
// solhint-disable ordering
pragma solidity 0.7.6;
pragma abicoder v2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../../interfaces/IPendleGenericForge.sol";
import "../../interfaces/IWMEMO.sol";
import "../abstractV2/PendleForgeBaseV2.sol";

/**
 * @dev most of the contract's logic is the same as CompoundV2
 * @dev no override for _registerNewAssetsWithRewardManager because this contract doesn't
 have any rewars
 */
contract PendleWonderlandForge is PendleForgeBaseV2, IPendleGenericForge {
    using SafeMath for uint256;
    using CompoundMath for uint256;

    // solhint-disable var-name-mixedcase
    IERC20 public immutable MEMO;
    IWMEMO public immutable wMEMO;

    mapping(address => mapping(uint256 => uint256)) public lastRateBeforeExpiry;
    mapping(address => mapping(uint256 => mapping(address => uint256))) public lastRate;

    constructor(
        address _governanceManager,
        IPendleRouter _router,
        bytes32 _forgeId,
        address _rewardToken,
        address _rewardManager,
        address _yieldContractDeployer,
        IWMEMO _wMEMO
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
        MEMO = IERC20(_wMEMO.MEMO());
        wMEMO = _wMEMO;
    }

    function verifyToken(address _underlyingAsset, uint256[] calldata _tokenInfo)
        public
        virtual
        override
    {
        require(_underlyingAsset == address(MEMO), "NOT_MEMO");
        require(
            _tokenInfo.length == 1 && address(_tokenInfo[0]) == address(wMEMO),
            "INVALID_TOKEN_INFO"
        );
    }

    function getExchangeRate(address) public virtual override returns (uint256) {
        return wMEMO.wMEMOToMEMO(CompoundMath.ONE_E_18);
    }

    function getYieldBearingToken(address _underlyingAsset)
        public
        view
        override(IPendleForge, PendleForgeBaseV2)
        returns (address yieldBearingTokenAddr)
    {
        require(tokenInfo[_underlyingAsset].registered, "INVALID_UNDERLYING_ASSET");
        yieldBearingTokenAddr = address(tokenInfo[_underlyingAsset].container[0]);
    }

    function _calcTotalAfterExpiry(
        address _underlyingAsset,
        uint256 _expiry,
        uint256 _redeemedAmount
    ) internal view override returns (uint256 totalAfterExpiry) {
        totalAfterExpiry = _redeemedAmount.cdiv(lastRateBeforeExpiry[_underlyingAsset][_expiry]);
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

    function _calcUnderlyingToRedeem(address _underlyingAsset, uint256 _amountToRedeem)
        internal
        override
        returns (uint256 underlyingToRedeem)
    {
        underlyingToRedeem = _amountToRedeem.cdiv(getExchangeRate(_underlyingAsset));
    }

    function _calcAmountToMint(address _underlyingAsset, uint256 _amountToTokenize)
        internal
        override
        returns (uint256 amountToMint)
    {
        amountToMint = _amountToTokenize.cmul(getExchangeRate(_underlyingAsset));
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

        uint256 interestFromXyt = _principal.mul(currentRate.sub(prevRate)).cdiv(
            prevRate.mul(currentRate)
        );

        dueInterests[_underlyingAsset][_expiry][_user] = dueInterests[_underlyingAsset][_expiry][
            _user
        ].add(interestFromXyt);
    }

    function _updateForgeFee(
        address _underlyingAsset,
        uint256 _expiry,
        uint256 _feeAmount
    ) internal override {
        totalFee[_underlyingAsset][_expiry] = totalFee[_underlyingAsset][_expiry].add(_feeAmount);
    }
}

library CompoundMath {
    uint256 internal constant ONE_E_18 = 1e18;
    using SafeMath for uint256;

    function cmul(uint256 x, uint256 y) internal pure returns (uint256) {
        return x.mul(y).div(ONE_E_18);
    }

    function cdiv(uint256 x, uint256 y) internal pure returns (uint256) {
        return x.mul(ONE_E_18).div(y);
    }
}
