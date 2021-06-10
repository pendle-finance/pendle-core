// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.7.6;

import "../../periphery/PermissionsV2.sol";
import "../../interfaces/IPendleYieldContractDeployer.sol";
import "../../interfaces/IPendleForge.sol";
import "../../tokens/PendleFutureYieldToken.sol";
import "../../tokens/PendleOwnershipToken.sol";

// Each PendleYieldContractDeployer is specific for exactly one forge
abstract contract PendleYieldContractDeployerBase is IPendleYieldContractDeployer, PermissionsV2 {
    bytes32 public immutable override forgeId;
    IPendleForge public forge;

    modifier onlyForge() {
        require(msg.sender == address(forge), "ONLY_FORGE");
        _;
    }

    constructor(address _governanceManager, bytes32 _forgeId) PermissionsV2(_governanceManager) {
        forgeId = _forgeId;
    }

    function initialize(address _forgeAddress) external {
        require(msg.sender == initializer, "FORBIDDEN");
        require(address(_forgeAddress) != address(0), "ZERO_ADDRESS");

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
    ) external override onlyForge returns (address xyt) {
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
    ) external override onlyForge returns (address ot) {
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

    function deployYieldTokenHolder(address yieldToken, uint256 expiry)
        external
        virtual
        override
        returns (address yieldTokenHolder);
}
