// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.7.6;

import "../../periphery/PermissionsV2.sol";
import "../../interfaces/IPendleYieldContractDeployerV2.sol";
import "./PendleYieldTokenHolderBaseV2.sol";
import "../../interfaces/IPendleForge.sol";
import "../../tokens/PendleFutureYieldToken.sol";
import "../../tokens/PendleOwnershipToken.sol";

contract PendleYieldContractDeployerBaseV2 is IPendleYieldContractDeployerV2, PermissionsV2 {
    bytes32 public override forgeId; // no immutable to save bytecode size
    IPendleForge public forge;

    modifier onlyForge() {
        require(msg.sender == address(forge), "ONLY_FORGE");
        _;
    }

    constructor(address _governanceManager, bytes32 _forgeId) PermissionsV2(_governanceManager) {
        forgeId = _forgeId;
    }

    function initialize(address _forgeAddress) external virtual {
        require(msg.sender == initializer, "FORBIDDEN");

        forge = IPendleForge(_forgeAddress);
        require(forge.forgeId() == forgeId, "FORGE_ID_MISMATCH");
        initializer = address(0);
    }

    function forgeFutureYieldToken(
        address _underlyingAsset,
        string memory _name,
        string memory _symbol,
        uint8 _decimals,
        uint256 _expiry
    ) external virtual override onlyForge returns (address xyt) {
        xyt = address(
            new PendleFutureYieldToken(
                address(forge.router()),
                address(forge),
                _underlyingAsset,
                forge.getYieldBearingToken(_underlyingAsset),
                _name,
                _symbol,
                _decimals,
                block.timestamp,
                _expiry
            )
        );
    }

    function forgeOwnershipToken(
        address _underlyingAsset,
        string memory _name,
        string memory _symbol,
        uint8 _decimals,
        uint256 _expiry
    ) external virtual override onlyForge returns (address ot) {
        ot = address(
            new PendleOwnershipToken(
                address(forge.router()),
                address(forge),
                _underlyingAsset,
                forge.getYieldBearingToken(_underlyingAsset),
                _name,
                _symbol,
                _decimals,
                block.timestamp,
                _expiry
            )
        );
    }

    function deployYieldTokenHolder(
        address _yieldToken,
        uint256 _expiry,
        uint256[] calldata
    ) external virtual override onlyForge returns (address yieldTokenHolder) {
        yieldTokenHolder = address(
            new PendleYieldTokenHolderBaseV2(
                address(governanceManager),
                address(forge),
                _yieldToken,
                _expiry
            )
        );
    }
}
