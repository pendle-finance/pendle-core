// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.7.6;

import "../abstractV2/PendleYieldContractDeployerBaseV2.sol";
import "./PendleSushiswapComplexYieldTokenHolder.sol";

contract PendleSushiswapComplexYieldContractDeployer is PendleYieldContractDeployerBaseV2 {
    IMasterChef public masterChef; // no immutable to save bytecode size

    constructor(
        address _governanceManager,
        bytes32 _forgeId,
        address _masterChef
    ) PendleYieldContractDeployerBaseV2(_governanceManager, _forgeId) {
        masterChef = IMasterChef(_masterChef);
    }

    function deployYieldTokenHolder(
        address _yieldToken,
        uint256 _expiry,
        uint256[] calldata _container
    ) external override onlyForge returns (address yieldTokenHolder) {
        // container[0] = pid
        yieldTokenHolder = address(
            new PendleSushiswapComplexYieldTokenHolder(
                address(governanceManager),
                address(forge),
                _yieldToken,
                _expiry,
                address(masterChef),
                _container[0]
            )
        );
    }
}
