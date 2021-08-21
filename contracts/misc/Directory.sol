// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.7.6;
pragma abicoder v2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/EnumerableSet.sol";

/**
@dev OVERALL NOTE:
* Intended to be used as an event DIRECTORY for subgraph to capture new contracts that has NO
  relation with each other
*/

contract Directory is Ownable {
    using EnumerableSet for EnumerableSet.AddressSet;

    //[type][SET]
    mapping(bytes32 => EnumerableSet.AddressSet) private addressList;

    event NewAddress(bytes32 contractType, address contractAddress);
    event RemoveAddress(bytes32 contractType, address contractAddress);

    function addAddress(bytes32 _type, address[] calldata _addresses) external onlyOwner  {
        for (uint256 i = 0; i < _addresses.length; i++) {
            address currentAddress = _addresses[i];
            require(currentAddress != address(0), "ZERO_ADDRESS");
            require(!addressList[_type].contains(currentAddress), "ALREADY_EXISTS");
            addressList[_type].add(currentAddress);
            emit NewAddress(_type ,currentAddress);
        }
    }
    
    function removeAddress(bytes32 _type, address[] calldata _addresses) external onlyOwner  {
        for (uint256 i = 0; i < _addresses.length; i++) {
            address currentAddress = _addresses[i];
            require(currentAddress != address(0), "ZERO_ADDRESS");
            require(addressList[_type].contains(currentAddress), "DOES_NOT_EXIST");
            addressList[_type].remove(currentAddress);
            emit RemoveAddress(_type, currentAddress);
        }
    }

    function addressExist(bytes32 _type, address _address) external view returns (bool) {
        return addressList[_type].contains(_address);
    }

    function getAddressesFromType(bytes32 _type) external view returns(address[] memory list){
        uint256 length = addressList[_type].length();
        list = new address[](length);
        for (uint256 i = 0; i < length; i++) {
            list[i] = addressList[_type].at(i);
        }
    }
} 