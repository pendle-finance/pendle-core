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

import "@openzeppelin/contracts/math/SafeMath.sol";

contract Timelock {
    using SafeMath for uint256;

    /// @notice An event emitted when the timelock admin changes
    event NewAdmin(address indexed newAdmin);
    /// @notice An event emitted when a new admin is staged in the timelock
    event NewPendingAdmin(address indexed newPendingAdmin);
    event NewDelay(uint256 indexed newDelay);
    /// @notice An event emitted when a queued transaction is cancelled
    event CancelTransaction(
        bytes32 indexed txHash,
        address indexed target,
        uint256 value,
        string signature,
        bytes data,
        uint256 eta
    );
    /// @notice An event emitted when a queued transaction is executed
    event ExecuteTransaction(
        bytes32 indexed txHash,
        address indexed target,
        uint256 value,
        string signature,
        bytes data,
        uint256 eta
    );
    /// @notice An event emitted when a new transaction is queued
    event QueueTransaction(
        bytes32 indexed txHash,
        address indexed target,
        uint256 value,
        string signature,
        bytes data,
        uint256 eta
    );

    /// @notice the length of time after the delay has passed that a transaction can be executed
    uint256 public constant GRACE_PERIOD = 14 days;
    /// @notice the minimum length of the timelock delay
    uint256 public constant MINIMUM_DELAY = 12 hours + 2 * 60 * 15; // must present for 2 rebases
    /// @notice the maximum length of the timelock delay
    uint256 public constant MAXIMUM_DELAY = 30 days;

    address public admin;
    address public pendingAdmin;
    uint256 public delay;
    bool public adminInitialized;

    mapping(bytes32 => bool) public queuedTransactions;

    constructor() {
        /*
        require(delay_ >= MINIMUM_DELAY, "Delay must exceed minimum delay.");
        require(delay_ <= MAXIMUM_DELAY, "Delay must not exceed maximum delay.");
        */

        admin = msg.sender;
        delay = MINIMUM_DELAY;
        adminInitialized = false;
    }

    receive() external payable {}

    /**
    @notice sets the delay
    @param delay_ the new delay
     */
    function setDelay(uint256 delay_) public {
        require(msg.sender == address(this), "Timelock::setDelay: Call must come from Timelock.");
        require(delay_ >= MINIMUM_DELAY, "Timelock::setDelay: Delay must exceed minimum delay.");
        require(
            delay_ <= MAXIMUM_DELAY,
            "Timelock::setDelay: Delay must not exceed maximum delay."
        );
        delay = delay_;

        emit NewDelay(delay);
    }

    /// @notice sets the new admin address
    function acceptAdmin() public {
        require(
            msg.sender == pendingAdmin,
            "Timelock::acceptAdmin: Call must come from pendingAdmin."
        );
        admin = msg.sender;
        pendingAdmin = address(0);

        emit NewAdmin(admin);
    }

    /**
    @notice queues a new pendingAdmin
    @param pendingAdmin_ the new pendingAdmin address
     */
    function setPendingAdmin(address pendingAdmin_) public {
        // allows one time setting of admin for deployment purposes
        if (adminInitialized) {
            require(
                msg.sender == address(this),
                "Timelock::setPendingAdmin: Call must come from Timelock."
            );
        } else {
            adminInitialized = true;
        }
        pendingAdmin = pendingAdmin_;

        emit NewPendingAdmin(pendingAdmin);
    }

    function queueTransaction(
        address target,
        uint256 value,
        string memory signature,
        bytes memory data,
        uint256 eta
    ) public returns (bytes32) {
        require(msg.sender == admin, "Timelock::queueTransaction: Call must come from admin.");
        require(
            eta >= getBlockTimestamp().add(delay),
            "Timelock::queueTransaction: Estimated execution block must satisfy delay."
        );

        bytes32 txHash = keccak256(abi.encode(target, value, signature, data, eta));
        queuedTransactions[txHash] = true;

        emit QueueTransaction(txHash, target, value, signature, data, eta);
        return txHash;
    }

    function cancelTransaction(
        address target,
        uint256 value,
        string memory signature,
        bytes memory data,
        uint256 eta
    ) public {
        require(msg.sender == admin, "Timelock::cancelTransaction: Call must come from admin.");

        bytes32 txHash = keccak256(abi.encode(target, value, signature, data, eta));
        queuedTransactions[txHash] = false;

        emit CancelTransaction(txHash, target, value, signature, data, eta);
    }

    function executeTransaction(
        address target,
        uint256 value,
        string memory signature,
        bytes memory data,
        uint256 eta
    ) public payable returns (bytes memory) {
        require(msg.sender == admin, "Timelock::executeTransaction: Call must come from admin.");

        // timelock not enforced prior to updating the admin. This should occur on
        // deployment.
        bytes32 txHash = keccak256(abi.encode(target, value, signature, data, eta));
        if (adminInitialized) {
            require(
                queuedTransactions[txHash],
                "Timelock::executeTransaction: Transaction hasn't been queued."
            );
            require(
                getBlockTimestamp() >= eta,
                "Timelock::executeTransaction: Transaction hasn't surpassed time lock."
            );
            require(
                getBlockTimestamp() <= eta.add(GRACE_PERIOD),
                "Timelock::executeTransaction: Transaction is stale."
            );

            queuedTransactions[txHash] = false;
        }

        bytes memory callData;

        if (bytes(signature).length == 0) {
            callData = data;
        } else {
            callData = abi.encodePacked(bytes4(keccak256(bytes(signature))), data);
        }

        // solium-disable-next-line security/no-call-value
        (bool success, bytes memory returnData) = target.call{value: value}(callData);
        require(success, "Timelock::executeTransaction: Transaction execution reverted.");

        emit ExecuteTransaction(txHash, target, value, signature, data, eta);

        return returnData;
    }

    function getBlockTimestamp() internal view returns (uint256) {
        // solium-disable-next-line security/no-block-members
        return block.timestamp;
    }
}
