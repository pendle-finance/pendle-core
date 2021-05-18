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

import "../periphery/WithdrawableV2.sol";
import "../interfaces/IPendleWhitelist.sol";

contract PendleWhitelist is WithdrawableV2, IPendleWhitelist {
    mapping(address => bool) public override whitelisted;

    constructor(address _governanceManager) PermissionsV2(_governanceManager) {}

    function addToWhitelist(address[] calldata _addresses) external override onlyGovernance {
        for (uint256 i = 0; i < _addresses.length; i++) {
            address currentAddress = _addresses[i];
            require(currentAddress != address(0), "ZERO_ADDRESS");
            require(!whitelisted[currentAddress], "ALREADY_WHITELISTED");
            whitelisted[currentAddress] = true;
            emit AddedToWhiteList(currentAddress);
        }
    }

    function removeFromWhitelist(address[] calldata _addresses) external override onlyGovernance {
        for (uint256 i = 0; i < _addresses.length; i++) {
            address currentAddress = _addresses[i];
            require(currentAddress != address(0), "ZERO_ADDRESS");
            require(whitelisted[currentAddress], "NOT_WHITELISTED_YET");
            whitelisted[currentAddress] = false;
            emit RemovedFromWhiteList(currentAddress);
        }
    }

    // There shouldnt be any fund in here
    // hence governance is allowed to withdraw anything from here.
    function _allowedToWithdraw(address) internal pure override returns (bool allowed) {
        allowed = true;
    }
}
