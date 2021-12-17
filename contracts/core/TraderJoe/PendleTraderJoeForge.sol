// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.7.6;
pragma abicoder v2;

import "../../interfaces/IJoeFactory.sol";
import "../../interfaces/IPendleRewardManagerMulti.sol";
import "../../interfaces/IJoePair.sol";
import "../../interfaces/IPendleMasterChef.sol";
import "../../interfaces/IPendleTraderJoeYieldTokenHolder.sol";
import "../UniswapV2/PendleUniswapV2Forge.sol";

contract PendleTraderJoeForge is PendleUniswapV2Forge {
    using TrioTokensLib for TrioTokens;

    event MigrateMasterChef (
        address from,
        address to,
        uint256 timestamp
    );

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

    function migrateMasterChef(
        address _underlyingAsset,
        uint256[] calldata _expiries,
        address _newMasterChef,
        uint256 _newPid
    ) external onlyGovernance {
        uint256[] storage container = tokenInfo[_underlyingAsset].container;
        address oldMasterChef = address(container[0]);
        container[0] = uint256(_newMasterChef);
        container[1] = _newPid;
        for (uint32 i = 0; i < _expiries.length; ++i) {
            IPendleTraderJoeYieldTokenHolder(yieldTokenHolders[_underlyingAsset][_expiries[i]])
                .migrateMasterChef(_newMasterChef, _newPid);
        }
        emit MigrateMasterChef(oldMasterChef, _newMasterChef, block.timestamp);
    }

    function verifyToken(address _underlyingAsset, uint256[] calldata _tokenInfo)
        public
        virtual
        override
    {
        require(_tokenInfo.length == 5, "INVALID_TOKEN_INFO");
        IPendleMasterChef masterChef = IPendleMasterChef(address(_tokenInfo[0]));
        uint256 pid = _tokenInfo[1];
        require(
            address(masterChef.poolInfo(pid).lpToken) == _underlyingAsset,
            "INVALID_TOKEN_INFO"
        );

        IUniswapV2Pair pair = IUniswapV2Pair(_underlyingAsset);
        address poolAddr = UniswapV2Library.pairFor(
            pairFactory,
            pair.token0(),
            pair.token1(),
            codeHash
        );
        require(poolAddr == _underlyingAsset, "INVALID_TOKEN_ADDR");
        TrioTokens(address(_tokenInfo[2]), address(_tokenInfo[3]), address(_tokenInfo[4])).verify();
    }

    function _registerNewAssetsWithRewardManager(
        address _underlyingAsset,
        uint256[] calldata _tokenInfos
    ) internal virtual override {
        // container[0] = masterchef address
        // container[1] = pid
        // container[2..4] = three rewardTokens
        IPendleRewardManagerMulti(address(rewardManager)).registerNewUnderlyingAsset(
            _underlyingAsset,
            TrioTokens(address(_tokenInfos[2]), address(_tokenInfos[3]), address(_tokenInfos[4]))
        );
    }
}
