// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.7.6;

import "./IPendleYieldTokenHolder.sol";

interface IPendleTraderJoeYieldTokenHolder {
    function migrateMasterChef(address _masterChef, uint256 pid) external;
}
