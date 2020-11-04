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

    /**
     * @notice Gets the OT and XYT tokens.
     * @param _underlyingYieldToken Token address of the underlying yield token.
     * @param _expiry Yield contract expiry in epoch time.
     * @return ot The OT token references.
     * @return xyt The XYT token references.
     **/
    function getBenchmarkYieldTokens(address _underlyingYieldToken, uint256 _expiry)
        external
        view
        returns (IBenchmarkYieldToken ot, IBenchmarkYieldToken xyt);

    /***********
     *  FORGE  *
     ***********/

    /**
     * @notice Store new forge.
     * @param _forge The newly created forge address.
     **/
    function addForge (address _forge) external;

    /**
     * @notice Store new forge details.
     * @param _underlyingYieldToken Token address of the underlying yield token.
     * @param _forge The newly created forge address.
     **/
    function storeForge(address _underlyingYieldToken, address _forge) external;

    /**
     * @notice Store new OT and XYT details.
     * @param _ot The address of the new XYT.
     * @param _xyt The address of the new XYT.
     * @param _underlyingYieldToken Token address of the underlying yield token.
     * @param _forge Forge that minted the XYT.
     * @param _expiry Yield contract expiry in epoch time.
     **/
    function storeTokens(
        address _ot,
        address _xyt,
        address _underlyingYieldToken,
        address _forge,
        uint256 _expiry
    ) external;

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
     * @notice Gets a forge given the underlying asset and yield token.
     * @param _underlyingYieldToken Token address of the underlying yield token.
     * @return forge Returns the forge address.
     **/
    function getForgeFromUnderlying(address _underlyingYieldToken)
        external
        view
        returns (address forge);

    /**
     * @notice Gets a forge given an XYT.
     * @param _xyt The address of XYT token.
     * @return forge Returns the forge address.
     **/
    function getForgeFromXYT(address _xyt) external view returns (address forge);

    /**
     * @notice Gets a reference to a specific OT.
     * @param _underlyingYieldToken Token address of the underlying yield token.
     * @param _expiry Yield contract expiry in epoch time.
     * @return ot Returns the reference to an OT.
     **/
    function otTokens(address _underlyingYieldToken, uint256 _expiry)
        external
        view
        returns (IBenchmarkYieldToken ot);

    /**
     * @notice Gets a reference to a specific XYT.
     * @param _underlyingYieldToken Token address of the underlying yield token.
     * @param _expiry Yield contract expiry in epoch time.
     * @return xyt Returns the reference to an XYT.
     **/
    function xytTokens(address _underlyingYieldToken, uint256 _expiry)
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
    function getMarket(address _xyt, address _token) external view returns (address market);
}
