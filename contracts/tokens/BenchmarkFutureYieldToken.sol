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

import "./BenchmarkBaseToken.sol";
import "../interfaces/IBenchmarkForge.sol";
import "../interfaces/IBenchmarkYieldToken.sol";


contract BenchmarkFutureYieldToken is BenchmarkBaseToken, IBenchmarkYieldToken {
    Utils.Protocols public override protocol;
    address public override forge;
    address public override underlyingAsset;
    address public override underlyingYieldToken;
    address public ot;
    mapping (address => uint256) public lastNormalisedIncome;

    constructor(
        address _ot,
        Utils.Protocols _protocol,
        address _underlyingAsset,
        address _underlyingYieldToken,
        string memory _name,
        string memory _symbol,
        uint8 _underlyingYieldTokenDecimals,
        uint256 _expiry
    )
        BenchmarkBaseToken(
            _name,
            _symbol,
            _underlyingYieldTokenDecimals,
            _expiry
        )
    {
        forge = msg.sender;
        ot = _ot;
        protocol = _protocol;
        underlyingAsset = _underlyingAsset;
        underlyingYieldToken = _underlyingYieldToken;
    }

    function _beforeTokenTransfer(uint256 _expiry, address _account) internal {
        IBenchmarkForge(forge).redeemDueInterestsBeforeTransfer(_expiry, _account);
    }
}
