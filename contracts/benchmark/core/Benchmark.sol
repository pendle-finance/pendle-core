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

import "../interfaces/IBenchmark.sol";
import "../utils/Permissions.sol";


contract Benchmark is IBenchmark, Permissions {
    address public override factory;
    address private initializer;

    constructor(address _governance) Permissions(_governance) {        
        require(_governance != address(0), "Benchmark: zero address");
        governance = _governance;
    }

    function initialize(address _factory) external {
        require(msg.sender == initializer, "Benchmark: forbidden");
        require(_factory != address(0), "Benchmark: zero address");
        initializer = address(0);
        factory = _factory;
    }

    /**
     * @notice Redeems Ownership Tokens for the underlying yield token
     * @dev Can only redeem all of the OTs.
     **/
    function redeemAfterExpiry(
        address underlyingToken,
        ContractDurations contractDuration,
        uint256 expiry,
        address to
    ) public override returns (uint256 redeemedAmount) {

    }

    function redeemUnderlying(
        address underlyingToken,
        ContractDurations contractDuration,
        uint256 expiry,
        uint256 amountToRedeem,
        address to
    ) public override returns (uint256 redeemedAmount) {

    }

    // TODO: the user has existing OTs for an expired expiry, and wants to
    // mint new OTs+XYTs for a new expiry
    function renew(
        address underlyingToken,
        ContractDurations oldContractDuration,
        uint256 oldExpiry,
        ContractDurations newContractDuration,
        uint256 newExpiry,
        address to
    ) public override returns (uint256 redeemedAmount) {

    }

    function tokenizeYield(
        address underlyingToken,
        ContractDurations contractDuration,
        uint256 expiry,
        uint256 amountToTokenize,
        address to
    ) public override returns (address ot, address xyt) {

    }
}
