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

import {Utils} from "../libraries/PendleLibrary.sol";
import "./IPendleData.sol";
import "./IPendleMarketFactory.sol";

interface IPendle {
    /**
     * @notice Emitted when Pendle and PendleFactory addresses have been updated.
     * @param data The address of the new data contract.
     * @param treasury The address of the new treasury contract.
     **/
    event ContractsSet(address data, address treasury);

    /**
     * @notice Gets a reference to the PendleData contract.
     * @return Returns the data contract reference.
     **/
    function data() external view returns (IPendleData);

    /**
     * @notice Gets the treasury contract address where fees are being sent to.
     * @return Address of the treasury contract.
     **/
    function treasury() external view returns (address);

    /**
     * @notice Gets the address of the WETH9 token contract address.
     * @return WETH token address.
     **/
    function weth() external view returns (address);

    /**
     * @notice Sets the Pendle contract addresses.
     * @param _data Address of the new data contract.
     * @param _treasury Address of new treasury contract.
     **/
    function setContracts(IPendleData _data, address _treasury) external;

    /***********
     *  FORGE  *
     ***********/

    /**
     * @notice Adds a new forge for a protocol.
     * @param forgeId Forge and protocol identifier.
     * @param forge The address of the added forge.
     **/
    function addForge(bytes32 forgeId, address forge) external;

    /**
     * @notice Removes a forge.
     * @param forgeId Forge and protocol identifier.
     **/
    function removeForge(bytes32 forgeId) external;

    function newYieldContracts(
        bytes32 forgeId,
        address underlyingAsset,
        uint256 expiry
    ) external returns (address ot, address xyt);

    function redeemAfterExpiry(
        bytes32 forgeId,
        address underlyingAsset,
        uint256 expiry,
        address to
    ) external returns (uint256 redeemedAmount);

    function redeemUnderlying(
        bytes32 forgeId,
        address underlyingAsset,
        uint256 expiry,
        uint256 amountToRedeem,
        address to
    ) external returns (uint256 redeemedAmount);

    function redeemDueInterests(
        bytes32 _forgeId,
        address _underlyingAsset,
        uint256 _expiry
    ) external returns (uint256 interests);

    function tokenizeYield(
        bytes32 forgeId,
        address underlyingAsset,
        uint256 expiry,
        uint256 amountToTokenize,
        address to
    ) external returns (address ot, address xyt);

    function renewYield(
        bytes32 _forgeId,
        uint256 _oldExpiry,
        address _underlyingAsset,
        uint256 _newExpiry,
        uint256 _amountToTokenize,
        address _yieldTo
    )
        external
        returns (
            uint256 redeemedAmount,
            address ot,
            address xyt
        );

    /***********
     *  MARKET *
     ***********/
    function addMarketFactory(
        bytes32 _forgeId,
        bytes32 _marketFactoryId,
        address _marketFactoryAddress
    ) external;

    function addMarketLiquidity(
        bytes32 _forgeId,
        bytes32 _marketFactoryId,
        address xyt,
        address token,
        uint256 exactOutLp,
        uint256 maxInXyt,
        uint256 maxInToken
    ) external;

    function addMarketLiquidityXyt(
        bytes32 _forgeId,
        bytes32 _marketFactoryId,
        address xyt,
        address token,
        uint256 exactInXyt,
        uint256 minOutLp
    ) external;

    function addMarketLiquidityToken(
        bytes32 _forgeId,
        bytes32 _marketFactoryId,
        address xyt,
        address token,
        uint256 exactInToken,
        uint256 minOutLp
    ) external;

    function removeMarketLiquidity(
        bytes32 _forgeId,
        bytes32 _marketFactoryId,
        address xyt,
        address token,
        uint256 exactInLp,
        uint256 minOutXyt,
        uint256 minOutToken
    ) external;

    function removeMarketLiquidityXyt(
        bytes32 _forgeId,
        bytes32 _marketFactoryId,
        address xyt,
        address token,
        uint256 exactInLp,
        uint256 minOutXyt
    ) external;

    function removeMarketLiquidityToken(
        bytes32 _forgeId,
        bytes32 _marketFactoryId,
        address xyt,
        address token,
        uint256 exactInLp,
        uint256 minOutToken
    ) external;

    function swapXytToToken(
        bytes32 _forgeId,
        bytes32 _marketFactoryId,
        address xyt,
        address token,
        uint256 exactInXyt,
        uint256 minOutToken,
        uint256 maxPrice
    ) external returns (uint256 amount, uint256 priceAfter);

    function swapTokenToXyt(
        bytes32 _forgeId,
        bytes32 _marketFactoryId,
        address xyt,
        address token,
        uint256 exactInToken,
        uint256 minOutXyt,
        uint256 maxPrice
    ) external returns (uint256 amount, uint256 priceAfter);

    function swapXytFromToken(
        bytes32 _forgeId,
        bytes32 _marketFactoryId,
        address xyt,
        address token,
        uint256 exactOutXyt,
        uint256 maxInToken,
        uint256 maxPrice
    ) external returns (uint256 amount, uint256 priceAfter);

    function swapTokenFromXyt(
        bytes32 _forgeId,
        bytes32 _marketFactoryId,
        address xyt,
        address token,
        uint256 exactOutToken,
        uint256 maxInXyt,
        uint256 maxPrice
    ) external returns (uint256 amount, uint256 priceAfter);

    function getMarketReserves(
        bytes32 _forgeId,
        bytes32 _marketFactoryId,
        address xyt,
        address token
    )
        external
        view
        returns (
            uint256 xytAmount,
            uint256 tokenAmount,
            uint256 currentTime
        );

    function getMarketRateXyt(
        bytes32 _forgeId,
        bytes32 _marketFactoryId,
        address xyt,
        address token
    ) external view returns (uint256 price);

    function getMarketRateToken(
        bytes32 _forgeId,
        bytes32 _marketFactoryId,
        address xyt,
        address token
    ) external view returns (uint256 price);

    function createMarket(
        bytes32 _forgeId,
        bytes32 _marketFactoryId,
        address xyt,
        address token,
        uint256 expiry
    ) external returns (address market);

    function bootStrapMarket(
        bytes32 _forgeId,
        bytes32 _marketFactoryId,
        address xyt,
        address token,
        uint256 initialXytLiquidity,
        uint256 initialTokenLiquidity
    ) external;

    function getAllMarkets() external view returns (address[] memory);

    function getMarketByUnderlyingToken(
        bytes32 _forgeId,
        bytes32 _marketFactoryId,
        address _underlyingAsset,
        uint256 _expiry
    ) external view returns (address market);

    function getMarketTokenAddresses(address market)
        external
        view
        returns (address token, address xyt);
}
