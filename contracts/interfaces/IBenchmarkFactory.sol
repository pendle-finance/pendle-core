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
import "./IForgeCreator.sol";
import "./IMarketCreator.sol";


interface IBenchmarkFactory {
    /**
     * @notice Emitted when Benchmark core contract reference is changed.
     * @param core The address of the new core contract.
     **/
    event CoreSet(address core);

    /**
     * @notice Sets the Benchmark core contract reference.
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
     * @notice Emitted when a forge for an underlying yield token is created.
     * @param underlyingAsset The address of the underlying asset.
     * @param underlyingYieldToken The address of the underlying yield token.
     * @param forge The address of the created forge.
     **/
    event ForgeCreated(
        address indexed underlyingAsset,
        address indexed underlyingYieldToken,
        address indexed forge
    );

    /**
     * @notice Creates a forge given a protocol and underlying yield token.
     * @param protocol The protocol of the underlying asset
     * @param underlyingAsset Token address of the underlying asset
     * @return forge Returns the address of the newly created forge.
     **/
    function createForge(Utils.Protocols protocol, address underlyingAsset)
        external
        returns (address forge);

    /***********
     *  MARKET *
     ***********/

    /**
     * @notice Emitted when a market for a future yield token and an ERC20 token is created.
     * @param xyt The address of the tokenized future yield token as the base asset.
     * @param token The address of an ERC20 token as the quote asset.
     * @param market The address of the newly created market.
     **/
    event MarketCreated(address indexed xyt, address indexed token, address indexed market);

    /**
     * @notice Creates a market given a protocol, future yield token, and an ERC20 token.
     * @param xyt Token address of the future yield token as base asset.
     * @param token Token address of an ERC20 token as quote asset.
     * @param expiry Yield contract expiry in epoch time.
     * @return market Returns the address of the newly created market.
     **/
    function createMarket(
        address xyt,
        address token,
        uint256 expiry
    ) external returns (address market);
}
