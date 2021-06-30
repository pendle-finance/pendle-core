// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.7.6;

import "../compound/PendleCompoundMarketFactory.sol";

contract PendleM1MarketFactory is PendleCompoundMarketFactory {
    constructor(address _governanceManager, bytes32 _marketFactoryId)
        PendleCompoundMarketFactory(_governanceManager, _marketFactoryId)
    {}
}
