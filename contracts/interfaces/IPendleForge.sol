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
     * @param underlyingYieldToken The address of the underlying yield token.
     * @param amount The amount to be minted.
     * @param expiry The expiry of the XYT token
     **/
    event MintYieldToken(
        address indexed underlyingYieldToken,
        uint256 amount,
        uint256 indexed expiry
    );

    /**
     * @dev Emitted when the Forge has created new yield token contracts.
     * @param ot The address of the ownership token.
     * @param xyt The address of the new future yield token.
     * @param expiry The date in epoch time when the contract will expire.
     **/
    event NewYieldContracts(address indexed ot, address indexed xyt, uint256 indexed expiry);

    /**
     * @dev Emitted when the Forge has redeemed the OT and XYT tokens.
     * @param underlyingYieldToken The address of the underlying yield token.
     * @param amount The amount to be redeemed.
     * @param expiry The expiry of the XYT token
     **/
    event RedeemYieldToken(
        address indexed underlyingYieldToken,
        uint256 amount,
        uint256 indexed expiry
    );

    /**
     * @dev Emitted when interest claim is settled
     * @param underlyingYieldToken The address of the underlying yield token.
     * @param receiver Interest receiver Address
     * @param amount The amount of interest claimed
     * @param expiry The expiry of the XYT token
     **/
    event DueInterestSettled(
        address indexed underlyingYieldToken,
        address indexed receiver,
        uint256 amount,
        uint256 indexed expiry
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
