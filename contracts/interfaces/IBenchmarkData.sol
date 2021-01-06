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

pragma solidity ^0.7.0;

import {Utils} from "../libraries/BenchmarkLibrary.sol";
import "./IBenchmark.sol";
import "./IBenchmarkYieldToken.sol";

interface IBenchmarkData {
    /**
     * @notice Emitted when the Benchmark core address has been updated.
     * @param core The address of the new core contract.
     **/
    event CoreSet(address core);

    /**
     * @notice Sets the Benchmark core contract address.
     * @param _core Address of the new core contract.
     **/
    function setCore(IBenchmark _core) external;

    /**
     * @notice Gets a reference to the Benchmark core contract.
     * @return Returns the core contract reference.
     **/
    function core() external view returns (IBenchmark);

    /***********
     *  FORGE  *
     ***********/

    /**
     * @notice Emitted when a forge for a protocol is added.
     * @param forgeId Forge and protocol identifier.
     * @param forgeAddress The address of the added forge.
     **/
    event ForgeAdded(bytes32 indexed forgeId, address indexed forgeAddress);

    /**
     * @notice Emitted when a forge for a protocol is removed.
     * @param forgeId Forge and protocol identifier.
     * @param forgeAddress The address of the removed forge.
     **/
    event ForgeRemoved(bytes32 indexed forgeId, address indexed forgeAddress);

    /**
     * @notice Adds a new forge for a protocol.
     * @param forgeId Forge and protocol identifier.
     * @param forgeAddress The address of the added forge.
     **/
    function addForge(bytes32 forgeId, address forgeAddress) external;

    /**
     * @notice Removes a forge.
     * @param forgeId Forge and protocol identifier.
     **/
    function removeForge(bytes32 forgeId) external;

    /**
     * @notice Store new OT and XYT details.
     * @param forgeId Forge and protocol identifier.
     * @param ot The address of the new XYT.
     * @param xyt The address of the new XYT.
     * @param underlyingAsset Token address of the underlying asset.
     * @param expiry Yield contract expiry in epoch time.
     **/
    function storeTokens(
        bytes32 forgeId,
        address ot,
        address xyt,
        address underlyingAsset,
        uint256 expiry
    ) external;

    /**
     * @notice Gets the OT and XYT tokens.
     * @param forgeId Forge and protocol identifier.
     * @param underlyingYieldToken Token address of the underlying yield token.
     * @param expiry Yield contract expiry in epoch time.
     * @return ot The OT token references.
     * @return xyt The XYT token references.
     **/
    function getBenchmarkYieldTokens(
        bytes32 forgeId,
        address underlyingYieldToken,
        uint256 expiry
    ) external view returns (IBenchmarkYieldToken ot, IBenchmarkYieldToken xyt);

    /**
     * @notice Gets the identifier of the forge.
     * @param forgeAddress The forge's address.
     * @return forgeId Returns the forge identifier.
     **/
    function getForgeId(address forgeAddress) external view returns (bytes32 forgeId);

    /**
     * @notice Gets a forge given the identifier.
     * @param forgeId Forge and protocol identifier.
     * @return forgeAddress Returns the forge address.
     **/
    function getForgeAddress(bytes32 forgeId) external view returns (address forgeAddress);

    /**
     * @notice Checks if an XYT token is valid.
     * @param xyt Address of the XYT toke.
     * @return True if valid, false otherwise.
     **/
    function isValidXYT(address xyt) external view returns (bool);

    /**
     * @notice Gets a reference to a specific OT.
     * @param forgeId Forge and protocol identifier.
     * @param underlyingYieldToken Token address of the underlying yield token.
     * @param expiry Yield contract expiry in epoch time.
     * @return ot Returns the reference to an OT.
     **/
    function otTokens(
        bytes32 forgeId,
        address underlyingYieldToken,
        uint256 expiry
    ) external view returns (IBenchmarkYieldToken ot);

    /**
     * @notice Gets a reference to a specific XYT.
     * @param forgeId Forge and protocol identifier.
     * @param underlyingAsset Token address of the underlying asset
     * @param expiry Yield contract expiry in epoch time.
     * @return xyt Returns the reference to an XYT.
     **/
    function xytTokens(
        bytes32 forgeId,
        address underlyingAsset,
        uint256 expiry
    ) external view returns (IBenchmarkYieldToken xyt);

    /***********
     *  MARKET *
     ***********/

    event MarketPairAdded(address indexed market, address indexed xyt, address indexed token);

    function addMarketFactory(
        bytes32 forgeId,
        bytes32 marketFactoryId,
        address _marketFactoryAddress
    ) external;

    function addMarket(
        bytes32 forgeId,
        bytes32 marketFactoryId,
        address market,
        address xyt,
        address token
    ) external;

    function exitFee() external view returns (uint256);

    function swapFee() external view returns (uint256);

    function setMarketFees(uint256 _swapFee, uint256 _exitFee) external;

    function getMarketFactoryAddress(bytes32, bytes32) external view returns (address);

    /**
     * @notice Store new market details.
     * @param forgeId Forge and protocol identifier.
     * @param xyt Token address of the future yield token as base asset.
     * @param token Token address of an ERC20 token as quote asset.
     * @param market The newly created market address.
     **/
    function storeMarket(
        bytes32 forgeId,
        bytes32 marketFactoryId,
        address xyt,
        address token,
        address market
    ) external;

    /**
     * @notice Displays the number of markets currently existing.
     * @return Returns markets length,
     **/
    function allMarketsLength() external view returns (uint256);

    /**
     * @notice Gets all the markets.
     * @return Returns an array of all markets.
     **/
    function getAllMarkets() external view returns (address[] calldata);

    /**
     * @notice Gets a market given a future yield token and an ERC20 token.
     * @param forgeId Forge and protocol identifier.
     * @param xyt Token address of the future yield token as base asset.
     * @param token Token address of an ERC20 token as quote asset.
     * @return market Returns the market address.
     **/
    function getMarket(
        bytes32 forgeId,
        bytes32 marketFactoryId,
        address xyt,
        address token
    ) external view returns (address market);
}
