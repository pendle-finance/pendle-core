// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.7.6;

import "./../../aave/v2/PendleAaveV2YieldTokenHolder.sol";
import "./../../abstract/PendleYieldContractDeployerBase.sol";
import "./../../aave/v2/PendleAaveV2Forge.sol";

contract PendleAaveV2YieldContractDeployer is PendleYieldContractDeployerBase {
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
            new PendleAaveV2YieldTokenHolder(
                address(governanceManager),
                address(forge),
                yieldToken,
                address(forge.rewardToken()),
                address(forge.rewardManager()),
                address(PendleAaveV2Forge(address(forge)).aaveIncentivesController()),
                expiry
            )
        );
    }
}
