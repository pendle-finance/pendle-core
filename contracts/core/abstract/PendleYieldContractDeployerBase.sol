// SPDX-License-Identifier: MIT
/*
 * MIT License
 * ===========
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 */
pragma solidity 0.7.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../../periphery/Permissions.sol";
import "../../periphery/Withdrawable.sol";
import "../../interfaces/IPendleYieldContractDeployer.sol";
import "../../interfaces/IPendleForge.sol";
import "../../tokens/PendleFutureYieldToken.sol";
import "../../tokens/PendleOwnershipToken.sol";
import "../../libraries/FactoryLib.sol";


// Each PendleYieldContractDeployer is specific for exactly one forge
abstract contract PendleYieldContractDeployerBase is IPendleYieldContractDeployer, Permissions, Withdrawable {
    bytes32 public override forgeId;
    IPendleForge public forge;

    modifier onlyForge() {
        require(msg.sender == address(forge), "ONLY_FORGE");
        _;
    }

    constructor(address _governance, bytes32 _forgeId) Permissions(_governance) {
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
    ) external override returns (address xyt) {
        IERC20 yieldToken = IERC20(forge.getYieldBearingToken(_underlyingAsset));

        xyt = Factory.createContract(
            type(PendleFutureYieldToken).creationCode,
            abi.encodePacked(yieldToken, _underlyingAsset),
            abi.encode(
                _underlyingAsset,
                yieldToken,
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
    ) external override returns (address ot) {
        IERC20 yieldToken = IERC20(forge.getYieldBearingToken(_underlyingAsset));

        ot = Factory.createContract(
            type(PendleOwnershipToken).creationCode,
            abi.encodePacked(yieldToken, _underlyingAsset),
            abi.encode(
                _underlyingAsset,
                yieldToken,
                _name,
                _symbol,
                _decimals,
                block.timestamp,
                _expiry
            )
        );
    }

    function deployYieldTokenHolder(address yieldToken, address ot) external override virtual returns (address yieldTokenHolder);
}
