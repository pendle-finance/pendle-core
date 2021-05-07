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

interface IPendlePausingManager {
    /* struct EmergencyHandlerSetting {
        address handler;
        address pendingHandler;
        uint256 timelockDeadline;
    } */

    event AddPausingAdmin(address);
    event RemovePausingAdmin(address);
    event PendingForgeEmergencyHandler(address);
    event PendingMarketEmergencyHandler(address);
    event ForgeEmergencyHandlerSet(address);
    event MarketEmergencyHandlerSet(address);

    function forgeEmergencyHandler() external view returns (address handler, address pendingHandler, uint256 timelockDeadline);
    function marketEmergencyHandler() external view returns (address handler, address pendingHandler, uint256 timelockDeadline);

    function permLocked() external view returns (bool);
    function permForgeHandlerLocked() external view returns (bool);
    function permMarketHandlerLocked() external view returns (bool);

    function isPausingAdmin(address) external view returns (bool);

    function setPausingAdmin(address admin, bool isAdmin) external;

    function requestForgeHandlerChange(address _pendingForgeHandler) external;

    function requestMarketHandlerChange(address _pendingMarketHandler) external;

    function applyForgeHandlerChange() external;

    function applyMarketHandlerChange() external;

    function lockPausingManagerPermanently() external;

    function lockForgeHandlerPermanently() external;

    function lockMarketHandlerPermanently() external;

    function setForgePaused(bytes32 forgeId, bool paused) external;

    function setForgeAssetPaused(bytes32 forgeId, address underlyingAsset, bool paused) external;

    function setForgeAssetExpiryPaused(bytes32 forgeId, address underlyingAsset, uint256 expiry, bool paused) external;

    function setForgeLocked(bytes32 forgeId) external;

    function setForgeAssetLocked(bytes32 forgeId, address underlyingAsset) external;

    function setForgeAssetExpiryLocked(bytes32 forgeId, address underlyingAsset, uint256 expiry) external;

    function checkYieldContractStatus(bytes32 forgeId, address underlyingAsset, uint256 expiry) external view returns (bool _paused, bool _locked);

    function setMarketFactoryPaused(bytes32 marketFactoryId, bool paused) external;

    function setMarketPaused(bytes32 marketFactoryId, address market, bool paused) external;

    function setMarketFactoryLocked(bytes32 marketFactoryId) external;

    function setMarketLocked(bytes32 marketFactoryId, address market) external;

    function checkMarketStatus(bytes32 marketFactoryId, address market) external view returns (bool _paused, bool _locked);
}
