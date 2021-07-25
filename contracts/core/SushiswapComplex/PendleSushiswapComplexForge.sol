// SPDX-License-Identifier: BUSL-1.1
// solhint-disable ordering
pragma solidity 0.7.6;
pragma abicoder v2;

import "../UniswapV2/PendleUniswapV2Forge.sol";
import "../../interfaces/IMasterChef.sol";

/*
- SushiswapComplexForge is for tokens that are in Sushiswap's Onsen program & receive their rewards
from MasterChefV1 (and not from MasterChefV2)
*/
contract PendleSushiswapComplexForge is PendleUniswapV2Forge {
    IMasterChef public immutable masterChef;

    constructor(
        address _governanceManager,
        IPendleRouter _router,
        bytes32 _forgeId,
        address _rewardToken,
        address _rewardManager,
        address _yieldContractDeployer,
        bytes memory _codeHash,
        address _masterChef
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
    {
        masterChef = IMasterChef(_masterChef);
    }

    // For Sushiswap-Complex, the tokenInfo should contain [pid]
    function verifyToken(address _underlyingAsset, uint256[] calldata _tokenInfo)
        public
        virtual
        override
    {
        require(_tokenInfo.length == 1, "INVALID_TOKEN_INFO");
        uint256 pid = _tokenInfo[0];
        // in the case of Sushiswap, _underlyingAsset == tokenAddr
        require(
            address(masterChef.poolInfo(pid).lpToken) == _underlyingAsset,
            "INVALID_TOKEN_INFO"
        );
    }
}
