// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.7.6;
pragma abicoder v2;

import "../../periphery/PermissionsV2.sol";
import "../../interfaces/IPendleMarket.sol";
import "../../interfaces/IPendleLiquidityMining.sol";
import "../../interfaces/IPendleYieldToken.sol";
import "../../interfaces/IPendlePausingManager.sol";
import "../../interfaces/IPendleForge.sol";
import "../../libraries/MathLib.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract PendleMarketEmergencyHandler is PermissionsV2, ReentrancyGuard {
    using Math for uint256;
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    struct MarketData {
        bytes32 factoryId;
        IPendleYieldToken xyt;
        IERC20 token;
        IERC20 underlyingYieldToken;
        address[] liqAddrArray;
        uint256 totalLp;
        mapping(address => bool) haveWithdrawn;
    }

    mapping(address => MarketData) public marketData;
    IPendlePausingManager public immutable pausingManager;

    modifier oneTimeWithdrawal(address _marketAddr) {
        require(!marketData[_marketAddr].haveWithdrawn[msg.sender], "NOTHING_TO_WITHDRAW");
        _;
        marketData[_marketAddr].haveWithdrawn[msg.sender] = true;
    }

    constructor(address _governanceManager, address _pausingManager)
        PermissionsV2(_governanceManager)
    {
        require(_pausingManager != address(0), "ZERO_ADDRESS");
        pausingManager = IPendlePausingManager(_pausingManager);
    }

    function validateLiqAddrArray(address _marketAddr, address[] calldata _liqAddrArray)
        public
        view
    {
        IPendleMarket market = IPendleMarket(_marketAddr);
        for (uint256 i = 0; i < _liqAddrArray.length; i++) {
            IPendleLiquidityMining liq = IPendleLiquidityMining(_liqAddrArray[i]);
            IPendleYieldToken xyt = IPendleYieldToken(market.xyt());
            require(
                address(xyt.forge()) == liq.forge() &&
                    xyt.underlyingAsset() == liq.underlyingAsset() &&
                    market.token() == liq.baseToken(),
                "INVALID_PAIR_MARKET_LIQ"
            );
        }
    }

    function setUpEmergencyMode(address _marketAddr, address[] calldata _liqAddrArray)
        external
        onlyGovernance
    {
        validateLiqAddrArray(_marketAddr, _liqAddrArray);
        MarketData storage mad = marketData[_marketAddr];
        // if this set of params has been used before, mad.factoryId must be != 0x0
        require(mad.factoryId != 0x0, "DUPLICATED_EMERGENCY_SETUP");

        IPendleMarket market = IPendleMarket(_marketAddr);
        market.setUpEmergencyMode(address(this));
        mad.factoryId = market.factoryId();
        mad.xyt = IPendleYieldToken(market.xyt());
        mad.token = IERC20(market.token());
        mad.underlyingYieldToken = IERC20(mad.xyt.underlyingYieldToken());
        mad.liqAddrArray = _liqAddrArray;
        mad.totalLp = market.totalSupply();
    }

    function updateLiqAddrArray(address _marketAddr, address[] calldata _liqAddrArray)
        external
        onlyGovernance
    {
        validateLiqAddrArray(_marketAddr, _liqAddrArray);
        marketData[_marketAddr].liqAddrArray = _liqAddrArray;
    }

    /**
    @dev after every withdraw transaction of users, we pretend that their LP are burnt, therefore
    decrease the totalLp of market. This way, the amount of xyt/token/yieldToken they receive when
    doing withdraw will always be proportional to amountLpUser/totalLp
    */
    function withdraw(address _marketAddr) external oneTimeWithdrawal(_marketAddr) nonReentrant {
        MarketData storage mad = marketData[_marketAddr];

        uint256 amountLpUser = _getTotalLpUser(_marketAddr);
        uint256 lpProportion = amountLpUser.rdiv(mad.totalLp);

        if (!_checkForgeIsPaused(mad.xyt)) {
            uint256 amountXytOut = lpProportion.rmul(mad.xyt.balanceOf(_marketAddr));
            IERC20(mad.xyt).safeTransferFrom(_marketAddr, msg.sender, amountXytOut);
        }

        uint256 amountTokenOut = lpProportion.rmul(mad.token.balanceOf(_marketAddr));
        mad.token.safeTransferFrom(_marketAddr, msg.sender, amountTokenOut);

        uint256 amountYieldTokenOut = lpProportion.rmul(
            mad.underlyingYieldToken.balanceOf(_marketAddr)
        );
        mad.underlyingYieldToken.safeTransferFrom(_marketAddr, msg.sender, amountYieldTokenOut);

        mad.totalLp = mad.totalLp.sub(amountLpUser);
    }

    function _checkForgeIsPaused(IPendleYieldToken _xyt) internal returns (bool isPaused) {
        (bool paused, bool locked) = pausingManager.checkYieldContractStatus(
            _xyt.forge().forgeId(),
            _xyt.underlyingAsset(),
            _xyt.expiry()
        );
        if (paused || locked) isPaused = true;
        else isPaused = false;
    }

    function _getTotalLpUser(address _marketAddr) internal view returns (uint256 totalLp) {
        MarketData storage mad = marketData[_marketAddr];
        totalLp = IPendleMarket(_marketAddr).balanceOf(msg.sender);
        for (uint256 i = 0; i < mad.liqAddrArray.length; i++) {
            totalLp = totalLp.add(
                IPendleLiquidityMining(mad.liqAddrArray[i]).getBalances(
                    mad.xyt.expiry(),
                    msg.sender
                )
            );
        }
    }
}
