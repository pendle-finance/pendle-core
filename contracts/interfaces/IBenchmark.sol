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
import "./IBenchmarkData.sol";
import "./IBenchmarkMarketFactory.sol";

interface IBenchmark {
    /**
     * @notice Emitted when Benchmark and BenchmarkFactory addresses have been updated.
     * @param data The address of the new data contract.
     * @param factory The address of the new market factory contract.
     * @param treasury The address of the new treasury contract.
     **/
    event ContractsSet(address data, address factory, address treasury);

    /**
     * @notice Gets a reference to the BenchmarkData contract.
     * @return Returns the data contract reference.
     **/
    function data() external view returns (IBenchmarkData);

    /**
     * @notice Gets a reference to the BenchmarkMarketFactory.
     * @return Returns the factory reference.
     **/
    function factory() external view returns (IBenchmarkMarketFactory);

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
     * @notice Sets the Benchmark contract addresses.
     * @param _data Address of the new data contract.
     * @param _factory Address of new factory contract.
     * @param _treasury Address of new treasury contract.
     **/
    function setContracts(
        IBenchmarkData _data,
        IBenchmarkMarketFactory _factory,
        address _treasury
    ) external;

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

    // TODO: to implement renew first on forge
    // function renew(
    //     Utils.Protocols _protocol,
    //     address underlyingAsset,
    //     uint256 oldExpiry,
    //     uint256 newExpiry,
    //     address to
    // ) external returns (uint256 redeemedAmount);

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
        address _redeemTo,
        address _underlyingAsset,
        uint256 _newExpiry,
        uint256 _amountToTokenize,
        address _yieldTo
    ) external returns (uint256 redeemedAmount, address ot, address xyt);

    /***********
     *  MARKET *
     ***********/

    function addMarketLiquidity(
        bytes32 _forgeId,
        address xyt,
        address token,
        uint256 lpAmountDesired,
        uint256 xytAmountMax,
        uint256 tokenAmountMax
    ) external;

    function addMarketLiquidityXyt(
        bytes32 _forgeId,
        address xyt,
        address token,
        uint256 xytAmountDesired,
        uint256 lpAmountMin
    ) external;

    function addMarketLiquidityToken(
        bytes32 _forgeId,
        address xyt,
        address token,
        uint256 tokenAmountDesired,
        uint256 lpAmountMin
    ) external;

    function removeMarketLiquidity(
        bytes32 _forgeId,
        address xyt,
        address token,
        uint256 lpAmountDesired,
        uint256 xytAmountMin,
        uint256 tokenAmountMin
    ) external;

    function removeMarketLiquidityXyt(
        bytes32 _forgeId,
        address xyt,
        address token,
        uint256 lpAmountDesired,
        uint256 xytAmountMin
    ) external;

    function removeMarketLiquidityToken(
        bytes32 _forgeId,
        address xyt,
        address token,
        uint256 lpAmountDesired,
        uint256 tokenAmountMin
    ) external;

    function swapXytToToken(
        bytes32 _forgeId,
        address xyt,
        address token,
        uint256 xytAmountDesired,
        uint256 tokenAmountMin,
        uint256 maxPrice
    ) external returns (uint256 amount, uint256 priceAfter);

    function swapTokenToXyt(
        bytes32 _forgeId,
        address xyt,
        address token,
        uint256 tokenAmountDesired,
        uint256 xytAmountMin,
        uint256 maxPrice
    ) external returns (uint256 amount, uint256 priceAfter);

    function swapXytFromToken(
        bytes32 _forgeId,
        address xyt,
        address token,
        uint256 xytAmountDesired,
        uint256 tokenAmountMax,
        uint256 maxPrice
    ) external returns (uint256 amount, uint256 priceAfter);

    function swapTokenFromXyt(
        bytes32 _forgeId,
        address xyt,
        address token,
        uint256 tokenAmountDesired,
        uint256 xytAmountMax,
        uint256 maxPrice
    ) external returns (uint256 amount, uint256 priceAfter);

    function getMarketReserves(
        bytes32 _forgeId,
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
        address xyt,
        address token
    ) external view returns (uint256 price);

    function getMarketRateToken(
        bytes32 _forgeId,
        address xyt,
        address token
    ) external view returns (uint256 price);

    function createMarket(
        bytes32 _forgeId,
        address xyt,
        address token,
        uint256 expiry
    ) external returns (address market);

    function bootStrapMarket(
        bytes32 _forgeId,
        address xyt,
        address token,
        uint256 initialXytLiquidity,
        uint256 initialTokenLiquidity
    ) external;

    function getAllMarkets(
    ) external view returns (address[] memory);

    function getMarketByUnderlyingToken(
        bytes32 _forgeId,
        address _underlyingAsset,
        uint256 _expiry
    ) external view returns (address market);

    function getMarketTokenAddresses(
        address market
    ) external view returns(address token, address xyt);

    /*
    function addMarketLiquidity(
        address xyt,
        address token,
        uint256 xytAmountDesired,
        uint256 tokenAmountDesired,
        uint256 xytAmountMin,
        uint256 tokenAmountMin,
        address to
    )
        external
        returns (
            uint256 xytAmount,
            uint256 tokenAmount,
            uint256 liquidity
        );

    function addMarketLiquidityETH(
        address xyt,
        uint256 xytAmountDesired,
        uint256 xytAmountMin,
        uint256 ethAmountMin,
        address to
    )
        external
        payable
        returns (
            uint256 amountToken,
            uint256 amountETH,
            uint256 liquidity
        );

    function removeMarketLiquidity(
        address xyt,
        address token,
        uint256 liquidity,
        uint256 xytAmountMin,
        uint256 tokenAmountMin,
        address to
    ) external returns (uint256 xytAmount, uint256 tokenAmount);

    function removeMarketLiquidityETH(
        address token,
        uint256 liquidity,
        uint256 tokenAmountMin,
        uint256 ethAmountMin,
        address to
    ) external returns (uint256 tokenAmount, uint256 ethAmount);

    function swapTokenToToken(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);

    function swapEthToToken(
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external payable returns (uint256[] memory amounts);

    function swapTokenToEth(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);

    function getDestAmount(
        uint256 srcAmount,
        uint256 srcMarket,
        uint256 destMarket
    ) external pure returns (uint256 destAmount);

    function getSrcAmount(
        uint256 destAmount,
        uint256 srcMarket,
        uint256 destMarket
    ) external pure returns (uint256 srcAmount);

    function getDestAmounts(uint256 srcAmount, address[] calldata path)
        external
        view
        returns (uint256[] memory destAmounts);

    function getSrcAmounts(uint256 destAmount, address[] calldata path)
        external
        view
        returns (uint256[] memory srcAmounts);

    function getMarketRate(
        uint256 srcAmount,
        uint256 marketA,
        uint256 marketB
    ) external pure returns (uint256 destAmount);
    */
}
