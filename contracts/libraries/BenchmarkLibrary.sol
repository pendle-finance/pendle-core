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

library Enumerable {

    struct AddressSet {
        mapping (address => uint256) index;
        address[] values;
    }

    function add(AddressSet storage set, address value)
        internal
        returns (bool)
    {
        if (!contains(set, value)){
            set.values.push(value);
            set.index[value] = set.values.length;
            return true;
        } else {
            return false;
        }
    }

    function remove(AddressSet storage set, address value)
        internal
        returns (bool)
    {
        if (contains(set, value)){
            uint256 toDeleteIndex = set.index[value] - 1;
            uint256 lastIndex = set.values.length - 1;

            if (lastIndex != toDeleteIndex) {
                address lastValue = set.values[lastIndex];

                set.values[toDeleteIndex] = lastValue;
                set.index[lastValue] = toDeleteIndex + 1;
            }

            delete set.index[value];
            set.values.pop();

            return true;
        } else {
            return false;
        }
    }

    function contains(AddressSet storage set, address value)
        internal
        view
        returns (bool)
    {
        return set.index[value] != 0;
    }

    function enumerate(AddressSet storage set)
        internal
        view
        returns (address[] memory)
    {
        address[] memory output = new address[](set.values.length);
        for (uint256 i; i < set.values.length; i++){
            output[i] = set.values[i];
        }
        return output;
    }

    function length(AddressSet storage set)
        internal
        view
        returns (uint256)
    {
        return set.values.length;
    }

    function get(AddressSet storage set, uint256 index)
        internal
        view
        returns (address)
    {
        return set.values[index];
    }
}

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
        require(forge != address(0), "Benchmark: failed on deploy");
    }
}

library Math {
    using SafeMath for uint256;

    uint256 internal constant UINT_MAX_VALUE = uint256(-1);
    uint256 internal constant WAD = 1e18;
    uint256 internal constant BIG_NUMBER = (uint256(1) << uint256(200));
    uint256 internal constant PRECISION_BITS = 40;
    uint256 internal constant FORMULA_PRECISION = uint256(1) << PRECISION_BITS;
    uint256 internal constant PI = (314 * FORMULA_PRECISION) / 10**2;
    uint256 internal constant PI_PLUSONE = (414 * FORMULA_PRECISION) / 10**2;
    uint256 internal constant PRECISION_POW = 1e2;

    function checkMultOverflow(uint256 _x, uint256 _y) internal pure returns (bool) {
        if (_y == 0) return false;
        return (((_x * _y) / _y) != _x);
    }

    function compactFraction(uint256 _p, uint256 _q) internal pure returns (uint256, uint256) {
        if (_q < FORMULA_PRECISION * FORMULA_PRECISION) return (_p, _q);
        return compactFraction(_p / FORMULA_PRECISION, _q / FORMULA_PRECISION);
    }

    function exp(uint256 _p, uint256 _q) internal pure returns (uint256 sum) {
        uint256 n = 0;
        uint256 nFact = 1;
        uint256 currentP = 1;
        uint256 currentQ = 1;
        uint256 prevSum = 0;

        while (true) {
            if (checkMultOverflow(currentP, FORMULA_PRECISION)) return sum;
            if (checkMultOverflow(currentQ, nFact)) return sum;

            sum += (currentP * FORMULA_PRECISION) / (currentQ * nFact);

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

    function countLeadingZeros(uint256 _p, uint256 _q) internal pure returns (uint256) {
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
    function log2ForSmallNumber(uint256 _x) internal pure returns (uint256) {
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

    function logBase2(uint256 _p, uint256 _q) internal pure returns (uint256) {
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

    function ln(uint256 p, uint256 q) internal pure returns (uint256) {
        uint256 ln2Numerator = 6931471805599453094172;
        uint256 ln2Denomerator = 10000000000000000000000;

        uint256 log2x = logBase2(p, q);

        require(!checkMultOverflow(ln2Numerator, log2x));

        return (ln2Numerator * log2x) / ln2Denomerator;
    }

    function max(uint256 a, uint256 b) internal pure returns (uint256) {
        return a >= b ? a : b;
    }

    function min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
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
        z = n % 2 != 0 ? x : FORMULA_PRECISION;

        for (n /= 2; n != 0; n /= 2) {
            x = rmul(x, x);

            if (n % 2 != 0) {
                z = rmul(z, x);
            }
        }
    }

    function rfloor(uint256 x) internal pure returns (uint256) {
        return rtoi(x) * FORMULA_PRECISION;
    }

    function rpow(uint256 _base, uint256 _exp) internal pure returns (uint256) {
        uint256 whole = rfloor(_exp);
        uint256 remain = _exp.sub(whole);

        uint256 wholePow = rpowi(_base, rtoi(whole));

        if (remain == 0) {
            return wholePow;
        }

        uint256 partialResult = rpowApprox(_base, remain);
        return rmul(wholePow, partialResult);
    }

    function rpowi(uint256 _x, uint256 _n) internal pure returns (uint256) {
        uint256 z = _n % 2 != 0 ? _x : FORMULA_PRECISION;

        for (_n /= 2; _n != 0; _n /= 2) {
            _x = rmul(_x, _x);

            if (_n % 2 != 0) {
                z = rmul(z, _x);
            }
        }
        return z;
    }

    function rpowApprox(uint256 _base, uint256 _exp) internal pure returns (uint256) {
        // term 0:
        uint256 a = _exp;
        (uint256 x, bool xneg) = rsignSub(_base, FORMULA_PRECISION);
        uint256 term = FORMULA_PRECISION;
        uint256 sum = term;
        bool negative = false;

        // term(k) = numer / denom
        //         = (product(a - i - 1, i=1-->k) * x^k) / (k!)
        // each iteration, multiply previous term by (a-(k-1)) * x / k
        // continue until term is less than precision
        for (uint256 i = 1; term >= PRECISION_POW; i++) {
            uint256 bigK = i * FORMULA_PRECISION;
            (uint256 c, bool cneg) = rsignSub(a, bigK.sub(FORMULA_PRECISION));
            term = rmul(term, rmul(c, x));
            term = rdiv(term, bigK);
            if (term == 0) break;

            if (xneg) negative = !negative;
            if (cneg) negative = !negative;
            if (negative) {
                sum = sum.sub(term);
            } else {
                sum = sum.add(term);
            }
        }

        return sum;
    }

    function rsignSub(uint256 x, uint256 y) internal pure returns (uint256, bool) {
        if (x >= y) {
            return (x.sub(y), false);
        } else {
            return (y.sub(x), true);
        }
    }

    function rdiv(uint256 x, uint256 y) internal pure returns (uint256) {
        return (y / 2).add(x.mul(FORMULA_PRECISION)).div(y);
    }

    function rmul(uint256 x, uint256 y) internal pure returns (uint256) {
        return (FORMULA_PRECISION / 2).add(x.mul(y)).div(FORMULA_PRECISION);
    }

    function rtoi(uint256 x) internal pure returns (uint256) {
        return x / FORMULA_PRECISION;
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

library UIntUtils {
    function uintToString(uint256 _i) internal pure returns (string memory) {
        if (_i == 0) {
            return "0";
        }
        uint256 j = _i;
        uint256 len;
        while (j != 0) {
            len++;
            j /= 10;
        }
        bytes memory bstr = new bytes(len);
        uint256 k = len - 1;
        while (_i != 0) {
            bstr[k--] = bytes1(uint8(48 + (_i % 10)));
            _i /= 10;
        }
        return string(bstr);
    }
}

pragma experimental ABIEncoderV2;

library DateUtils {
    /*
     *  Date utilities for ethereum contracts
     *
     */
    struct Date {
        uint16 year;
        uint8 month;
        uint8 day;
    }

    uint256 public constant DAY_IN_SECONDS = 86400;
    uint256 public constant YEAR_IN_SECONDS = 31536000;
    uint256 public constant LEAP_YEAR_IN_SECONDS = 31622400;

    uint16 public constant ORIGIN_YEAR = 1970;

    function isLeapYear(uint16 _year) public pure returns (bool) {
        return ((_year % 4 == 0) && (_year % 100 != 0)) || (_year % 400 == 0);
    }

    function leapYearsBefore(uint256 _year) public pure returns (uint256) {
        _year -= 1;
        return _year / 4 - _year / 100 + _year / 400;
    }

    function getDaysInMonth(uint8 _month, uint16 _year) public pure returns (uint8) {
        if (
            _month == 1 ||
            _month == 3 ||
            _month == 5 ||
            _month == 7 ||
            _month == 8 ||
            _month == 10 ||
            _month == 12
        ) {
            return 31;
        } else if (_month == 4 || _month == 6 || _month == 9 || _month == 11) {
            return 30;
        } else if (isLeapYear(_year)) {
            return 29;
        } else {
            return 28;
        }
    }

    function parseTimestamp(uint256 _timestamp) public pure returns (Date memory d) {
        uint256 secondsAccountedFor = 0;
        uint256 buf;
        uint8 i;

        // Year
        d.year = getYear(_timestamp);
        buf = leapYearsBefore(d.year) - leapYearsBefore(ORIGIN_YEAR);

        secondsAccountedFor += LEAP_YEAR_IN_SECONDS * buf;
        secondsAccountedFor += YEAR_IN_SECONDS * (d.year - ORIGIN_YEAR - buf);

        // Month
        uint256 secondsInMonth;
        for (i = 1; i <= 12; i++) {
            secondsInMonth = DAY_IN_SECONDS * getDaysInMonth(i, d.year);
            if (secondsInMonth + secondsAccountedFor > _timestamp) {
                d.month = i;
                break;
            }
            secondsAccountedFor += secondsInMonth;
        }

        // Day
        for (i = 1; i <= getDaysInMonth(d.month, d.year); i++) {
            if (DAY_IN_SECONDS + secondsAccountedFor > _timestamp) {
                d.day = i;
                break;
            }
            secondsAccountedFor += DAY_IN_SECONDS;
        }
    }

    function getYear(uint256 _timestamp) public pure returns (uint16) {
        uint256 secondsAccountedFor = 0;
        uint16 year;
        uint256 numLeapYears;

        // Year
        year = uint16(ORIGIN_YEAR + _timestamp / YEAR_IN_SECONDS);
        numLeapYears = leapYearsBefore(year) - leapYearsBefore(ORIGIN_YEAR);

        secondsAccountedFor += LEAP_YEAR_IN_SECONDS * numLeapYears;
        secondsAccountedFor += YEAR_IN_SECONDS * (year - ORIGIN_YEAR - numLeapYears);

        while (secondsAccountedFor > _timestamp) {
            if (isLeapYear(uint16(year - 1))) {
                secondsAccountedFor -= LEAP_YEAR_IN_SECONDS;
            } else {
                secondsAccountedFor -= YEAR_IN_SECONDS;
            }
            year -= 1;
        }
        return year;
    }

    function monthName(Date memory d) private pure returns (string memory) {
        string[12] memory months =
            ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
        return months[d.month - 1];
    }

    function toRFC2822String(uint256 _timestamp) public pure returns (string memory s) {
        Date memory d = parseTimestamp(_timestamp);
        string memory day = UIntUtils.uintToString(d.day);
        string memory month = monthName(d);
        string memory year = UIntUtils.uintToString(d.year);
        s = string(abi.encodePacked(day, month, year));
    }
}
