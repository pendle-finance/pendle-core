// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.7.6;

import "../abstractV2/PendleYieldTokenHolderBaseV2.sol";

contract PendleUniswapV2YieldTokenHolder is PendleYieldTokenHolderBaseV2 {
    constructor(
        address _governanceManager,
        address _forge,
        address _yieldToken,
        uint256 _expiry
    ) PendleYieldTokenHolderBaseV2(_governanceManager, _forge, _yieldToken, _expiry) {}
}
