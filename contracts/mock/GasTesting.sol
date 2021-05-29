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
pragma abicoder v2;

import "../core/PendleRouter.sol";

contract GasTesting {
    mapping(uint256 => uint256) test256;
    mapping(uint256 => uint128) test128;
    mapping(uint256 => uint32) test32;

    /* mapping(uint256 => uint256) test256;
    mapping(uint256 => uint256) test256;
    uint128 test128_1;
    uint32 test32_1;
    uint256 test256_2;
    uint128 test128_2;
    uint32 test32_2; */

    function change256(uint256 times) public {
        for (uint256 i = 0; i < times; i++) {
            test256[i] = block.timestamp;
        }
    }

    function change128(uint256 times) public {
        for (uint256 i = 0; i < times; i++) {
            test128[i] = uint128(block.timestamp);
        }
    }

    function change32(uint256 times) public {
        for (uint256 i = 0; i < times; i++) {
            test32[i] = uint32(block.timestamp);
        }
    }
}
