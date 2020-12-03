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

    function addProtocol (address _forge, bytes32 _protocolId) external;

    function forges (bytes32 _protocolId) external view returns (address);
    /***********
     *  TOKENS *
     ***********/

    /**
     * @notice Gets the OT and XYT tokens.
     * @param _underlyingYieldToken Token address of the underlying yield token.
     * @param _expiry Yield contract expiry in epoch time.
     * @return ot The OT token references.
     * @return xyt The XYT token references.
     **/
    function getBenchmarkYieldTokens(bytes32 _protocol, address _underlyingYieldToken, uint256 _expiry)
        external
        view
        returns (IBenchmarkYieldToken ot, IBenchmarkYieldToken xyt);

    /**
     * @notice Store new OT and XYT details.
     * @param _ot The address of the new XYT.
     * @param _xyt The address of the new XYT.
     * @param _underlyingYieldToken Token address of the underlying yield token.
     * @param _expiry Yield contract expiry in epoch time.
     **/
    function storeTokens(
        bytes32 _protocol,
        address _ot,
        address _xyt,
        address _underlyingYieldToken,
        /* address _forge, */
        uint256 _expiry
    ) external;


    /**
     * @notice Gets a reference to a specific OT.
     * @param _underlyingYieldToken Token address of the underlying yield token.
     * @param _expiry Yield contract expiry in epoch time.
     * @return ot Returns the reference to an OT.
     **/
    function otTokens(bytes32 _protocol, address _underlyingYieldToken, uint256 _expiry)
        external
        view
        returns (IBenchmarkYieldToken ot);

    /**
     * @notice Gets a reference to a specific XYT.
     * @param _underlyingYieldToken Token address of the underlying yield token.
     * @param _expiry Yield contract expiry in epoch time.
     * @return xyt Returns the reference to an XYT.
     **/
    function xytTokens(bytes32 _protocol, address _underlyingYieldToken, uint256 _expiry)
        external
        view
        returns (IBenchmarkYieldToken xyt);

    /***********
     *  MARKET *
     ***********/

    /**
     * @notice Store new market.
     * @param _market The newly created market address.
     **/
     function addMarket (address _market) external;



    /**
     * @notice Store new market details.
     * @param _xyt Token address of the future yield token as base asset.
     * @param _token Token address of an ERC20 token as quote asset.
     * @param _market The newly created market address.
     **/
    function storeMarket(
        bytes32 _protocol,
        address _xyt,
        address _token,
        address _market
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
     * @param _xyt Token address of the future yield token as base asset.
     * @param _token Token address of an ERC20 token as quote asset.
     * @return market Returns the market address.
     **/
    function getMarket(bytes32 _protocol, address _xyt, address _token) external view returns (address market);
}
