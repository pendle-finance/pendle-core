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
import "./IPendleStructs.sol";
import "./IPendleMarketFactory.sol";

interface IPendleRouter is IPendleStructs {
    /**
     * @notice Emitted when a swap happens on the market.
     * @param trader The address of msg.sender.
     * @param inToken The input token.
     * @param outToken The output token.
     * @param exactIn The exact amount being traded.
     * @param exactOut The exact amount received.
     * @param market The market address.
     **/
    event SwapEvent(
        address indexed trader,
        address inToken,
        address outToken,
        uint256 exactIn,
        uint256 exactOut,
        address market
    );

    /**
     * @dev Emitted when user adds liquidity
     * @param sender The user who added liquidity.
     * @param token0Amount the amount of token0 (xyt) provided by user
     * @param token1Amount the amount of token1 provided by user
     * @param market The market address.
     */
    event Join(address indexed sender, uint256 token0Amount, uint256 token1Amount, address market);

    /**
     * @dev Emitted when user removes liquidity
     * @param sender The user who removed liquidity.
     * @param token0Amount the amount of token0 (xyt) given to user
     * @param token1Amount the amount of token1 given to user
     * @param market The market address.
     */
    event Exit(address indexed sender, uint256 token0Amount, uint256 token1Amount, address market);

    /**
     * @dev Emitted when new forge is added
     * @param forgeId Human Readable Forge ID in Bytes
     * @param forgeAddress The Forge Address
     */
    event NewForge(bytes32 indexed forgeId, address indexed forgeAddress);

    /**
     * @dev Emitted when new forge is added
     * @param marketFactoryId Human Readable Market Factory ID in Bytes
     * @param marketFactoryAddress The Market Factory Address
     */
    event NewMarketFactory(bytes32 indexed marketFactoryId, address indexed marketFactoryAddress);

    struct Swap {
        uint256 swapAmount;
        uint256 limitReturnAmount;
        uint256 maxPrice;
        address market;
        address tokenIn;
        address tokenOut;
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
            address xyt,
            uint256 amountTokenMinted
        );

    function tokenizeYield(
        bytes32 forgeId,
        address underlyingAsset,
        uint256 expiry,
        uint256 amountToTokenize,
        address to
    )
        external
        returns (
            address ot,
            address xyt,
            uint256 amountTokenMinted
        );

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
    ) external returns (uint256 exactOutXyt, uint256 exactOutToken);

    function removeMarketLiquiditySingle(
        bytes32 marketFactoryId,
        address xyt,
        address token,
        bool forXyt,
        uint256 exactInLp,
        uint256 minOutAsset
    ) external returns (uint256 exactOutXyt, uint256 exactOutToken);

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
}
