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

import "@openzeppelin/contracts/math/SafeMath.sol";


library Factory {
    function createContract(
        bytes memory bytecode,
        bytes memory salting,
        bytes memory ctor
    ) internal returns (address forge) {
        bytes32 salt = keccak256(salting);

        bytecode = abi.encodePacked(bytecode, ctor);

        assembly {
            forge := create2(0, add(bytecode, 32), mload(bytecode), salt)
        }
    }
}

library Math {
    using SafeMath for uint256;

    uint256 internal constant UINT_MAX_VALUE = uint256(-1);
    uint256 internal constant BIG_NUMBER = (uint256(1) << uint256(200));
    uint256 internal constant PRECISION_BITS = 40;
    uint256 internal constant FP = uint256(1)<<PRECISION_BITS;
    uint256 internal constant FP_POW = 1e2;

    function checkMultOverflow(uint256 _x, uint256 _y) public pure returns (bool) {
        if (_y == 0) return false;
        return (((_x * _y) / _y) != _x);
    }

    function compactFraction(
        uint256 _p,
        uint256 _q
    ) public pure returns (uint256, uint256) {
        if (_q < FP * FP) return (_p, _q);
        return compactFraction(_p / FP, _q / FP);
    }

    function exp(
        uint256 _p,
        uint256 _q
    ) public pure returns (uint256 sum) {
        uint256 n = 0;
        uint256 nFact = 1;
        uint256 currentP = 1;
        uint256 currentQ = 1;
        uint256 prevSum = 0;

        while (true) {
            if (checkMultOverflow(currentP, FP)) return sum;
            if (checkMultOverflow(currentQ, nFact)) return sum;

            sum += (currentP * FP) / (currentQ * nFact);

            if (sum == prevSum) return sum;
            prevSum = sum;

            n++;

            if (checkMultOverflow(currentP, _p)) return sum;
            if (checkMultOverflow(currentQ, _q)) return sum;
            if (checkMultOverflow(nFact, n)) return sum;

            currentP *= _p;
            currentQ *= _q;
            nFact *= n;

            (currentP, currentQ) = compactFraction(currentP, currentQ);
        }
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
    function log2ForSmallNumber(uint256 _x)
        public
        pure
        returns (uint256)
    {
        uint256 res = 0;
        uint256 one = (uint256(1) << PRECISION_BITS);
        uint256 two = 2 * one;
        uint256 addition = one;

        require((_x >= one) && (_x <= two), "Benchmark: x out of bounds");

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

    function logBase2(
        uint256 _p,
        uint256 _q
    ) public pure returns (uint256) {
        uint256 n = 0;

        if (_p > _q) {
            n = countLeadingZeros(_p, _q);
        }

        require(!checkMultOverflow(_p, FP), "Benchmark: mult overflow");
        require(!checkMultOverflow(n, FP), "Benchmark: mult overflow");
        require(!checkMultOverflow(uint256(1) << n, _q), "Benchmark: mult overflow");

        uint256 y = (_p * FP) / (_q * (uint256(1) << n));
        uint256 log2Small = log2ForSmallNumber(y);

        require(n * FP <= BIG_NUMBER, "Benchmark: > big number");
        require(log2Small <= BIG_NUMBER, "Benchmark: > big number");

        return n * FP + log2Small;
    }

    function ln(
        uint256 p,
        uint256 q
    ) public pure returns (uint256) {
        uint256 ln2Numerator = 6931471805599453094172;
        uint256 ln2Denomerator = 10000000000000000000000;

        uint256 log2x = logBase2(p, q);

        require(!checkMultOverflow(ln2Numerator, log2x), "Benchmark: mult overflow");

        return (ln2Numerator * log2x) / ln2Denomerator;
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
    function pow(uint256 x, uint256 n) internal pure returns (uint256 z) {
        z = n % 2 != 0 ? x : FP;

        for (n /= 2; n != 0; n /= 2) {
            x = fpMul(x, x);

            if (n % 2 != 0) {
                z = fpMul(z, x);
            }
        }
    }

    function fpFloor(uint256 x) internal pure returns (uint256) {
        return fpToi(x) * FP;
    }

    function fpPow(uint256 _base, uint256 _exp) internal pure returns (uint256) {
        uint256 whole = fpFloor(_exp);
        uint256 remain = _exp.sub(whole);

        uint256 wholePow = fpPowi(_base, fpToi(whole));

        if (remain == 0) {
            return wholePow;
        }

        uint256 partialResult = fpPowApprox(_base, remain);
        return fpMul(wholePow, partialResult);
    }

    function fpPowi(uint256 _x, uint256 _n) internal pure returns (uint256) {
        uint256 z = _n % 2 != 0 ? _x : FP;

        for (_n /= 2; _n != 0; _n /= 2) {
            _x = fpMul(_x, _x);

            if (_n % 2 != 0) {
                z = fpMul(z, _x);
            }
        }
        return z;
    }

    function fpPowApprox(
        uint256 _base,
        uint256 _exp
    ) internal pure returns (uint256) {
        // term 0:
        uint256 a = _exp;
        (uint256 x, bool xneg) = fpSignSub(_base, FP);
        uint256 term = FP;
        uint256 sum = term;
        bool negative = false;

        // term(k) = numer / denom
        //         = (product(a - i - 1, i=1-->k) * x^k) / (k!)
        // each iteration, multiply previous term by (a-(k-1)) * x / k
        // continue until term is less than precision
        for (uint256 i = 1; term >= FP_POW; i++) {
            uint256 bigK = i * FP;
            (uint256 c, bool cneg) = fpSignSub(a, bigK.sub(FP));
            term = fpMul(term, fpMul(c, x));
            term = fpDiv(term, bigK);
            if (term == 0) break;

            if (xneg) negative = !negative;
            if (cneg) negative = !negative;
            if (negative) {
                sum = sum.sub(term);
            } else {
                sum = sum.sub(term);
            }
        }

        return sum;
    }

    function fpSignSub(uint256 x, uint256 y) internal pure returns (uint256, bool) {
        if (x >= y) {
            return (x.sub(y), false);
        } else {
            return (y.sub(x), true);
        }
    }

    function fpDiv(uint256 x, uint256 y) internal pure returns (uint256) {
        return (y / 2).add(x.mul(FP)).div(y);
    }

    function fpMul(uint256 x, uint256 y) internal pure returns (uint256) {
        return (FP / 2).add(x.mul(y)).div(FP);
    }

    function fpToi(uint256 x) internal pure returns (uint256) {
        return x / FP;
    }
}

library Utils {
    /**
     * @notice Concatenates a Benchmark token name/symbol to a yield token name/symbol
     *         using a delimiter (usually "-" or " ").
     * @param _bt The Benchmark token name/symbol.
     * @param _yt The yield token name/symbol.
     * @param _delimiter Can be any delimiter, but usually "-" or " ".
     * @return result Returns the concatenated string.
     **/
    function concat(
        string memory _bt,
        string memory _yt,
        string memory _delimiter
    ) internal pure returns (string memory result) {
        uint256 btPart;
        uint256 ytPart;
        uint256 delimiterPart;
        uint256 resultPart;

        result = new string(
            bytes(_bt).length + bytes(_yt).length + (bytes(_delimiter).length * 2)
        );

        assembly {
            btPart := add(_bt, 0x20)
            ytPart := add(_yt, 0x20)
            delimiterPart := add(_delimiter, 0x20)
            resultPart := add(result, 32)
        }

        memcpy(btPart, resultPart, bytes(_bt).length);
        memcpy(delimiterPart, resultPart + bytes(_bt).length, bytes(_delimiter).length);
        memcpy(
            ytPart,
            resultPart + bytes(_bt).length + bytes(_delimiter).length,
            bytes(_yt).length
        );
    }

    /**
     * @notice Concatenates a OT/XYT token name/symbol to an expiry
     *         using a delimiter (usually "-" or " ").
     * @param _name The OT/XYT token name/symbol.
     * @param _expiry The expiry in epoch time.
     * @param _delimiter Can be any delimiter, but usually "-" or " ".
     * @return result Returns the concatenated string.
     **/
    function concat(
        string memory _name,
        uint256 _expiry,
        string memory _delimiter
    ) internal pure returns (string memory result) {
        uint256 namePart;
        uint256 expiryPart;
        uint256 delimiterPart;
        uint256 resultPart;
        uint256 length;
        uint256 i = _expiry;

        while (i != 0) {
            length++;
            i /= 10;
        }

        bytes memory expiryBytes = new bytes(length);
        uint256 j = length - 1;

        while (_expiry != 0) {
            expiryBytes[j--] = bytes1(uint8(48 + (_expiry % 10)));
            _expiry /= 10;
        }

        string memory expiry = string(expiryBytes);
        result = new string(bytes(_name).length + bytes(expiry).length + bytes(_delimiter).length);

        assembly {
            namePart := add(_name, 0x20)
            expiryPart := add(expiry, 0x20)
            delimiterPart := add(_delimiter, 0x20)
            resultPart := add(result, 32)
        }

        memcpy(namePart, resultPart, bytes(_name).length);
        memcpy(delimiterPart, resultPart + bytes(_name).length, bytes(_delimiter).length);
        memcpy(
            expiryPart,
            resultPart + bytes(_name).length + bytes(_delimiter).length,
            bytes(expiry).length
        );
    }

    function memcpy(
        uint256 src,
        uint256 dest,
        uint256 length
    ) private pure {
        for (; length >= 32; length -= 32) {
            assembly {
                mstore(dest, mload(src))
            }
            src += 32;
            dest += 32;
        }

        uint256 mask = 256**(32 - length) - 1;

        assembly {
            let srcPart := and(mload(src), not(mask))
            let destPart := and(mload(dest), mask)
            mstore(dest, or(destPart, srcPart))
        }
    }
}
