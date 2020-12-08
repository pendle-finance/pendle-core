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
    uint256 internal constant RAY = 1e27;
    uint256 internal constant WAD = 1e18;
    uint256 internal constant PRECISION = 10**8;

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
        z = n % 2 != 0 ? x : RAY;

        for (n /= 2; n != 0; n /= 2) {
            x = rmul(x, x);

            if (n % 2 != 0) {
                z = rmul(z, x);
            }
        }
    }

    function rfloor(uint256 x) internal pure returns (uint256) {
        return rtoi(x) * RAY;
    }

    function rpow(uint256 base, uint256 exp) internal pure returns (uint256) {
        uint256 whole = rfloor(exp);
        uint256 remain = exp.sub(whole);

        uint256 wholePow = rpowi(base, rtoi(whole));

        if (remain == 0) {
            return wholePow;
        }

        uint256 partialResult = rpowApprox(base, remain, PRECISION);
        return rmul(wholePow, partialResult);
    }

    function rpowi(uint256 x, uint256 n) internal pure returns (uint256) {
        uint256 z = n % 2 != 0 ? x : RAY;

        for (n /= 2; n != 0; n /= 2) {
            x = rmul(x, x);

            if (n % 2 != 0) {
                z = rmul(z, x);
            }
        }
        return z;
    }

    function rpowApprox(
        uint256 base,
        uint256 exp,
        uint256 precision
    ) internal pure returns (uint256) {
        // term 0:
        uint256 a = exp;
        (uint256 x, bool xneg) = rsignSub(base, RAY);
        uint256 term = RAY;
        uint256 sum = term;
        bool negative = false;

        // term(k) = numer / denom
        //         = (product(a - i - 1, i=1-->k) * x^k) / (k!)
        // each iteration, multiply previous term by (a-(k-1)) * x / k
        // continue until term is less than precision
        for (uint256 i = 1; term >= precision; i++) {
            uint256 bigK = i * RAY;
            (uint256 c, bool cneg) = rsignSub(a, bigK.sub(RAY));
            term = rmul(term, rmul(c, x));
            term = rdiv(term, bigK);
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

    function rsignSub(uint256 x, uint256 y) internal pure returns (uint256, bool) {
        if (x >= y) {
            return (x.sub(y), false);
        } else {
            return (y.sub(x), true);
        }
    }

    function rdiv(uint256 x, uint256 y) internal pure returns (uint256) {
        return (y / 2).add(x.mul(RAY)).div(y);
    }

    function rmul(uint256 x, uint256 y) internal pure returns (uint256) {
        return (RAY / 2).add(x.mul(y)).div(RAY);
    }

    function rtoi(uint256 x) internal pure returns (uint256) {
        return x / RAY;
    }

    function wdiv(uint256 x, uint256 y) internal pure returns (uint256) {
        return (y / 2).add(x.mul(WAD)).div(y);
    }

    function wmul(uint256 x, uint256 y) internal pure returns (uint256) {
        return (WAD / 2).add(x.mul(y)).div(WAD);
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
