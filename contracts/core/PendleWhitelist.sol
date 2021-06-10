// SPDX-License-Identifier: BUSL-1.1
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
