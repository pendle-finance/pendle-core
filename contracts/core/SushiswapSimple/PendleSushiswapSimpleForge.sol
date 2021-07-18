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
    bytes private constant CODE_HASH =
        hex"e18a34eb0e04b04f7a0ac29a6e80748dca96319b42c54d679cb821dca90c6303";

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

    function verifyToken(address _underlyingAsset, uint256[] calldata _tokenInfo)
        public
        virtual
        override
    {
        // in the case of Sushiswap, _underlyingAsset == tokenAddr
        require(_tokenInfo.length == 0, "INVALID_TOKEN_INFO");
        IUniswapV2Pair pair = IUniswapV2Pair(_underlyingAsset);

        address poolAddr = UniswapV2Library.pairFor(
            pair.factory(),
            pair.token0(),
            pair.token1(),
            CODE_HASH
        );
        require(poolAddr == _underlyingAsset, "INVALID_TOKEN_ADDR");
    }
}
