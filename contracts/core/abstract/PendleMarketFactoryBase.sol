// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.7.6;

import "../../interfaces/IPendleRouter.sol";
import "../../interfaces/IPendleData.sol";
import "../../interfaces/IPendleMarketFactory.sol";

abstract contract PendleMarketFactoryBase is IPendleMarketFactory {
    IPendleRouter public immutable override router;
    bytes32 public immutable override marketFactoryId;

    constructor(address _router, bytes32 _marketFactoryId) {
        require(address(_router) != address(0), "ZERO_ADDRESS");

        router = IPendleRouter(_router);
        marketFactoryId = _marketFactoryId;
    }

    modifier onlyRouter() {
        require(msg.sender == address(router), "ONLY_ROUTER");
        _;
    }

    function createMarket(address _xyt, address _token)
        external
        override
        onlyRouter
        returns (address market)
    {
        IPendleData data = router.data();

        market = _createMarket(_xyt, _token);
        data.addMarket(marketFactoryId, _xyt, _token, market);
    }

    function _createMarket(address _xyt, address _token) internal virtual returns (address);
}
