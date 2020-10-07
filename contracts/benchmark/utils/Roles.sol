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


abstract contract Roles {
    event AdminClaimed(address newAdmin, address previousAdmin);
    event TransferAdminPending(address pendingAdmin);
    event MaintainerAdded(address newOperator, bool isAdd);

    address public admin;
    address public pendingAdmin;
    address public forge;
    mapping(address => bool) internal maintainers;
    address[] internal maintainersGroup;

    constructor(address _admin) {
        require(_admin != address(0), "admin 0");
        admin = _admin;
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "only admin");
        _;
    }

    modifier onlyYieldForge {
        require(msg.sender == address(forge), "Must be forge");
        _;
    }

    function getMaintainers() external view returns (address[] memory) {
        return maintainersGroup;
    }

    /**
     * @dev Allows the current admin to set the pendingAdmin address.
     * @param newAdmin The address to transfer ownership to.
     */
    function transferAdmin(address newAdmin) public onlyAdmin {
        require(newAdmin != address(0), "new admin 0");
        emit TransferAdminPending(newAdmin);
        pendingAdmin = newAdmin;
    }

    /**
     * @dev Allows the current admin to set the admin in one tx. Useful initial deployment.
     * @param newAdmin The address to transfer ownership to.
     */
    function transferAdminQuickly(address newAdmin) public onlyAdmin {
        require(newAdmin != address(0), "admin 0");
        emit TransferAdminPending(newAdmin);
        emit AdminClaimed(newAdmin, admin);
        admin = newAdmin;
    }

    /**
     * @dev Allows the pendingAdmin address to finalize the change admin process.
     */
    function claimAdmin() public {
        require(pendingAdmin == msg.sender, "not pending");
        emit AdminClaimed(pendingAdmin, admin);
        admin = pendingAdmin;
        pendingAdmin = address(0);
    }

    function addMaintainer(address _maintainer) public onlyAdmin {
        require(!maintainers[_maintainer], "maintainer exists"); // prevent duplicates.

        emit MaintainerAdded(_maintainer, true);
        maintainers[_maintainer] = true;
        maintainersGroup.push(_maintainer);
    }

    function removeMaintainer(address _maintainer) public onlyAdmin {
        require(maintainers[_maintainer], "not maintainer");
        maintainers[_maintainer] = false;

        for (uint256 i = 0; i < maintainersGroup.length; ++i) {
            if (maintainersGroup[i] == _maintainer) {
                maintainersGroup[i] = maintainersGroup[maintainersGroup.length - 1];
                maintainersGroup.pop();
                emit MaintainerAdded(_maintainer, false);
                break;
            }
        }
    }
}
