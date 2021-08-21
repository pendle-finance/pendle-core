// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.7.6;
pragma abicoder v2;

import "../compound/PendleCompoundMarket.sol";

contract PendleGenericMarket is PendleCompoundMarket {
    constructor(
        address _governanceManager,
        address _xyt,
        address _token
    ) PendleCompoundMarket(_governanceManager, _xyt, _token) {}
}
