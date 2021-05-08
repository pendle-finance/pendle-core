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

import "../periphery/Permissions.sol";
import "../periphery/Withdrawable.sol";
import "../interfaces/IPendlePausingManager.sol";

contract PendlePausingManager is IPendlePausingManager, Permissions, Withdrawable {
    struct PausingData {
        uint256 timestamp;
        bool paused;
    }

    struct EmergencyHandlerSetting {
        address handler;
        address pendingHandler;
        uint256 timelockDeadline;
    }

    uint256 private constant EMERGENCY_HANDLER_CHANGE_TIMELOCK = 7 days;

    mapping(bytes32 => mapping(address => mapping(uint256 => PausingData))) forgeAssetExpiryPaused; // reversible
    mapping(bytes32 => mapping(address => PausingData)) forgeAssetPaused; // reversible
    mapping(bytes32 => PausingData) forgePaused; // reversible

    mapping(bytes32 => mapping(address => mapping(uint256 => bool))) forgeAssetExpiryLocked; // non-reversible
    mapping(bytes32 => mapping(address => bool)) forgeAssetLocked; // non-reversible
    mapping(bytes32 => bool) forgeLocked; // non-reversible

    mapping(bytes32 => mapping(address => PausingData)) marketPaused; // reversible
    mapping(bytes32 => PausingData) marketFactoryPaused; // reversible

    mapping(bytes32 => mapping(address => bool)) marketLocked; // non-reversible
    mapping(bytes32 => bool) marketFactoryLocked; // non-reversible

    EmergencyHandlerSetting public override forgeEmergencyHandler;
    EmergencyHandlerSetting public override marketEmergencyHandler;

    bool public override permLocked;
    bool public override permForgeHandlerLocked;
    bool public override permMarketHandlerLocked;

    mapping(address => bool) public override isPausingAdmin;

    // only governance can unpause; pausing admins can pause
    modifier isAllowedToSetPaused(bool settingToPaused) {
        if (settingToPaused) {
            require(isPausingAdmin[msg.sender], "FORBIDDEN");
        } else {
            require(msg.sender == governance, "ONLY_GOVERNANCE");
        }
        _;
    }

    modifier notPermLocked {
        require(!permLocked, "PERMANENTLY_LOCKED");
        _;
    }

    constructor(address _governance, address initialForgeHandler, address initialMarketHandler) Permissions(_governance) {
        forgeEmergencyHandler.handler = initialForgeHandler;
        marketEmergencyHandler.handler = initialMarketHandler;
    }

    /////////////////////////
    //////// ADMIN FUNCTIONS
    ////////
    function setPausingAdmin(address admin, bool isAdmin)
        external
        override
        onlyGovernance
        notPermLocked
    {
        require(isPausingAdmin[admin] != isAdmin, "REDUNDANT_SET");
        isPausingAdmin[admin] = isAdmin;
        if (isAdmin) {
            emit AddPausingAdmin(admin);
        } else {
            emit RemovePausingAdmin(admin);
        }
    }

    //// Changing forgeEmergencyHandler and marketEmergencyHandler
    function requestForgeHandlerChange(address _pendingForgeHandler)
        external
        override
        onlyGovernance
        notPermLocked
    {
        require(!permForgeHandlerLocked, "FORGE_HANDLER_LOCKED");
        require(_pendingForgeHandler != address(0), "ZERO_ADDRESS");
        forgeEmergencyHandler.pendingHandler = _pendingForgeHandler;
        forgeEmergencyHandler.timelockDeadline =
            block.timestamp +
            EMERGENCY_HANDLER_CHANGE_TIMELOCK;

        emit PendingForgeEmergencyHandler(_pendingForgeHandler);
    }

    function requestMarketHandlerChange(address _pendingMarketHandler)
        external
        override
        onlyGovernance
        notPermLocked
    {
        require(!permMarketHandlerLocked, "MARKET_HANDLER_LOCKED");
        require(_pendingMarketHandler != address(0), "ZERO_ADDRESS");
        marketEmergencyHandler.pendingHandler = _pendingMarketHandler;
        marketEmergencyHandler.timelockDeadline =
            block.timestamp +
            EMERGENCY_HANDLER_CHANGE_TIMELOCK;

        emit PendingMarketEmergencyHandler(_pendingMarketHandler);
    }

    function applyForgeHandlerChange() external override notPermLocked {
        require(forgeEmergencyHandler.pendingHandler != address(0), "INVALID_HANDLER");
        require(block.timestamp > forgeEmergencyHandler.timelockDeadline, "TIMELOCK_NOT_OVER");
        forgeEmergencyHandler.handler = forgeEmergencyHandler.pendingHandler;
        forgeEmergencyHandler.pendingHandler = address(0);
        forgeEmergencyHandler.timelockDeadline = uint256(-1);

        emit ForgeEmergencyHandlerSet(forgeEmergencyHandler.handler);
    }

    function applyMarketHandlerChange() external override notPermLocked {
        require(marketEmergencyHandler.pendingHandler != address(0), "INVALID_HANDLER");
        require(block.timestamp > marketEmergencyHandler.timelockDeadline, "TIMELOCK_NOT_OVER");
        marketEmergencyHandler.handler = marketEmergencyHandler.pendingHandler;
        marketEmergencyHandler.pendingHandler = address(0);
        marketEmergencyHandler.timelockDeadline = uint256(-1);

        emit MarketEmergencyHandlerSet(marketEmergencyHandler.handler);
    }

    //// Lock permanently parts of the features
    function lockPausingManagerPermanently() external override onlyGovernance notPermLocked {
        permLocked = true;
    }

    function lockForgeHandlerPermanently() external override onlyGovernance notPermLocked {
        permForgeHandlerLocked = true;
    }

    function lockMarketHandlerPermanently() external override onlyGovernance notPermLocked {
        permMarketHandlerLocked = true;
    }

    /////////////////////////
    //////// FORGE
    ////////
    function setForgePaused(bytes32 forgeId, bool settingToPaused)
        external
        override
        isAllowedToSetPaused(settingToPaused)
        notPermLocked
    {
        forgePaused[forgeId].timestamp = block.timestamp;
        forgePaused[forgeId].paused = settingToPaused;
    }

    function setForgeAssetPaused(
        bytes32 forgeId,
        address underlyingAsset,
        bool settingToPaused
    ) external override isAllowedToSetPaused(settingToPaused) notPermLocked {
        forgeAssetPaused[forgeId][underlyingAsset].timestamp = block.timestamp;
        forgeAssetPaused[forgeId][underlyingAsset].paused = settingToPaused;
    }

    function setForgeAssetExpiryPaused(
        bytes32 forgeId,
        address underlyingAsset,
        uint256 expiry,
        bool settingToPaused
    ) external override isAllowedToSetPaused(settingToPaused) notPermLocked {
        forgeAssetExpiryPaused[forgeId][underlyingAsset][expiry].timestamp = block.timestamp;
        forgeAssetExpiryPaused[forgeId][underlyingAsset][expiry].paused = settingToPaused;
    }

    function setForgeLocked(bytes32 forgeId) external override onlyGovernance notPermLocked {
        forgeLocked[forgeId] = true;
    }

    function setForgeAssetLocked(bytes32 forgeId, address underlyingAsset)
        external
        override
        onlyGovernance
        notPermLocked
    {
        forgeAssetLocked[forgeId][underlyingAsset] = true;
    }

    function setForgeAssetExpiryLocked(
        bytes32 forgeId,
        address underlyingAsset,
        uint256 expiry
    ) external override onlyGovernance notPermLocked {
        forgeAssetExpiryLocked[forgeId][underlyingAsset][expiry] = true;
    }

    function _isYieldContractPaused(
        bytes32 forgeId,
        address underlyingAsset,
        uint256 expiry
    ) internal view returns (bool _paused) {
        PausingData storage p1 = forgePaused[forgeId];
        PausingData storage p2 = forgeAssetPaused[forgeId][underlyingAsset];
        PausingData storage p3 = forgeAssetExpiryPaused[forgeId][underlyingAsset][expiry];

        // Take the most recent pausing data among p1, p2 and p3
        PausingData storage p = p1.timestamp > p2.timestamp ? p1 : p2;
        _paused = p.timestamp > p3.timestamp ? p.paused : p3.paused;
    }

    function _isYieldContractLocked(
        bytes32 forgeId,
        address underlyingAsset,
        uint256 expiry
    ) internal view returns (bool _locked) {
        _locked =
            forgeLocked[forgeId] ||
            forgeAssetLocked[forgeId][underlyingAsset] ||
            forgeAssetExpiryLocked[forgeId][underlyingAsset][expiry];
    }

    function checkYieldContractStatus(
        bytes32 forgeId,
        address underlyingAsset,
        uint256 expiry
    ) public view override returns (bool _paused, bool _locked) {
        _locked = _isYieldContractLocked(forgeId, underlyingAsset, expiry);
        if (_locked) {
            _paused = true; // if a yield contract is locked, its paused by default as well
        } else {
            _paused = _isYieldContractPaused(forgeId, underlyingAsset, expiry);
        }
    }

    /////////////////////////
    //////// MARKET
    ////////
    function setMarketFactoryPaused(bytes32 marketFactoryId, bool settingToPaused)
        external
        override
        isAllowedToSetPaused(settingToPaused)
        notPermLocked
    {
        marketFactoryPaused[marketFactoryId].timestamp = block.timestamp;
        marketFactoryPaused[marketFactoryId].paused = settingToPaused;
    }

    function setMarketPaused(
        bytes32 marketFactoryId,
        address market,
        bool settingToPaused
    ) external override isAllowedToSetPaused(settingToPaused) notPermLocked {
        marketPaused[marketFactoryId][market].timestamp = block.timestamp;
        marketPaused[marketFactoryId][market].paused = settingToPaused;
    }

    function setMarketFactoryLocked(bytes32 marketFactoryId)
        external
        override
        onlyGovernance
        notPermLocked
    {
        marketFactoryLocked[marketFactoryId] = true;
    }

    function setMarketLocked(bytes32 marketFactoryId, address market)
        external
        override
        onlyGovernance
        notPermLocked
    {
        marketLocked[marketFactoryId][market] = true;
    }

    function _isMarketPaused(bytes32 marketFactoryId, address market)
        internal
        view
        returns (bool _paused)
    {
        PausingData storage p1 = marketFactoryPaused[marketFactoryId];
        PausingData storage p2 = marketPaused[marketFactoryId][market];

        // Take the most recent pausing data among p1, p2
        _paused = p1.timestamp > p2.timestamp ? p1.paused : p2.paused;
    }

    function _isMarketLocked(bytes32 marketFactoryId, address market)
        internal
        view
        returns (bool _locked)
    {
        _locked = marketFactoryLocked[marketFactoryId] || marketLocked[marketFactoryId][market];
    }

    function checkMarketStatus(bytes32 marketFactoryId, address market)
        public
        view
        override
        returns (bool _paused, bool _locked)
    {
        _locked = _isMarketLocked(marketFactoryId, market);
        if (_locked) {
            _paused = true; // if a yield contract is locked, its paused by default as well
        } else {
            _paused = _isMarketPaused(marketFactoryId, market);
        }
    }
}
