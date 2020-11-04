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

library Utils {
    uint256 internal constant UINT_MAX_VALUE = uint256(-1);

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
