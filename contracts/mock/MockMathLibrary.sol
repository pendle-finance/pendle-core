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

import "../libraries/MathLib.sol";

contract MockMathLibrary {
    function checkMultOverflow(uint256 _x, uint256 _y) public pure returns (bool) {
        return Math.checkMultOverflow(_x, _y);
    }

    function log2Int(uint256 _p, uint256 _q) public pure returns (uint256) {
        return Math.log2Int(_p, _q);
    }

    function log2ForSmallNumber(uint256 _x) public pure returns (uint256) {
        return Math.log2ForSmallNumber(_x);
    }

    function logBase2(uint256 _p, uint256 _q) public pure returns (uint256) {
        return Math.logBase2(_p, _q);
    }

    function ln(uint256 p, uint256 q) public pure returns (uint256) {
        return Math.ln(p, q);
    }

    function fpart(uint256 value) public pure returns (uint256) {
        return Math.fpart(value);
    }

    function toInt(uint256 value) public pure returns (uint256) {
        return Math.toInt(value);
    }

    function toFP(uint256 value) public pure returns (uint256) {
        return Math.toFP(value);
    }

    function rpowe(uint256 exp) public pure returns (uint256) {
        return Math.rpowe(exp);
    }

    function rpow(uint256 base, uint256 exp) public pure returns (uint256) {
        return Math.rpow(base, exp);
    }

    function rpowi(uint256 base, uint256 exp) public pure returns (uint256) {
        return Math.rpowi(base, exp);
    }

    function rdiv(uint256 x, uint256 y) public pure returns (uint256) {
        return Math.rdiv(x, y);
    }

    function rmul(uint256 x, uint256 y) public pure returns (uint256) {
        return Math.rmul(x, y);
    }

    function max(uint256 a, uint256 b) public pure returns (uint256) {
        return Math.max(a, b);
    }

    function min(uint256 a, uint256 b) public pure returns (uint256) {
        return Math.min(a, b);
    }

    function sqrt(uint256 y) public pure returns (uint256) {
        return Math.sqrt(y);
    }
}
