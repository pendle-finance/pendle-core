// SPDX-License-Identifier: GPL-3.0-or-later
/*
 * GNU General Public License v3.0 or later
 * ========================================
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";

library Math {
    using SafeMath for uint256;

    uint256 internal constant BIG_NUMBER = (uint256(1) << uint256(200));
    uint256 internal constant PRECISION_BITS = 40;
    uint256 internal constant RONE = uint256(1) << PRECISION_BITS;
    uint256 internal constant PI = (314 * RONE) / 10**2;
    uint256 internal constant PI_PLUSONE = (414 * RONE) / 10**2;
    uint256 internal constant PRECISION_POW = 1e2;

    function checkMultOverflow(uint256 _x, uint256 _y) internal pure returns (bool) {
        if (_y == 0) return false;
        return (((_x * _y) / _y) != _x);
    }

    /**
    @notice find the integer part of log2(p/q)
        => find largest x s.t p >= q * 2^x
        => find largest x s.t 2^x <= p / q
     */
    function log2Int(uint256 _p, uint256 _q) internal pure returns (uint256) {
        uint256 res = 0;
        uint256 remain = _p / _q;
        while (remain > 0) {
            res++;
            remain /= 2;
        }
        return res - 1;
    }

    /**
    @notice log2 for a number that it in [1,2)
    @dev _x is FP, return a FP
    @dev function is from Kyber. Long modified the condition to be (_x >= one) && (_x < two)
    to avoid the case where x = 2 may lead to incorrect result
     */
    function log2ForSmallNumber(uint256 _x) internal pure returns (uint256) {
        uint256 res = 0;
        uint256 one = (uint256(1) << PRECISION_BITS);
        uint256 two = 2 * one;
        uint256 addition = one;

        require((_x >= one) && (_x < two), "MATH_ERROR");
        require(PRECISION_BITS < 125, "MATH_ERROR");

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

    /**
    @notice log2 of (p/q). returns result in FP form
    @dev function is from Kyber.
    @dev _p & _q is FP, return a FP
     */
    function logBase2(uint256 _p, uint256 _q) internal pure returns (uint256) {
        uint256 n = 0;

        if (_p > _q) {
            n = log2Int(_p, _q);
        }

        require(n * RONE <= BIG_NUMBER, "MATH_ERROR");
        require(!checkMultOverflow(_p, RONE), "MATH_ERROR");
        require(!checkMultOverflow(n, RONE), "MATH_ERROR");
        require(!checkMultOverflow(uint256(1) << n, _q), "MATH_ERROR");

        uint256 y = (_p * RONE) / (_q * (uint256(1) << n));
        uint256 log2Small = log2ForSmallNumber(y);

        assert(log2Small <= BIG_NUMBER);

        return n * RONE + log2Small;
    }

    /**
    @notice calculate ln(p/q). returned result >= 0
    @dev function is from Kyber.
    @dev _p & _q is FP, return a FP
    */
    function ln(uint256 p, uint256 q) internal pure returns (uint256) {
        uint256 ln2Numerator = 6931471805599453094172;
        uint256 ln2Denomerator = 10000000000000000000000;

        uint256 log2x = logBase2(p, q);

        require(!checkMultOverflow(ln2Numerator, log2x), "MATH_ERROR");

        return (ln2Numerator * log2x) / ln2Denomerator;
    }

    /**
    @notice extract the fractional part of a FP
    @dev value is a FP, return a FP
     */
    function fpart(uint256 value) internal pure returns (uint256) {
        return value % RONE;
    }

    /**
    @notice convert a FP to an Int
    @dev value is a FP, return an Int
     */
    function toInt(uint256 value) internal pure returns (uint256) {
        return value / RONE;
    }

    /**
    @notice convert an Int to a FP
    @dev value is an Int, return a FP
     */
    function toFP(uint256 value) internal pure returns (uint256) {
        return value * RONE;
    }

    /**
    @notice return e^exp in FP form
    @dev estimation by formula at http://pages.mtu.edu/~shene/COURSES/cs201/NOTES/chap04/exp.html
        the function is based on exp function of:
        https://github.com/NovakDistributed/macroverse/blob/master/contracts/RealMath.sol
    @dev the function is expected to converge quite fast, after about 20 iteration
    @dev exp is a FP, return a FP
     */
    function rpowe(uint256 exp) internal pure returns (uint256) {
        uint256 res = 0;

        uint256 curTerm = RONE;

        /* no limit on n. If the function cannot converge, it will lead to out of gas*/
        for (uint256 n = 0; ; n++) {
            res += curTerm;
            curTerm = rmul(curTerm, rdiv(exp, toFP(n + 1)));
            if (curTerm == 0) {
                break;
            }
            if (n == 500) {
                /*
                testing shows that in the most extreme case, it will take 430 turns to converge.
                however, it's expected that the numbers will not exceed 2^120 in normal situation
                the most extreme case is rpow((1<<256)-1,(1<<40)-1) (equal to rpow((2^256-1)/2^40,0.99..9))
                */
                revert("RPOWE_SLOW_CONVERGE");
            }
        }

        return res;
    }

    /**
    @notice calculate base^exp with base and exp being FP int
    @dev to improve accuracy, base^exp = base^(int(exp)+frac(exp))
                                       = base^int(exp) * base^frac
    @dev base & exp are FP, return a FP
     */
    function rpow(uint256 base, uint256 exp) internal pure returns (uint256) {
        if (exp == 0) {
            // Anything to the 0 is 1
            return RONE;
        }
        if (base == 0) {
            // 0 to anything except 0 is 0
            return 0;
        }

        uint256 frac = fpart(exp); // get the fractional part
        uint256 whole = exp - frac;

        uint256 wholePow = rpowi(base, toInt(whole)); // whole is a FP, convert to Int
        uint256 fracPow;

        // instead of calculating base ^ frac, we will calculate e ^ (frac*ln(base))
        if (base < RONE) {
            /* since the base is smaller than 1.0, ln(base) < 0.
            Since 1 / (e^(frac*ln(1/base))) = e ^ (frac*ln(base)),
            we will calculate 1 / (e^(frac*ln(1/base))) instead.
            */
            uint256 newExp = rmul(frac, ln(rdiv(RONE, base), RONE));
            fracPow = rdiv(RONE, rpowe(newExp));
        } else {
            /* base is greater than 1, calculate normally */
            uint256 newExp = rmul(frac, ln(base, RONE));
            fracPow = rpowe(newExp);
        }
        return rmul(wholePow, fracPow);
    }

    /**
    @notice return base^exp with base in FP form and exp in Int
    @dev this function use a technique called: exponentiating by squaring
        complexity O(log(q))
    @dev function is from Kyber.
    @dev base is a FP, exp is an Int, return a FP
     */
    function rpowi(uint256 base, uint256 exp) internal pure returns (uint256) {
        uint256 res = exp % 2 != 0 ? base : RONE;

        for (exp /= 2; exp != 0; exp /= 2) {
            base = rmul(base, base);

            if (exp % 2 != 0) {
                res = rmul(res, base);
            }
        }
        return res;
    }

    /**
    @notice divide 2 FP, return a FP
    @dev function is from Balancer.
    @dev x & y are FP, return a FP
     */
    function rdiv(uint256 x, uint256 y) internal pure returns (uint256) {
        return (y / 2).add(x.mul(RONE)).div(y);
    }

    /**
    @notice multiply 2 FP, return a FP
    @dev function is from Balancer.
    @dev x & y are FP, return a FP
     */
    function rmul(uint256 x, uint256 y) internal pure returns (uint256) {
        return (RONE / 2).add(x.mul(y)).div(RONE);
    }

    function max(uint256 a, uint256 b) internal pure returns (uint256) {
        return a >= b ? a : b;
    }

    function min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }
}
