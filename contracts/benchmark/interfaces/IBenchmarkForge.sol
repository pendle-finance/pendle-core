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

import "./IBenchmarkCommon.sol";


interface IBenchmarkForge is IBenchmarkCommon {
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

    /**
     * @dev Returns the address of the BenchmarkFactory for this BenchmarkForge.
     * @return Returns the factory's address.
     **/
    function factory() external view returns (address);

    /**
     * @dev Initializes the newly created Forge.
     **/
    function initialize(address underlyingYieldToken) external;

    // function redeemUnderlying(
    //     ContractDurations contractDuration,
    //     uint256 expiry,
    //     uint256 amountToRedeem,
    //     address to
    // ) external returns (uint256 redeemedAmount);

    // function tokenizeYield(
    //     ContractDurations contractDuration,
    //     uint256 expiry,
    //     uint256 amountToTokenize,
    //     address to
    // ) external returns (address ot, address xyt);

    // function redeemAfterExpiry(
    //     ContractDurations contractDuration,
    //     uint256 expiry,
    //     address to
    // ) external returns (uint256 redeemedAmount);

    // function renew(
    //     ContractDurations oldContractDuration,
    //     uint256 oldExpiry,
    //     ContractDurations newContractDuration,
    //     uint256 newExpiry,
    //     address to
    // ) external returns (uint256 redeemedAmount);

    // TODO: We need some logic to only allow some kinds of expiry
    // for each contractDuration
    // For example: For each duration, only allow expiry at the start,
    // 1/3rd and 2/3rd of the duration
    // function generateNewContracts(
    //     ContractDurations contractDuration,
    //     uint256 expiry
    // ) external;

    // function redeemDueInterests(
    //     ContractDurations contractDuration,
    //     uint256 expiry,
    //     address to
    // ) external;

    /**
     * @dev returns the address of the underlying yield token
     * @return returns the underlying forge address
     **/
    function underlyingYieldToken() external view returns (address);
}
