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

import "../periphery/PermissionsV2.sol";
import "../interfaces/IPendleWhitelist.sol";
import "@openzeppelin/contracts/utils/EnumerableSet.sol";

contract PendleWhitelist is PermissionsV2, IPendleWhitelist {
    using EnumerableSet for EnumerableSet.AddressSet;

    EnumerableSet.AddressSet private whitelist;

    constructor(address _governanceManager) PermissionsV2(_governanceManager) {}

    function addToWhitelist(address[] calldata _addresses) external override onlyGovernance {
        for (uint256 i = 0; i < _addresses.length; i++) {
            address currentAddress = _addresses[i];
            require(currentAddress != address(0), "ZERO_ADDRESS");
            require(!whitelist.contains(currentAddress), "ALREADY_WHITELISTED");
            whitelist.add(currentAddress);
            emit AddedToWhiteList(currentAddress);
        }
    }

    function removeFromWhitelist(address[] calldata _addresses) external override onlyGovernance {
        for (uint256 i = 0; i < _addresses.length; i++) {
            address currentAddress = _addresses[i];
            require(currentAddress != address(0), "ZERO_ADDRESS");
            require(whitelist.contains(currentAddress), "NOT_WHITELISTED_YET");
            whitelist.remove(currentAddress);
            emit RemovedFromWhiteList(currentAddress);
        }
    }

    function whitelisted(address _address) external view override returns (bool) {
        return whitelist.contains(_address);
    }

    function getWhitelist() external view override returns (address[] memory list) {
        uint256 length = whitelist.length();
        list = new address[](length);
        for (uint256 i = 0; i < length; i++) {
            list[i] = whitelist.at(i);
        }
    }
}
