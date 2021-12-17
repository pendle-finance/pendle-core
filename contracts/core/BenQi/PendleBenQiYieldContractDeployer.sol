// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.7.6;
pragma abicoder v2;

import "../abstractV2/PendleYieldContractDeployerBaseV2.sol";
import "./PendleBenQiYieldTokenHolder.sol";
import "../../interfaces/IBenQiComptroller.sol";

contract PendleBenQiYieldContractDeployer is PendleYieldContractDeployerBaseV2 {
    IBenQiComptroller public immutable comptroller;

    constructor(
        address _governanceManager,
        bytes32 _forgeId,
        address _comptroller
    ) PendleYieldContractDeployerBaseV2(_governanceManager, _forgeId) {
        comptroller = IBenQiComptroller(_comptroller);
    }

    function deployYieldTokenHolder(
        address _yieldToken,
        uint256 _expiry,
        uint256[] calldata _tokenInfo
    ) external override onlyForge returns (address yieldTokenHolder) {
        // container[1..3] = three rewardTokens
        yieldTokenHolder = address(
            new PendleBenQiYieldTokenHolder(
                address(forge),
                _yieldToken,
                _expiry,
                address(comptroller),
                TrioTokens(address(_tokenInfo[1]), address(_tokenInfo[2]), address(_tokenInfo[3]))
            )
        );
    }
}
