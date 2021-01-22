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
import "../interfaces/IPendle.sol";
import "../interfaces/IPendleData.sol";
import "../interfaces/IPendleMarketFactory.sol";
import "../interfaces/IPendleYieldToken.sol";
import "../periphery/Permissions.sol";
import {ErrorMessages as errMsg} from "../libraries/ErrorMessages.sol";

contract PendleAaveMarketFactory is IPendleMarketFactory, Permissions {
    IPendle public override core;
    bytes32 public immutable override marketFactoryId;

    constructor(address _governance, bytes32 _marketFactoryId) Permissions(_governance) {
        marketFactoryId = _marketFactoryId;
    }

    function initialize(IPendle _core) external {
        require(msg.sender == initializer, errMsg.FORBIDDEN);
        require(address(_core) != address(0), errMsg.ZERO_ADDRESS);

        initializer = address(0);
        core = _core;
    }

    function createMarket(
        bytes32 _forgeId,
        address _xyt,
        address _token,
        uint256 _expiry
    ) external override initialized returns (address market) {
        require(_xyt != _token, errMsg.SIMILAR_TOKEN);
        require(_xyt != address(0) && _token != address(0), errMsg.ZERO_ADDRESS);

        IPendleData data = core.data();
        address forgeAddress = data.getForgeAddress(_forgeId);

        require(
            data.getMarket(_forgeId, marketFactoryId, _xyt, _token) == address(0),
            errMsg.EXISTED_MARKET
        );
        require(data.isValidXYT(_xyt), errMsg.NOT_XYT);

        market = Factory.createContract(
            type(PendleMarket).creationCode,
            abi.encodePacked(msg.sender, core, forgeAddress, _xyt, _token, _expiry),
            abi.encode(msg.sender, core, forgeAddress, _xyt, _token, _expiry)
        );
        data.storeMarket(_forgeId, marketFactoryId, _xyt, _token, market);
        data.addMarket(_forgeId, marketFactoryId, market);
        //@@Vu TODO: we might want to merge data.storeMarket and data.addMarket to one function?

        //@@Vu TODO: fix events to add marketFactoryId
        emit MarketCreated(_xyt, _token, market);
    }

    function setCore(IPendle _core) public override onlyGovernance {
        require(address(_core) != address(0), errMsg.ZERO_ADDRESS);

        core = _core;
        emit CoreSet(address(_core));
    }
}
