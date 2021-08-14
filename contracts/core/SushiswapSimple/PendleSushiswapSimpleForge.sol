// SPDX-License-Identifier: BUSL-1.1
// solhint-disable ordering
pragma solidity 0.7.6;
pragma abicoder v2;

import "../UniswapV2/PendleUniswapV2Forge.sol";
import "../../interfaces/IMasterChef.sol";

/*
- SushiswapSimpleForge is for tokens that are not in Sushi's Onsen program (i.e doesn't have a pid
the MasterChef)
*/
contract PendleSushiswapSimpleForge is PendleUniswapV2Forge {
    constructor(
        address _governanceManager,
        IPendleRouter _router,
        bytes32 _forgeId,
        address _rewardToken,
        address _rewardManager,
        address _yieldContractDeployer,
        bytes32 _codeHash,
        address _pairFactory
    )
        PendleUniswapV2Forge(
            _governanceManager,
            _router,
            _forgeId,
            _rewardToken,
            _rewardManager,
            _yieldContractDeployer,
            _codeHash,
            _pairFactory
        )
    {}
}
