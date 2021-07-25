// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.7.6;

import "../abstractV2/PendleYieldContractDeployerBaseV2.sol";
import "./PendleCompoundV2YieldTokenHolder.sol";
import "./PendleCompoundV2Forge.sol";

contract PendleCompoundV2YieldContractDeployer is PendleYieldContractDeployerBaseV2 {
    constructor(address _governanceManager, bytes32 _forgeId)
        PendleYieldContractDeployerBaseV2(_governanceManager, _forgeId)
    {}

    function deployYieldTokenHolder(
        address _yieldToken,
        uint256 _expiry,
        uint256[] calldata
    ) external override onlyForge returns (address yieldTokenHolder) {
        yieldTokenHolder = address(
            new PendleCompoundV2YieldTokenHolder(
                address(governanceManager),
                address(forge),
                _yieldToken,
                address(PendleCompoundV2Forge(address(forge)).comptroller()),
                _expiry
            )
        );
    }
}
