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
pragma solidity ^0.7.0;

import {Factory} from "../libraries/PendleLibrary.sol";
import "./PendleMarket.sol";
import "../interfaces/IPendleRouter.sol";
import "../interfaces/IPendleData.sol";
import "../interfaces/IPendleMarketFactory.sol";
import "../interfaces/IPendleYieldToken.sol";
import "../periphery/Permissions.sol";

contract PendleMarketFactory is IPendleMarketFactory, Permissions {
    IPendleRouter public override router;
    bytes32 public immutable override marketFactoryId;

    constructor(address _governance, bytes32 _marketFactoryId) Permissions(_governance) {
        marketFactoryId = _marketFactoryId;
    }

    modifier onlyRouter() {
        require(msg.sender == address(router), "Pendle: only router");
        _;
    }

    function initialize(IPendleRouter _router) external {
        require(msg.sender == initializer, "Pendle: forbidden");
        require(address(_router) != address(0), "Pendle: zero address");

        initializer = address(0);
        router = _router;
    }

    function createMarket(
        bytes32 _forgeId,
        address _xyt,
        address _token,
        uint256 _expiry
    ) external override initialized onlyRouter returns (address market) {
        require(_xyt != _token, "Pendle: similar tokens");
        require(_xyt != address(0) || _token != address(0), "Pendle: zero address");

        IPendleData data = router.data();
        require(
            data.getMarket(_forgeId, marketFactoryId, _xyt, _token) == address(0),
            "Pendle: market already exists"
        );
        require(data.isValidXYT(_xyt), "Pendle: not xyt");

        address forgeAddress = data.getForgeAddress(_forgeId);
        require(forgeAddress != address(0), "Pendle: zero address");

        market = Factory.createContract(
            type(PendleMarket).creationCode,
            abi.encodePacked(forgeAddress, _xyt, _token, _expiry),
            abi.encode(forgeAddress, _xyt, _token, _expiry)
        );
        data.addMarket(_forgeId, marketFactoryId, _xyt, _token, market);

        emit MarketCreated(marketFactoryId, _xyt, _token, market);
    }

    function setRouter(IPendleRouter _router) external override onlyGovernance {
        require(address(_router) != address(0), "Pendle: zero address");

        router = _router;
        emit RouterSet(address(_router));
    }
}
