// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.7.6;

import "./PendleCompoundYieldTokenHolder.sol";
import "./../abstract/PendleYieldContractDeployerBase.sol";
import "./PendleCompoundForge.sol";

contract PendleCompoundYieldContractDeployer is PendleYieldContractDeployerBase {
    constructor(address _governanceManager, bytes32 _forgeId)
        PendleYieldContractDeployerBase(_governanceManager, _forgeId)
    {}

    function deployYieldTokenHolder(address yieldToken, uint256 expiry)
        external
        override
        onlyForge
        returns (address yieldTokenHolder)
    {
        yieldTokenHolder = address(
            new PendleCompoundYieldTokenHolder(
                address(governanceManager),
                address(forge),
                yieldToken,
                address(forge.rewardToken()),
                address(forge.rewardManager()),
                address(PendleCompoundForge(address(forge)).comptroller()),
                expiry
            )
        );
    }
}
