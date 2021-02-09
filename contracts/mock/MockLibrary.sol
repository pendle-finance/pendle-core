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

import "../libraries/PendleLibrary.sol";
import "hardhat/console.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

contract MockLibrary {
    using SafeMath for uint256;

    uint256 public constant UINT_MAX_VALUE = uint256(-1);
    uint256 public constant WAD = 1e18;
    uint256 public constant BIG_NUMBER = (uint256(1) << uint256(200));
    uint256 public constant PRECISION_BITS = 40;
    uint256 public constant FORMULA_PRECISION = uint256(1) << PRECISION_BITS;
    uint256 public constant PI = (314 * FORMULA_PRECISION) / 10**2;
    uint256 public constant PI_PLUSONE = (414 * FORMULA_PRECISION) / 10**2;
    uint256 public constant PRECISION_POW = 1e2;

    function checkMultOverflow(uint256 _x, uint256 _y) public pure returns (bool) {
        if (_y == 0) return false;
        return (((_x * _y) / _y) != _x);
    }

    function countLeadingZeros(uint256 _p, uint256 _q) public pure returns (uint256) {
        uint256 denomator = (uint256(1) << 255);
        for (int256 i = 255; i >= 0; i--) {
            if ((_q * denomator) / denomator != _q) {
                // overflow
                denomator = denomator / 2;
                continue;
            }
            if (_p / (_q * denomator) > 0) return uint256(i);
            denomator = denomator / 2;
        }

        return uint256(-1);
    }

    // log2 for a number that it in [1,2)
    function log2ForSmallNumber(uint256 _x) public pure returns (uint256) {
        uint256 res = 0;
        uint256 one = (uint256(1) << PRECISION_BITS);
        uint256 two = 2 * one;
        uint256 addition = one;

        require((_x >= one) && (_x <= two));
        require(PRECISION_BITS < 125);

        for (uint256 i = PRECISION_BITS; i > 0; i--) {
            _x = (_x * _x) / one;
            addition = addition / 2;
            if (_x >= two) {
                _x = _x / 2;
                res += addition;
            }
        }

        return res;
    }

    function logBase2(uint256 _p, uint256 _q) public pure returns (uint256) {
        uint256 n = 0;

        if (_p > _q) {
            n = countLeadingZeros(_p, _q);
        }

        require(!checkMultOverflow(_p, FORMULA_PRECISION));
        require(!checkMultOverflow(n, FORMULA_PRECISION));
        require(!checkMultOverflow(uint256(1) << n, _q));

        uint256 y = (_p * FORMULA_PRECISION) / (_q * (uint256(1) << n));
        uint256 log2Small = log2ForSmallNumber(y);

        require(n * FORMULA_PRECISION <= BIG_NUMBER);
        require(log2Small <= BIG_NUMBER);

        return n * FORMULA_PRECISION + log2Small;
    }

    function ln(uint256 p, uint256 q) public pure returns (uint256) {
        uint256 ln2Numerator = 6931471805599453094172;
        uint256 ln2Denomerator = 10000000000000000000000;

        uint256 log2x = logBase2(p, q);

        require(!checkMultOverflow(ln2Numerator, log2x));

        return (ln2Numerator * log2x) / ln2Denomerator;
    }

    function max(uint256 a, uint256 b) public pure returns (uint256) {
        return a >= b ? a : b;
    }

    function min(uint256 a, uint256 b) public pure returns (uint256) {
        return a < b ? a : b;
    }

    function rfloor(uint256 x) public pure returns (uint256) {
        return rtoi(x) * FORMULA_PRECISION;
    }

    // This famous algorithm is called "exponentiation by squaring"
    // and calculates x^n with x as fixed-point and n as regular unsigned.
    //
    // It's O(log n), instead of O(n) for naive repeated multiplication.
    //
    // These facts are why it works:
    //
    //  If n is even, then x^n = (x^2)^(n/2).
    //  If n is odd,  then x^n = x * x^(n-1),
    //   and applying the equation for even x gives
    //    x^n = x * (x^2)^((n-1) / 2).
    //
    //  Also, EVM division is flooring and
    //    floor[(n-1) / 2] = floor[n / 2].
    //
    function rpow(uint256 _base, uint256 _exp) public view returns (uint256) {
        uint256 whole = rfloor(_exp);
        uint256 remain = _exp.sub(whole);

        uint256 wholePow = rpowi(_base, rtoi(whole));

        if (remain == 0) {
            return wholePow;
        }
        console.log(_base, remain);
        uint256 partialResult = rpowApprox(_base, remain);
        return rmul(wholePow, partialResult);
    }

    function rpowi(uint256 _x, uint256 _n) public pure returns (uint256) {
        uint256 z = _n % 2 != 0 ? _x : FORMULA_PRECISION;

        for (_n /= 2; _n != 0; _n /= 2) {
            _x = rmul(_x, _x);

            if (_n % 2 != 0) {
                z = rmul(z, _x);
            }
        }
        return z;
    }

    function rpowApprox(uint256 _base, uint256 _exp) public view returns (uint256) {
        // term 0:
        uint256 a = _exp;
        (uint256 x, bool xneg) = rsignSub(_base, FORMULA_PRECISION);
        console.log(_base - 2 * FORMULA_PRECISION);
        uint256 term = FORMULA_PRECISION;
        uint256 sum = term;
        bool negative = false;

        // term(k) = numer / denom
        //         = (product(a - i - 1, i=1-->k) * x^k) / (k!)
        // each iteration, multiply previous term by (a-(k-1)) * x / k
        // continue until term is less than precision
        console.log(term, PRECISION_POW);
        for (uint256 i = 1; term >= PRECISION_POW; i++) {
            uint256 bigK = i * FORMULA_PRECISION; // i * 2^40
            (uint256 c, bool cneg) = rsignSub(a, bigK.sub(FORMULA_PRECISION)); // a - (i-1)*2^40
            term = rmul(term, rmul(c, x)); // term = term * c * x
            term = rdiv(term, bigK); // term/=i*2^40
            if (term == 0) break;

            if (xneg) negative = !negative;
            if (cneg) negative = !negative;
            if (negative) {
                sum = sum.sub(term);
            } else {
                sum = sum.add(term);
            }
            console.log(term, c, x, bigK);
            if (i == 100) {
                break;
            }
        }

        return sum;
    }

    function rsignSub(uint256 x, uint256 y) public pure returns (uint256, bool) {
        if (x >= y) {
            return (x.sub(y), false);
        } else {
            return (y.sub(x), true);
        }
    }

    function rdiv(uint256 x, uint256 y) public pure returns (uint256) {
        return (y / 2).add(x.mul(FORMULA_PRECISION)).div(y);
    }

    function rmul(uint256 x, uint256 y) public pure returns (uint256) {
        return (FORMULA_PRECISION / 2).add(x.mul(y)).div(FORMULA_PRECISION);
    }

    function rtoi(uint256 x) public pure returns (uint256) {
        return x / FORMULA_PRECISION;
    }
}
