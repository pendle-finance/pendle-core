// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.7.6;

import "./PendleAaveMarket.sol";
import "../../interfaces/IPermissionsV2.sol";
import "./../abstract/PendleMarketFactoryBase.sol";

contract PendleAaveMarketFactory is PendleMarketFactoryBase {
    constructor(address _governanceManager, bytes32 _marketFactoryId)
        PendleMarketFactoryBase(_governanceManager, _marketFactoryId)
    {}

    function _createMarket(address _xyt, address _token) internal override returns (address) {
        address _governanceManager = address(IPermissionsV2(address(router)).governanceManager());
        return address(new PendleAaveMarket(_governanceManager, _xyt, _token));
    }
}
