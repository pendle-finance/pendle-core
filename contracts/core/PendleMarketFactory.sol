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

import "../libraries/FactoryLib.sol";
import "./PendleMarket.sol";
import "../interfaces/IPendleRouter.sol";
import "../interfaces/IPendleData.sol";
import "../interfaces/IPendleMarketFactory.sol";
import "../interfaces/IPendleYieldToken.sol";
import "../periphery/Permissions.sol";
import "../periphery/Withdrawable.sol";

contract PendleMarketFactory is IPendleMarketFactory, Permissions, Withdrawable {
    IPendleRouter public override router;
    bytes32 public immutable override marketFactoryId;

    constructor(address _governance, bytes32 _marketFactoryId) Permissions(_governance) {
        marketFactoryId = _marketFactoryId;
    }

    modifier onlyRouter() {
        require(msg.sender == address(router), "ONLY_ROUTER");
        _;
    }

    function initialize(IPendleRouter _router) external {
        require(msg.sender == initializer, "FORBIDDEN");
        require(address(_router) != address(0), "ZERO_ADDRESS");

        initializer = address(0);
        router = _router;
    }

    function createMarket(address _xyt, address _token)
        external
        override
        initialized
        onlyRouter
        returns (address market)
    {
        require(_xyt != _token, "INVALID_PAIR_XYT_TOKEN");
        require(_xyt != address(0) || _token != address(0), "ZERO_ADDRESS");

        IPendleData data = router.data();
        require(data.getMarket(marketFactoryId, _xyt, _token) == address(0), "EXISTED_MARKET");

        address forgeAddress = IPendleYieldToken(_xyt).forge();
        address underlyingAsset = IPendleYieldToken(_xyt).underlyingAsset();
        uint256 expiry = IPendleYieldToken(_xyt).expiry();
        require(data.isValidXYT(forgeAddress, underlyingAsset, expiry), "INVALID_XYT");

        market = Factory.createContract(
            type(PendleMarket).creationCode,
            abi.encodePacked(forgeAddress, _xyt, _token, expiry),
            abi.encode(forgeAddress, _xyt, _token, expiry)
        );
        data.addMarket(marketFactoryId, _xyt, _token, market);

        emit MarketCreated(marketFactoryId, _xyt, _token, market);
    }
}
