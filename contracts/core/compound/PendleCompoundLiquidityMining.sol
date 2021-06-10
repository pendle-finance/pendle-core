// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.7.6;

import "../../libraries/MathLib.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "../../interfaces/IPendleCompoundForge.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "./../abstract/PendleLiquidityMiningBase.sol";

/**
    @dev things that must hold in this contract:
     - If an user's stake information is updated (hence lastTimeUserStakeUpdated is changed),
        then his pending rewards are calculated as well
        (and saved in availableRewardsForEpoch[user][epochId])
 */
contract PendleCompoundLiquidityMining is PendleLiquidityMiningBase {
    using Math for uint256;
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    mapping(uint256 => uint256) private globalLastExchangeRate;

    constructor(
        address _governanceManager,
        address _pausingManager,
        address _whitelist,
        address _pendleTokenAddress,
        address _pendleRouter, // The router basically identify our Pendle instance.
        bytes32 _pendleMarketFactoryId,
        bytes32 _pendleForgeId,
        address _underlyingAsset,
        address _baseToken,
        uint256 _startTime,
        uint256 _epochDuration,
        uint256 _vestingEpochs
    )
        PendleLiquidityMiningBase(
            _governanceManager,
            _pausingManager,
            _whitelist,
            _pendleTokenAddress,
            _pendleRouter,
            _pendleMarketFactoryId,
            _pendleForgeId,
            _underlyingAsset,
            _baseToken,
            _startTime,
            _epochDuration,
            _vestingEpochs
        )
    {}

    function _getExchangeRate() internal returns (uint256) {
        return IPendleCompoundForge(forge).getExchangeRate(underlyingAsset);
    }

    /**
    * Very similar to the function in PendleAaveMarket. Any major differences are likely to be bugs
        Please refer to it for more details
    */
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

    /**
    * Very similar to the function in PendleCompoundMarket. Any major differences are likely to be bugs
        Please refer to it for more details
    */
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
        expiryData[expiry].paramL = 1; // we only use differences between paramL so we can just set an arbitrary initial number
        globalLastExchangeRate[expiry] = _getExchangeRate();
    }

    /**
    * Very similar to the function in PendleAaveMarket. Any major differences are likely to be bugs
        Please refer to it for more details
    */
    function _getIncomeIndexIncreaseRate(uint256 expiry)
        internal
        override
        returns (uint256 increaseRate)
    {
        return _getExchangeRate().rdiv(globalLastExchangeRate[expiry]) - Math.RONE;
    }
}
