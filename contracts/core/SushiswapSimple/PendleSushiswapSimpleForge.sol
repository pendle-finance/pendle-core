// SPDX-License-Identifier: BUSL-1.1
// solhint-disable ordering
pragma solidity 0.7.6;
pragma abicoder v2;

import "../UniswapV2/PendleUniswapV2Forge.sol";
import "../../interfaces/IMasterChef.sol";

contract PendleSushiswapSimpleForge is PendleUniswapV2Forge {
    constructor(
        address _governanceManager,
        IPendleRouter _router,
        bytes32 _forgeId,
        address _rewardToken,
        address _rewardManager,
        address _yieldContractDeployer
    )
        PendleUniswapV2Forge(
            _governanceManager,
            _router,
            _forgeId,
            _rewardToken,
            _rewardManager,
            _yieldContractDeployer
        )
    {}

    // For SushiswapSimple, we will inherit the verifyToken function of Uniswap
}
