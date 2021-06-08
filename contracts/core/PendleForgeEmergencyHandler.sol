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
import "../interfaces/IPendlePausingManager.sol";
import "../interfaces/IPendleForge.sol";
import "../interfaces/IPendleData.sol";
import "../interfaces/IPendleYieldTokenHolder.sol";
import "../libraries/MathLib.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract PendleForgeEmergencyHandler is PermissionsV2, ReentrancyGuard {
    using Math for uint256;
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    struct ForgeData {
        IPendleYieldTokenHolder yieldTokenHolder;
        IERC20 yieldToken;
        IERC20 rewardToken;
        IERC20 ot;
        uint256 totalOt;
        mapping(address => bool) haveWithdrawn;
    }
    mapping(address => mapping(address => mapping(uint256 => ForgeData))) public forgeData;
    IPendleData public immutable data;

    modifier oneTimeWithdrawal(
        address _forgeAddr,
        address _underlyingAsset,
        uint256 _expiry
    ) {
        require(
            !forgeData[_forgeAddr][_underlyingAsset][_expiry].haveWithdrawn[msg.sender],
            "NOTHING_TO_WITHDRAW"
        );
        _;
        forgeData[_forgeAddr][_underlyingAsset][_expiry].haveWithdrawn[msg.sender] = true;
    }

    constructor(
        address _governanceManager,
        address _pausingManager,
        address _data
    ) PermissionsV2(_governanceManager) {
        require(_pausingManager != address(0), "ZERO_ADDRESS");
        data = IPendleData(_data);
    }

    function setUpEmergencyMode(
        address _forgeAddr,
        address _underlyingAsset,
        uint256 _expiry
    ) public onlyGovernance {
        ForgeData storage fod = forgeData[_forgeAddr][_underlyingAsset][_expiry];
        IPendleForge forge = IPendleForge(_forgeAddr);
        forge.setUpEmergencyMode(_underlyingAsset, _expiry, address(this));

        fod.yieldTokenHolder = IPendleYieldTokenHolder(
            forge.yieldTokenHolders(_underlyingAsset, _expiry)
        );
        fod.yieldToken = IERC20(fod.yieldTokenHolder.yieldToken());
        fod.rewardToken = IERC20(fod.yieldTokenHolder.rewardToken());
        fod.ot = data.otTokens(forge.forgeId(), _underlyingAsset, _expiry);
        fod.totalOt = fod.ot.totalSupply();
    }

    // TODO: Should this function be a batch function?
    /**
    @dev after every withdraw transaction of users, we pretend that their OT are burnt, therefore
    decrease the totalOt of forge. This way, the amount of yieldToken/rewardToken they receive when
    doing withdraw will always be proportional to amountOtUser/totalOt
    */
    function withdraw(
        address _forgeAddr,
        address _underlyingAsset,
        uint256 _expiry
    ) public oneTimeWithdrawal(_forgeAddr, _underlyingAsset, _expiry) nonReentrant {
        ForgeData storage fod = forgeData[_forgeAddr][_underlyingAsset][_expiry];

        uint256 amountOtUser = fod.ot.balanceOf(msg.sender);
        uint256 otProportion = amountOtUser.rdiv(fod.totalOt);

        uint256 amountYieldTokenOut =
            otProportion.rmul(fod.yieldToken.balanceOf(address(fod.yieldTokenHolder)));
        fod.yieldToken.transferFrom(
            address(fod.yieldTokenHolder),
            msg.sender,
            amountYieldTokenOut
        );

        uint256 amountRewardOut =
            otProportion.rmul(fod.rewardToken.balanceOf(address(fod.yieldTokenHolder)));
        fod.rewardToken.transferFrom(address(fod.yieldTokenHolder), msg.sender, amountRewardOut);

        fod.totalOt = fod.totalOt.sub(amountOtUser);
    }
}
