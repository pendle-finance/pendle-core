/* solhint-disable ordering*/
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

pragma solidity 0.7.6;
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

    function redeemDueInterestsMultiple(
        bytes32[] calldata _forgeIds,
        address[] calldata _underlyingAssets,
        uint256[] calldata _expiries
    ) external returns (uint256[] memory interests);

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

    function addMarketLiquidityAll(
        bytes32 marketFactoryId,
        address xyt,
        address token,
        uint256 maxInXyt,
        uint256 maxInToken,
        uint256 exactOutLp
    ) external payable;

    function addMarketLiquiditySingle(
        bytes32 marketFactoryId,
        address xyt,
        address token,
        bool forXyt,
        uint256 exactInAsset,
        uint256 minOutLp
    ) external payable;

    function removeMarketLiquidityAll(
        bytes32 marketFactoryId,
        address xyt,
        address token,
        uint256 exactInLp,
        uint256 minOutXyt,
        uint256 minOutToken
    ) external;

    function removeMarketLiquiditySingle(
        bytes32 marketFactoryId,
        address xyt,
        address token,
        bool forXyt,
        uint256 exactInLp,
        uint256 minOutAsset
    ) external;

    /**
     * @notice Creates a market given a protocol ID, future yield token, and an ERC20 token.
     * @param marketFactoryId Market Factory identifier.
     * @param xyt Token address of the future yield token as base asset.
     * @param token Token address of an ERC20 token as quote asset.
     * @return market Returns the address of the newly created market.
     **/
    function createMarket(
        bytes32 marketFactoryId,
        address xyt,
        address token
    ) external returns (address market);

    function bootstrapMarket(
        bytes32 marketFactoryId,
        address xyt,
        address token,
        uint256 initialXytLiquidity,
        uint256 initialTokenLiquidity
    ) external payable;

    function swapExactIn(
        address tokenIn,
        address tokenOut,
        uint256 inTotalAmount,
        uint256 minOutTotalAmount,
        uint256 maxPrice,
        bytes32 marketFactoryId
    ) external payable returns (uint256 outTotalAmount);

    function swapExactOut(
        address tokenIn,
        address tokenOut,
        uint256 outTotalAmount,
        uint256 maxInTotalAmount,
        uint256 maxPrice,
        bytes32 marketFactoryId
    ) external payable returns (uint256 inTotalAmount);

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

    function claimLpInterests(address[] calldata markets)
        external
        returns (uint256[] memory interests);

    function getMarketRateExactIn(
        address tokenIn,
        address tokenOut,
        uint256 inSwapAmount,
        bytes32 marketFactoryId
    ) external view returns (Swap calldata swap, uint256 totalOutput);

    function getMarketRateExactOut(
        address tokenIn,
        address tokenOut,
        uint256 outSwapAmount,
        bytes32 marketFactoryId
    ) external view returns (Swap calldata swap, uint256 totalInput);

    function getMarketReserves(
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
