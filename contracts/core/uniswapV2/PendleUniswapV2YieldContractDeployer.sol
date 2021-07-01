// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.7.6;

import "../abstractV2/PendleYieldContractDeployerBaseV2.sol";

contract PendleUniswapV2YieldContractDeployer is PendleYieldContractDeployerBaseV2 {
    constructor(address _governanceManager, bytes32 _forgeId)
        PendleYieldContractDeployerBaseV2(_governanceManager, _forgeId)
    {}
}
