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

import "../interfaces/IWETH.sol";
import "./IPendleData.sol";
import "./IPendleMarketFactory.sol";

interface IPendleRouter {
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
     * @notice Gets a reference to the PendleData contract.
     * @return Returns the data contract reference.
     **/
    function data() external view returns (IPendleData);

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
    function addMarketFactory(bytes32 marketFactoryId, address marketFactoryAddress) external;

    function addMarketLiquidity(
        bytes32 forgeId,
        bytes32 marketFactoryId,
        address xyt,
        address token,
        uint256 maxInXyt,
        uint256 maxInToken,
        uint256 exactOutLp
    ) external payable;

    function addMarketLiquidityETH(
        bytes32 forgeId,
        bytes32 marketFactoryId,
        address xyt,
        uint256 exactInEth,
        uint256 minOutLp
    ) external payable;

    function addMarketLiquidityToken(
        bytes32 forgeId,
        bytes32 marketFactoryId,
        address xyt,
        address token,
        uint256 exactInToken,
        uint256 minOutLp
    ) external;

    function addMarketLiquidityXyt(
        bytes32 forgeId,
        bytes32 marketFactoryId,
        address xyt,
        address token,
        uint256 exactInXyt,
        uint256 minOutLp
    ) external;

    function removeMarketLiquidity(
        bytes32 forgeId,
        bytes32 marketFactoryId,
        address xyt,
        address token,
        uint256 exactInLp,
        uint256 minOutXyt,
        uint256 minOutToken
    ) external;

    function removeMarketLiquidityETH(
        bytes32 forgeId,
        bytes32 marketFactoryId,
        address xyt,
        uint256 exactInLp,
        uint256 minOutEth
    ) external;

    function removeMarketLiquidityToken(
        bytes32 forgeId,
        bytes32 marketFactoryId,
        address xyt,
        address token,
        uint256 exactInLp,
        uint256 minOutToken
    ) external;

    function removeMarketLiquidityXyt(
        bytes32 forgeId,
        bytes32 marketFactoryId,
        address xyt,
        address token,
        uint256 exactInLp,
        uint256 minOutXyt
    ) external;

    /**
     * @notice Creates a market given a protocol ID, future yield token, and an ERC20 token.
     * @param forgeId Forge identifier.
     * @param marketFactoryId Market Factory identifier.
     * @param xyt Token address of the future yield token as base asset.
     * @param token Token address of an ERC20 token as quote asset.
     * @return market Returns the address of the newly created market.
     **/
    function createMarket(
        bytes32 forgeId,
        bytes32 marketFactoryId,
        address xyt,
        address token
    ) external returns (address market);

    function bootstrapMarket(
        bytes32 forgeId,
        bytes32 marketFactoryId,
        address xyt,
        address token,
        uint256 initialXytLiquidity,
        uint256 initialTokenLiquidity
    ) external;

    function batchExactSwapIn(
        Swap[] memory swaps,
        address tokenIn,
        address tokenOut,
        uint256 inTotalAmount,
        uint256 minOutTotalAmount
    ) external payable returns (uint256 outTotalAmount);

    function batchSwapExactOut(
        Swap[] memory swaps,
        address tokenIn,
        address tokenOut,
        uint256 maxInTotalAmount
    ) external payable returns (uint256 inTotalAmount);

    function swapExactIn(
        address tokenIn,
        address tokenOut,
        uint256 inTotalAmount,
        uint256 minOutTotalAmount,
        uint256 numMarkets
    ) external payable returns (uint256 amount);

    function swapExactOut(
        address tokenIn,
        address tokenOut,
        uint256 outTotalAmount,
        uint256 maxInTotalAmount,
        uint256 numMarkets
    ) external payable returns (uint256 amount);

    function swapPathExactIn(
        Swap[][] memory swapPath,
        address tokenIn,
        address tokenOut,
        uint256 inTotalAmount,
        uint256 minOutTotalAmount
    ) external payable returns (uint256 outTotalAmount);

    function swapPathExactOut(
        Swap[][] memory swapPath,
        address tokenIn,
        address tokenOut,
        uint256 maxInTotalAmount
    ) external payable returns (uint256 inTotalAmount);

    function getMarketRateExactIn(
        address tokenIn,
        address tokenOut,
        uint256 inSwapAmount,
        uint256 numMarkets
    ) external view returns (Swap[] memory swaps, uint256 totalOutput);

    function getMarketRateExactOut(
        address tokenIn,
        address tokenOut,
        uint256 outSwapAmount,
        uint256 numMarkets
    ) external view returns (Swap[] memory swaps, uint256 totalInput);

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
