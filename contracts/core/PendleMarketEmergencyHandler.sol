// SPDX-License-Identifier: MIT
/*
 * MIT License
 * ===========
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 */
pragma solidity 0.7.6;
pragma abicoder v2;

import "../periphery/PermissionsV2.sol";
import "../interfaces/IPendleMarket.sol";
import "../interfaces/IPendleLiquidityMining.sol";
import "../interfaces/IPendleYieldToken.sol";
import "../interfaces/IPendlePausingManager.sol";
import "../interfaces/IPendleForge.sol";
import "../libraries/MathLib.sol";
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
        IPendleLiquidityMining liq;
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

    function setUpEmergencyMode(address _marketAddr, address _liqAddr) public onlyGovernance {
        IPendleMarket market = IPendleMarket(_marketAddr);
        market.setUpEmergencyMode(address(this));
        MarketData storage mad = marketData[_marketAddr];

        mad.factoryId = market.factoryId();
        mad.xyt = IPendleYieldToken(market.xyt());
        mad.token = IERC20(market.token());
        mad.underlyingYieldToken = IERC20(mad.xyt.underlyingYieldToken());
        mad.liq = IPendleLiquidityMining(_liqAddr);
        mad.totalLp = market.totalSupply();
    }

    /**
    @dev after every withdraw transaction of users, we pretend that their LP are burnt, therefore
    decrease the totalLp of market. This way, the amount of xyt/token/yieldToken they receive when
    doing withdraw will always be proportional to amountLpUser/totalLp
    */
    function withdraw(address _marketAddr) public oneTimeWithdrawal(_marketAddr) nonReentrant {
        MarketData storage mad = marketData[_marketAddr];

        uint256 amountLpUser = _getTotalLpUser(_marketAddr);
        uint256 lpProportion = amountLpUser.rdiv(mad.totalLp);

        if (!_checkForgeIsPaused(mad.xyt)) {
            uint256 amountXytOut = lpProportion.rmul(mad.xyt.balanceOf(_marketAddr));
            mad.xyt.transferFrom(_marketAddr, msg.sender, amountXytOut);
        }

        uint256 amountTokenOut = lpProportion.rmul(mad.token.balanceOf(_marketAddr));
        mad.token.safeTransferFrom(_marketAddr, msg.sender, amountTokenOut);

        uint256 amountYieldTokenOut =
            lpProportion.rmul(mad.underlyingYieldToken.balanceOf(_marketAddr));
        mad.underlyingYieldToken.safeTransferFrom(_marketAddr, msg.sender, amountYieldTokenOut);

        mad.totalLp = mad.totalLp.sub(amountLpUser);
    }

    function _checkForgeIsPaused(IPendleYieldToken _xyt) internal returns (bool isPaused) {
        (bool paused, bool locked) =
            pausingManager.checkYieldContractStatus(
                _xyt.forge().forgeId(),
                _xyt.underlyingAsset(),
                _xyt.expiry()
            );
        if (paused || locked) isPaused = true;
        else isPaused = false;
    }

    function _getTotalLpUser(address _marketAddr) internal view returns (uint256 totalLp) {
        MarketData storage mad = marketData[_marketAddr];
        return
            IPendleMarket(_marketAddr).balanceOf(msg.sender).add(
                mad.liq.getBalances(mad.xyt.expiry(), msg.sender)
            );
    }
}
