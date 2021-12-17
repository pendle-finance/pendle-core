// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.7.6;
pragma abicoder v2;

import "../abstractV2/PendleYieldContractDeployerBaseV2.sol";
import "./PendleTraderJoeYieldTokenHolder.sol";

contract PendleTraderJoeYieldContractDeployer is PendleYieldContractDeployerBaseV2 {
    constructor(address _governanceManager, bytes32 _forgeId)
        PendleYieldContractDeployerBaseV2(_governanceManager, _forgeId)
    {}

    function deployYieldTokenHolder(
        address _yieldToken,
        uint256 _expiry,
        uint256[] calldata _container
    ) external override onlyForge returns (address yieldTokenHolder) {
        // container[0] = masterchef address
        // container[1] = pid
        // container[2..4] = three rewardTokens
        yieldTokenHolder = address(
            new PendleTraderJoeYieldTokenHolder(
                address(forge),
                _yieldToken,
                _expiry,
                address(_container[0]),
                _container[1],
                TrioTokens(address(_container[2]), address(_container[3]), address(_container[4]))
            )
        );
    }
}
