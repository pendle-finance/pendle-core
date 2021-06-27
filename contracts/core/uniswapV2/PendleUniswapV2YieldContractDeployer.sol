// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.7.6;

import "./PendleUniswapV2YieldTokenHolder.sol";
import "../abstract/PendleYieldContractDeployerBase.sol";
import "./PendleUniswapV2Forge.sol";

contract PendleUniswapV2YieldContractDeployer is PendleYieldContractDeployerBase {
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
            new PendleUniswapV2YieldTokenHolder(
                address(governanceManager),
                address(forge),
                yieldToken,
                address(forge.rewardManager()),
                expiry
            )
        );
    }
}
