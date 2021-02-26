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

import "./IPendleRouter.sol";

interface IPendleForge {
    /**
     * @dev Emitted when the Forge has minted the OT and XYT tokens.
     * @param forgeId The forgeId
     * @param underlyingAsset The address of the underlying yield token.
     * @param expiry The expiry of the XYT token
     * @param amount The amount to be minted.
     **/
    event MintYieldToken(
        bytes32 forgeId,
        address indexed underlyingAsset,
        uint256 indexed expiry,
        uint256 amount
    );

    /**
     * @dev Emitted when the Forge has created new yield token contracts.
     * @param forgeId The forgeId
     * @param underlyingAsset The address of the underlying asset.
     * @param expiry The date in epoch time when the contract will expire.
     * @param ot The address of the ownership token.
     * @param xyt The address of the new future yield token.
     **/
    event NewYieldContracts(
        bytes32 forgeId,
        address indexed underlyingAsset,
        uint256 indexed expiry,
        address ot,
        address xyt
    );

    /**
     * @dev Emitted when the Forge has redeemed the OT and XYT tokens.
     * @param forgeId The forgeId
     * @param underlyingAsset the address of the underlying asset
     * @param expiry The expiry of the XYT token
     * @param amount The amount to be redeemed.
     **/
    event RedeemYieldToken(
        bytes32 forgeId,
        address indexed underlyingAsset,
        uint256 indexed expiry,
        uint256 amount
    );

    /**
     * @dev Emitted when interest claim is settled
     * @param underlyingAsset the address of the underlying asset
     * @param expiry The expiry of the XYT token
     * @param receiver Interest receiver Address
     * @param amount The amount of interest claimed
     **/
    event DueInterestSettled(
        address indexed underlyingAsset,
        uint256 indexed expiry,
        uint256 amount,
        address indexed receiver
    );

    function newYieldContracts(address underlyingAsset, uint256 expiry)
        external
        returns (address ot, address xyt);

    function redeemAfterExpiry(
        address account,
        address underlyingAsset,
        uint256 expiry,
        address to
    ) external returns (uint256 redeemedAmount);

    function redeemDueInterests(
        address account,
        address underlyingAsset,
        uint256 expiry
    ) external returns (uint256 interests);

    function redeemDueInterestsBeforeTransfer(
        address underlyingAsset,
        uint256 expiry,
        address account
    ) external returns (uint256 interests);

    function redeemUnderlying(
        address account,
        address underlyingAsset,
        uint256 expiry,
        uint256 amountToRedeem,
        address to
    ) external returns (uint256 redeemedAmount);

    function tokenizeYield(
        address underlyingAsset,
        uint256 expiry,
        uint256 amountToTokenize,
        address to
    ) external returns (address ot, address xyt);

    /**
     * @notice Gets a reference to the PendleRouter contract.
     * @return Returns the router contract reference.
     **/
    function router() external view returns (IPendleRouter);

    /**
     * @notice Gets the bytes32 ID of the forge.
     * @return Returns the forge and protocol identifier.
     **/
    function forgeId() external view returns (bytes32);

    function getYieldBearingToken(address underlyingAsset) external view returns (address);
}
