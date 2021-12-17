// SPDX-License-Identifier: BUSL-1.1
// solhint-disable ordering
pragma solidity 0.7.6;
pragma abicoder v2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../../interfaces/IPendleGenericForge.sol";
import "../compoundV2/PendleCompoundV2Forge.sol";
import "../../interfaces/IBenQiComptroller.sol";
import "../../interfaces/IQiToken.sol";
import "../../libraries/TrioTokensLib.sol";
import "../../interfaces/IPendleRewardManagerMulti.sol";

contract PendleBenQiForge is PendleCompoundV2Forge {
    using TrioTokensLib for TrioTokens;

    constructor(
        address _governanceManager,
        IPendleRouter _router,
        IComptroller _comptroller,
        bytes32 _forgeId,
        address _rewardToken,
        address _rewardManager,
        address _yieldContractDeployer,
        uint256[] memory _benQiAvaxInfo
    )
        PendleCompoundV2Forge(
            _governanceManager,
            _router,
            _comptroller,
            _forgeId,
            _rewardToken,
            _rewardManager,
            _yieldContractDeployer,
            address(_benQiAvaxInfo[0])
        )
    {
        require(_benQiAvaxInfo.length == 4, "INVALD_WAVAX_INFO");
        address weth = address(_router.weth());
        tokenInfo[weth].container.push(_benQiAvaxInfo[1]);
        tokenInfo[weth].container.push(_benQiAvaxInfo[2]);
        tokenInfo[weth].container.push(_benQiAvaxInfo[3]);
    }

    function verifyToken(address _underlyingAsset, uint256[] calldata _tokenInfo)
        public
        virtual
        override
    {
        require(_tokenInfo.length == 4, "INVALID_TOKEN_INFO");
        address qiTokenAddr = address(_tokenInfo[0]);
        require(
            comptroller.markets(qiTokenAddr).isListed &&
                IQiToken(qiTokenAddr).isQiToken() &&
                IQiToken(qiTokenAddr).underlying() == _underlyingAsset,
            "INVALID_TOKEN_INFO"
        );
        TrioTokens(address(_tokenInfo[1]), address(_tokenInfo[2]), address(_tokenInfo[3])).verify();
    }

    function _registerNewAssetsWithRewardManager(
        address _underlyingAsset,
        uint256[] calldata _tokenInfos
    ) internal virtual override {
        // container[1..3] = three rewardTokens
        IPendleRewardManagerMulti(address(rewardManager)).registerNewUnderlyingAsset(
            _underlyingAsset,
            TrioTokens(address(_tokenInfos[1]), address(_tokenInfos[2]), address(_tokenInfos[3]))
        );
    }
}
