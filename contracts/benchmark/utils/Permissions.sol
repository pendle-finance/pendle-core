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

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";


abstract contract Permissions {
    event MaintainerAdded(address newOperator, bool isAdd);
    event EtherWithdraw(uint256 amount, address sendTo);
    event TokenWithdraw(IERC20 token, uint256 amount, address sendTo);

    address public governance;
    address[] internal maintainersGroup;
    mapping(address => bool) internal maintainers;

    constructor(address _governance) {
        require(_governance != address(0), "Benchmark: zero address");
        governance = _governance;
    }

    modifier onlyGovernance() {
        require(msg.sender == governance, "Benchmark: only governance");
        _;
    }

    modifier onlyMaintainer() {
        require(maintainers[msg.sender], "Benchmark: only maintainers");
        _;
    }

    function getMaintainers() external view returns (address[] memory) {
        return maintainersGroup;
    }

    function addMaintainer(address _maintainer) public onlyGovernance {
        require(!maintainers[_maintainer], "Benchmark: maintainer exists"); // prevent duplicates.

        emit MaintainerAdded(_maintainer, true);
        maintainers[_maintainer] = true;
        maintainersGroup.push(_maintainer);
    }

    function removeMaintainer(address _maintainer) public onlyGovernance {
        require(maintainers[_maintainer], "Benchmark: not maintainer");
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

    /**
     * @dev Allows maintainers to withdraw Ether in a Benchmark contract
     *      in case of accidental token transfer into the contract.
     * @param amount The amount of Ether to withdraw.
     * @param sendTo The recipient address.
     */
    function withdrawEther(uint256 amount, address payable sendTo) external onlyMaintainer {
        (bool success, ) = sendTo.call{value: amount}("");
        require(success, "withdraw failed");
        emit EtherWithdraw(amount, sendTo);
    }

    /**
     * @dev Allows maintainers to withdraw all IERC20 compatible tokens in a Benchmark
     *      contract in case of accidental token transfer into the contract.
     * @param token IERC20 The address of the token contract.
     * @param amount The amount of IERC20 tokens to withdraw.
     * @param sendTo The recipient address.
     */
    function withdrawToken(
        IERC20 token,
        uint256 amount,
        address sendTo
    ) external onlyMaintainer {
        token.transfer(sendTo, amount);
        emit TokenWithdraw(token, amount, sendTo);
    }
}
