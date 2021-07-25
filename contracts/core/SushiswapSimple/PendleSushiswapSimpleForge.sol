// SPDX-License-Identifier: BUSL-1.1
// solhint-disable ordering
pragma solidity 0.7.6;
pragma abicoder v2;

import "../UniswapV2/PendleUniswapV2Forge.sol";
import "../../interfaces/IMasterChef.sol";

/*
- SushiswapSimpleForge is for tokens that are not in Sushi's Onsen program (i.e doesn't have a pid
the MasterChef)
- Sushiswap forks from Uniswap, so we just need to replace the verifyToken function & keep the rest
of the logic
*/
contract PendleSushiswapSimpleForge is PendleUniswapV2Forge {
    constructor(
        address _governanceManager,
        IPendleRouter _router,
        bytes32 _forgeId,
        address _rewardToken,
        address _rewardManager,
        address _yieldContractDeployer,
        bytes memory _codeHash
    )
        PendleUniswapV2Forge(
            _governanceManager,
            _router,
            _forgeId,
            _rewardToken,
            _rewardManager,
            _yieldContractDeployer,
            _codeHash
        )
    {}
}
