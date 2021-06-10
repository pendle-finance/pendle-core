// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.7.6;
pragma abicoder v2;

import "../../interfaces/IPendleCompoundForge.sol";
import "./../abstract/PendleMarketBase.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

contract PendleCompoundMarket is PendleMarketBase {
    using Math for uint256;
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    uint256 private globalLastExchangeRate;

    constructor(
        address _governanceManager,
        address _xyt,
        address _token
    ) PendleMarketBase(_governanceManager, _xyt, _token) {}

    function _getExchangeRate() internal returns (uint256) {
        return IPendleCompoundForge(forge).getExchangeRate(underlyingAsset);
    }

    function _afterBootstrap() internal override {
        paramL = 1;
        globalLastExchangeRate = _getExchangeRate();
    }

    /// @inheritdoc PendleMarketBase
    /*
     * Please refer to AaveMarket's _updateDueInterests to better understand this function
     * The key difference between Aave & Compound is in Compound there is no compound effect for locked in asset
        I.e: Only when the user use the cToken to redeem the underlyingAsset that he will enjoy the
        compound effect
     */
    function _updateDueInterests(address user) internal override {
        // before calc the interest for users, updateParamL
        _updateParamL();
        uint256 _paramL = paramL;
        uint256 userLastParamL = lastParamL[user];

        if (userLastParamL == 0) {
            lastParamL[user] = _paramL;
            return;
        }

        uint256 principal = balanceOf(user);
        uint256 interestValuePerLP = _paramL.sub(userLastParamL);

        uint256 interestFromLp = principal.mul(interestValuePerLP).div(MULTIPLIER);

        dueInterests[user] = dueInterests[user].add(interestFromLp);
        lastParamL[user] = _paramL;
    }

    /// @inheritdoc PendleMarketBase
    // Please refer to AaveMarket's _getFirstTermAndParamR to better understand this function
    function _getFirstTermAndParamR(uint256 currentNYield)
        internal
        override
        returns (uint256 firstTerm, uint256 paramR)
    {
        firstTerm = paramL;
        paramR = currentNYield.sub(lastNYield);
        globalLastExchangeRate = _getExchangeRate();
    }

    /// @inheritdoc PendleMarketBase
    function _getIncomeIndexIncreaseRate() internal override returns (uint256 increaseRate) {
        return _getExchangeRate().rdiv(globalLastExchangeRate).sub(Math.RONE);
    }
}
