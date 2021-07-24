// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.7.6;

import "../compound/PendleCompoundLiquidityMining.sol";

contract PendleGenericLiquidityMining is PendleCompoundLiquidityMining {
    constructor(
        address _governanceManager,
        address _pausingManager,
        address _whitelist,
        address _pendleTokenAddress,
        address _pendleRouter,
        bytes32 _pendleMarketFactoryId,
        bytes32 _pendleForgeId,
        address _underlyingAsset,
        address _baseToken,
        uint256 _startTime,
        uint256 _epochDuration,
        uint256 _vestingEpochs
    )
        PendleCompoundLiquidityMining(
            _governanceManager,
            _pausingManager,
            _whitelist,
            _pendleTokenAddress,
            _pendleRouter,
            _pendleMarketFactoryId,
            _pendleForgeId,
            _underlyingAsset,
            _baseToken,
            _startTime,
            _epochDuration,
            _vestingEpochs
        )
    {}
}
