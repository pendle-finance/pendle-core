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

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

abstract contract Permissions {
    address public governance;
    address public pendingGovernance;
    address internal initializer;

    event GovernanceClaimed(address newGovernance, address previousGovernance);

    event TransferGovernancePending(address pendingGovernance);

    constructor(address _governance) {
        require(_governance != address(0), "ZERO_ADDRESS");
        initializer = msg.sender;
        governance = _governance;
    }

    modifier initialized() {
        require(initializer == address(0), "NOT_INITIALIZED");
        _;
    }

    modifier onlyGovernance() {
        require(msg.sender == governance, "ONLY_GOVERNANCE");
        _;
    }

    /**
     * @dev Allows the pendingGovernance address to finalize the change governance process.
     */
    function claimGovernance() public {
        require(pendingGovernance == msg.sender, "WRONG_GOVERNANCE");
        emit GovernanceClaimed(pendingGovernance, governance);
        governance = pendingGovernance;
        pendingGovernance = address(0);
    }

    /**
     * @dev Allows the current governance to set the pendingGovernance address.
     * @param _governance The address to transfer ownership to.
     */
    function transferGovernance(address _governance) public onlyGovernance {
        require(_governance != address(0), "ZERO_ADDRESS");
        pendingGovernance = _governance;

        emit TransferGovernancePending(pendingGovernance);
    }
}
