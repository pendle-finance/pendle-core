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
pragma experimental ABIEncoderV2;

import {Utils} from "../libraries/BenchmarkLibrary.sol";
import "../interfaces/IWETH.sol";
import "./IBenchmarkData.sol";
import "./IBenchmarkMarketFactory.sol";

interface IBenchmark {
    struct Market {
        address market;
        uint256 tokenBalanceIn;
        uint256 tokenWeightIn;
        uint256 tokenBalanceOut;
        uint256 tokenWeightOut;
        uint256 swapFee;
        uint256 effectiveLiquidity;
    }

    struct Swap {
        address market;
        address tokenIn;
        address tokenOut;
        uint256 swapAmount;
        uint256 limitReturnAmount;
        uint256 maxPrice;
    }

    /**
     * @notice Emitted when Benchmark and BenchmarkFactory addresses have been updated.
     * @param treasury The address of the new treasury contract.
     **/
    event TreasurySet(address treasury);

    /**
     * @notice Sets the BenchmarkTreasury contract addresses.
     * @param newtreasury Address of new treasury contract.
     **/
    function setTreasury(address newtreasury) external;

    /**
     * @notice Gets a reference to the BenchmarkData contract.
     * @return Returns the data contract reference.
     **/
    function data() external view returns (IBenchmarkData);

    /**
     * @notice Gets the treasury contract address where fees are being sent to.
     * @return Address of the treasury contract.
     **/
    function treasury() external view returns (address);

    /**
     * @notice Gets a reference of the WETH9 token contract address.
     * @return WETH token reference.
     **/
    function weth() external view returns (IWETH);

    /***********
     *  FORGE  *
     ***********/

    /**
     * @notice Adds a new forge for a protocol.
     * @param forgeId Forge and protocol identifier.
     * @param forge The address of the added forge.
     **/
    function addForge(bytes32 forgeId, address forge) external;

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

    function redeemDueInterests(
        bytes32 forgeId,
        address underlyingAsset,
        uint256 expiry
    ) external returns (uint256 interests);

    function redeemUnderlying(
        bytes32 forgeId,
        address underlyingAsset,
        uint256 expiry,
        uint256 amountToRedeem,
        address to
    ) external returns (uint256 redeemedAmount);

    function renewYield(
        bytes32 forgeId,
        uint256 oldExpiry,
        address underlyingAsset,
        uint256 newExpiry,
        uint256 amountToTokenize,
        address yieldTo
    )
        external
        returns (
            uint256 redeemedAmount,
            address ot,
            address xyt
        );

    function tokenizeYield(
        bytes32 forgeId,
        address underlyingAsset,
        uint256 expiry,
        uint256 amountToTokenize,
        address to
    ) external returns (address ot, address xyt);

    /***********
     *  MARKET *
     ***********/
    function addMarketFactory(
        bytes32 forgeId,
        bytes32 marketFactoryId,
        address marketFactoryAddress
    ) external;

    function addMarketLiquidity(
        bytes32 forgeId,
        bytes32 marketFactoryId,
        address xyt,
        address token,
        uint256 lpAmountDesired,
        uint256 xytAmountMax,
        uint256 tokenAmountMax
    ) external payable;

    function addMarketLiquidityETH(
        bytes32 forgeId,
        bytes32 marketFactoryId,
        address xyt,
        uint256 ethAmountDesired,
        uint256 lpAmountMin
    ) external payable;

    function addMarketLiquidityToken(
        bytes32 forgeId,
        bytes32 marketFactoryId,
        address xyt,
        address token,
        uint256 tokenAmountDesired,
        uint256 lpAmountMin
    ) external;

    function addMarketLiquidityXyt(
        bytes32 forgeId,
        bytes32 marketFactoryId,
        address xyt,
        address token,
        uint256 xytAmountDesired,
        uint256 lpAmountMin
    ) external;

    function removeMarketLiquidity(
        bytes32 forgeId,
        bytes32 marketFactoryId,
        address xyt,
        address token,
        uint256 lpAmountDesired,
        uint256 xytAmountMin,
        uint256 tokenAmountMin
    ) external;

    function removeMarketLiquidityETH(
        bytes32 forgeId,
        bytes32 marketFactoryId,
        address xyt,
        uint256 lpAmountDesired,
        uint256 ethAmountMin
    ) external;

    function removeMarketLiquidityToken(
        bytes32 forgeId,
        bytes32 marketFactoryId,
        address xyt,
        address token,
        uint256 lpAmountDesired,
        uint256 tokenAmountMin
    ) external;

    function removeMarketLiquidityXyt(
        bytes32 forgeId,
        bytes32 marketFactoryId,
        address xyt,
        address token,
        uint256 lpAmountDesired,
        uint256 xytAmountMin
    ) external;

    function batchExactSwapIn(
        Swap[] memory swaps,
        IERC20 tokenIn,
        IERC20 tokenOut,
        uint256 totalAmountIn,
        uint256 minTotalAmountOut
    ) external payable returns (uint256 totalAmountOut);

    function batchSwapExactOut(
        Swap[] memory swaps,
        IERC20 tokenIn,
        IERC20 tokenOut,
        uint256 maxTotalAmountIn
    ) external payable returns (uint256 totalAmountIn);

    function multStepBatchExactSwapIn(
        Swap[][] memory swapSequences,
        IERC20 tokenIn,
        IERC20 tokenOut,
        uint256 totalAmountIn,
        uint256 minTotalAmountOut
    ) external payable returns (uint256 totalAmountOut);

    function multStepBatchExactSwapOut(
        Swap[][] memory swapSequences,
        IERC20 tokenIn,
        IERC20 tokenOut,
        uint256 maxTotalAmountIn
    ) external payable returns (uint256 totalAmountIn);

    function swapExactIn(
        address tokenIn,
        address tokenOut,
        uint256 totalAmountIn,
        uint256 minTotalAmountOut,
        uint256 numMarkets
    )
        external payable returns (uint amount);

    function swapExactOut(
        address tokenIn,
        address tokenOut,
        uint256 totalAmountOut,
        uint256 maxTotalAmountIn,
        uint256 numMarkets
    )
        external payable returns (uint amount);

    function getAllMarkets() external view returns (address[] memory);

    function getMarketByUnderlyingToken(
        bytes32 _forgeId,
        bytes32 _marketFactoryId,
        address _underlyingAsset,
        uint256 _expiry
    ) external view returns (address market);

    function getMarketRateExactIn(
        address tokenIn,
        address tokenOut,
        uint256 swapAmount,
        uint256 nMarkets
    )
        external view returns (Swap[] memory swaps, uint totalOutput);

    function getMarketRateExactOut(
        address tokenIn,
        address tokenOut,
        uint swapAmount,
        uint numMarkets
    )
        external view returns (Swap[] memory swaps, uint totalOutput);

    function getMarketReserves(
        bytes32 forgeId,
        bytes32 marketFactoryId,
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

    function getMarketTokenAddresses(address market)
        external
        view
        returns (address token, address xyt);
}
