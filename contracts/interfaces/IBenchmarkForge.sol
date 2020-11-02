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

import "./IBenchmarkProvider.sol";
import "../core/BenchmarkProvider.sol";


interface IBenchmarkForge {
    /**
     * @dev Emitted when the Forge has minted the OT and XYT tokens.
     * @param underlyingYieldToken The address of the underlying yield token.
     * @param amount The amount to be minted.
     **/
    event MintYieldToken(address indexed underlyingYieldToken, uint256 amount);

    /**
     * @dev Emitted when the Forge has redeemed the OT and XYT tokens.
     * @param underlyingYieldToken The address of the underlying yield token.
     * @param amount The amount to be redeemed.
     **/
    event RedeemYieldToken(address indexed underlyingYieldToken, uint256 amount);

    // TODO: We need some logic to only allow some kinds of expiry
    // for each contractDuration
    // For example: For each duration, only allow expiry at the start,
    // 1/3rd and 2/3rd of the duration
    function newYieldContracts(
        uint256 expiry
    ) external returns (address ot, address xyt);

    function redeemUnderlying(
        uint256 expiry,
        uint256 amountToRedeem,
        address to
    ) external returns (uint256 redeemedAmount);

    function tokenizeYield(
        uint256 expiry,
        uint256 amountToTokenize,
        address to
    ) external returns (address ot, address xyt);

    function redeemAfterExpiry(
        uint256 expiry,
        address to
    ) external returns (uint256 redeemedAmount);

    // function renew(
    //     ContractDurations oldContractDuration,
    //     uint256 oldExpiry,
    //     ContractDurations newContractDuration,
    //     uint256 newExpiry,
    //     address to
    // ) external returns (uint256 redeemedAmount);

    function redeemDueInterests(
        uint256 expiry
    ) external returns (uint256 interests);

    function redeemDueInterestsBeforeTransfer(
        uint256 expiry,
        address account
    ) external returns (uint256 interests);

    function getAllXYTFromExpiry(uint256 _expiry) external view returns (address[] calldata);
    function getAllOTFromExpiry(uint256 _expiry) external view returns (address[] calldata);

    /**
     * @notice Gets a reference to the Benchmark core contract.
     * @return Returns the core contract reference.
     **/
    function core() external view returns (address);

    /**
     * @dev Returns the address of the BenchmarkFactory contract address.
     * @return Returns the factory's address.
     **/
    function factory() external view returns (address);

    /**
     * @dev Returns an instance of the BenchmarkProvider contract.
     * @return Returns the provider's instance.
     **/
    function provider() external view returns (IBenchmarkProvider);

    /**
     * @dev Returns the address of the underlying asset
     * @return returns the underlying asset address
     **/
    function underlyingAsset() external view returns (address);

    /**
     * @dev Returns the address of the underlying yield token
     * @return returns the underlying yield token address
     **/
    function underlyingYieldToken() external view returns (address);
}
