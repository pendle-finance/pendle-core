// SPDX-License-Identifier: BUSL-1.1
pragma abicoder v2;

pragma solidity 0.7.6;

import "../../libraries/MathLib.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "../../interfaces/IPendleCompoundForge.sol";
import "./../abstract/PendleLiquidityMiningBaseMulti.sol";

/**
    @dev all functions are the same as PendleCompoundLiquidityMining
 */
contract PendleGenericLiquidityMiningMulti is PendleLiquidityMiningBaseMulti {
    using Math for uint256;
    using SafeMath for uint256;

    mapping(uint256 => uint256) private globalLastExchangeRate;

    constructor(ConstructorArgs memory args) PendleLiquidityMiningBaseMulti(args) {}

    function _getExchangeRate() internal returns (uint256) {
        return IPendleCompoundForge(forge).getExchangeRate(underlyingAsset);
    }

    function _updateDueInterests(uint256 expiry, address user) internal override {
        ExpiryData storage exd = expiryData[expiry];
        require(exd.lpHolder != address(0), "INVALID_EXPIRY");

        _updateParamL(expiry);
        uint256 paramL = exd.paramL;
        uint256 userLastParamL = exd.lastParamL[user];

        if (userLastParamL == 0) {
            exd.lastParamL[user] = paramL;
            return;
        }

        uint256 principal = exd.balances[user];
        uint256 interestValuePerLP = paramL.sub(userLastParamL);

        uint256 interestFromLp = principal.mul(interestValuePerLP).div(MULTIPLIER);

        exd.dueInterests[user] = exd.dueInterests[user].add(interestFromLp);
        exd.lastParamL[user] = paramL;
    }

    function _getFirstTermAndParamR(uint256 expiry, uint256 currentNYield)
        internal
        override
        returns (uint256 firstTerm, uint256 paramR)
    {
        ExpiryData storage exd = expiryData[expiry];
        firstTerm = exd.paramL;
        paramR = currentNYield.sub(exd.lastNYield);
        globalLastExchangeRate[expiry] = _getExchangeRate();
    }

    function _afterAddingNewExpiry(uint256 expiry) internal override {
        expiryData[expiry].paramL = 1;
        globalLastExchangeRate[expiry] = _getExchangeRate();
    }

    function _getIncomeIndexIncreaseRate(uint256 expiry)
        internal
        override
        returns (uint256 increaseRate)
    {
        return _getExchangeRate().rdiv(globalLastExchangeRate[expiry]) - Math.RONE;
    }
}
