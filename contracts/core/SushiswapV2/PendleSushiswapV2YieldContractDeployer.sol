// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.7.6;

import "../abstractV2/PendleYieldContractDeployerBaseV2.sol";
import "./PendleSushiswapV2YieldTokenHolder.sol";

contract PendleSushiswapV2YieldContractDeployer is PendleYieldContractDeployerBaseV2 {
    constructor(address _governanceManager, bytes32 _forgeId)
        PendleYieldContractDeployerBaseV2(_governanceManager, _forgeId)
    {}

    function deployYieldTokenHolder(
        address _yieldToken,
        uint256 _expiry,
        uint256[] calldata _opt
    ) external override onlyForge returns (address yieldTokenHolder) {
        require(_opt.length == 2, "INVALID_OPT_CONTAINER");
        // opt[Masterchef, pid]
        yieldTokenHolder = address(
            new PendleSushiswapV2YieldTokenHolder(
                address(governanceManager),
                address(forge),
                _yieldToken,
                address(_opt[0]),
                _opt[1],
                _expiry
            )
        );
    }
}
