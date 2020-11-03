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

import "./IBenchmark.sol";


interface IBenchmarkData {
    /**
     * @notice Emitted when the Benchmark core address has been updated.
     * @param core The address of the new core contract.
     **/
    event CoreSet(address core);

    /**
     * @notice Gets a reference to the Benchmark core contract.
     * @return Returns the core contract reference.
     **/
    function core() external view returns (IBenchmark);
    /**
     * @notice Sets the Benchmark core contract address.
     * @param _core Address of the new core contract.
     **/
    function setCore(IBenchmark _core) external;

    /***********
     *  FORGE  *
     ***********/

    /**
     * @notice Gets a forge given the underlying asset and yield token.
     * @param _underlyingAsset The address of the underlying asset.
     * @param _underlyingYieldToken Token address of the underlying yield token.
     * @return forge Returns the forge address.
     **/
    function getForgeFromUnderlying(address _underlyingAsset, address _underlyingYieldToken)
        external
        view
        returns (address forge);

    /**
     * @notice Gets a forge given the XYT token.
     * @param _xyt The address of XYT token.
     * @return forge Returns the forge address.
     **/
    function getForgeFromXYT(address _xyt)
        external
        view
        returns (address forge);

    /**
     * @notice Store new forge.
     * @param _underlyingAsset The address of the underlying asset.
     * @param _underlyingYieldToken Token address of the underlying yield token.
     * @param _forge The newly created forge address.
     **/
    function storeForge(
        address _underlyingAsset,
        address _underlyingYieldToken,
        address _forge
    ) external;

    /**
     * @notice Store new XYT.
     * @param _xyt The address of the new XYT token.
     * @param _forge Forge that minted the XYT.
     **/
    function storeXYT(
        address _xyt,
        address _forge
    ) external;

    /***********
     *  MARKET *
     ***********/

    /**
     * @notice Gets a market given a future yield token and an ERC20 token.
     * @param _xyt Token address of the future yield token as base asset.
     * @param _token Token address of an ERC20 token as quote asset.
     * @return market Returns the market address.
     **/
    function getMarket(address _xyt, address _token) external view returns (address market);

    /**
     * @notice Store new market.
     * @param _xyt Token address of the future yield token as base asset.
     * @param _token Token address of an ERC20 token as quote asset.
     * @param _market The newly created market address.
     **/
    function storeMarket(
        address _xyt,
        address _token,
        address _market
    ) external;
}
