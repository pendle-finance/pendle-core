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

import "./IBenchmarkCommon.sol";


interface IBenchmarkFactory is IBenchmarkCommon {
    /**
     * @notice Sets the treasury contract address where fees will be sent to.
     **/
    function setTreasury(address) external;

    /**
     * @notice Gets the core Benchmark contract address.
     * @return Address of the core contract.
     **/
    function core() external view returns (address);

    /**
     * @notice Gets the treasury contract address where fees are being sent to.
     * @return Address of the treasury contract.
     **/
    function treasury() external view returns (address);

    /***********
     *  FORGE  *
     ***********/

    /**
     * @notice Emitted when a forge for an underlying yield token is created.
     * @param underlyingYieldToken The address of the underlying yield token.
     * @param forge The address of the created forge.
     **/
    event ForgeCreated(address indexed underlyingYieldToken, address forge);

    /**
     * @notice Displays the number of forges currently existing.
     * @return Returns forges length,
     **/
    function allForgesLength() external view returns (uint256);

    /**
     * @notice Gets all the forges.
     * @return Returns an array of all forges.
     **/
    function getAllForges() external view returns (address[] calldata);

    /**
     * @notice Gets a forge given an underlying yield token.
     * @param underlyingYieldToken Token address of the underlying yield token.
     * @return forge Returns the forge address.
     **/
    function getForge(address underlyingYieldToken) external view returns (address forge);

    /**
     * @notice Creates a forge given an underlying yield token.
     * @param underlyingYieldToken Token address of the underlying yield token.
     * @return forge Returns the address of the newly created forge.
     **/
    function createForge(address underlyingYieldToken) external returns (address forge);

    /****************************
     *  AUTOMATED MARKET MAKER  *
     ****************************/

    /**
     * @notice Emitted when a market for a future yield token and an ERC20 token is created.
     * @param xyt The address of the tokenized future yield token as the base asset.
     * @param token The address of an ERC20 token as the quote asset.
     * @param treasury Contract address where fees are being sent to.
     * @param market The address of the newly created market.
     **/
    event MarketCreated(
        address indexed xyt,
        address indexed token,
        address treasury,
        address market
    );

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
     * @param xyt Token address of the future yield token as base asset.
     * @param token Token address of an ERC20 token as quote asset.
     * @return market Returns the market address.
     **/
    function getMarket(address xyt, address token) external view returns (address market);

    /**
     * @notice Creates a market given a future yield token and an ERC20 token.
     * @param xyt Token address of the future yield token as base asset.
     * @param token Token address of an ERC20 token as quote asset.
     * @return market Returns the address of the newly created market.
     **/
    function createMarket(address xyt, address token) external returns (address market);
}
