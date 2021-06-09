/* solhint-disable*/
// disable because governance is not being used at the moment
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
pragma abicoder v2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../interfaces/IPendleGovernance.sol";
import "../interfaces/IPENDLE.sol";
import "../interfaces/ITimelock.sol";

contract PendleGovernance is IPendleGovernance {
    using SafeMath for uint256;

    string public constant NAME = "Pendle Governance";

    /**
     * @notice The number of votes in support of a proposal required in order
     * for a quorum to be reached and for a vote to succeed
     */
    function quorumVotes() public pure returns (uint256) {
        return 400000e18;
    }

    /**
     * @notice The number of votes required in order for a voter to become a proposer
     */
    function proposalThreshold() public pure returns (uint256) {
        return 100000e18;
    }

    /**
     * @notice The maximum number of actions that can be included in a proposal
     */
    function proposalMaxOperations() public pure returns (uint256) {
        return 10;
    }

    /**
     * @notice The delay before voting on a proposal may take place, once proposed
     */
    function votingDelay() public pure returns (uint256) {
        return 1;
    }

    /**
     * @notice The duration of voting on a proposal, in blocks
     */
    function votingPeriod() public pure returns (uint256) {
        return 17280;
    }

    /**
     * @notice The address of the Timelock contract
     */
    ITimelock public timelock;

    /**
     * @notice The address of the Pendle governance token
     */
    IPENDLE public pendle;

    /**
     * @notice The address of the Governor Guardian
     */
    address public guardian;

    /**
     * @notice The total number of proposals
     */
    uint256 public proposalCount;

    struct Proposal {
        uint256 id; // Unique id for looking up a proposal
        address proposer; // Creator of the proposal
        uint256 eta; // The timestamp that the proposal will be available for execution, set once the vote succeeds
        address[] targets; // The ordered list of target addresses for calls to be made
        uint256[] values; // The ordered list of values (i.e. msg.value) to be passed to the calls to be made
        string[] signatures; // The ordered list of function signatures to be called
        bytes[] calldatas; // The ordered list of calldata to be passed to each call
        uint256 startBlock; // The block at which voting begins: holders must delegate their votes prior to this block
        uint256 endBlock; // The block at which voting ends: votes must be cast prior to this block
        uint256 forVotes; // Current number of votes in favor of this proposal
        uint256 againstVotes; // Current number of votes in opposition to this proposal
        bool canceled; // Flag marking whether the proposal has been canceled
        bool executed; // Flag marking whether the proposal has been executed
        mapping(address => Receipt) receipts; // Receipts of ballots for the entire set of voters
    }

    /**
     * @notice Ballot receipt record for a voter
     **/
    struct Receipt {
        bool hasVoted; // Whether or not a vote has been cast
        bool support; // Whether or not the voter supports the proposal
        uint256 votes; // The number of votes the voter had, which were cast
    }

    /**
     * @notice Possible states that a proposal may be in
     **/
    enum ProposalState {Pending, Active, Canceled, Defeated, Succeeded, Queued, Expired, Executed}

    /**
     * @notice The official record of all proposals ever proposed
     **/
    mapping(uint256 => Proposal) public proposals;

    /**
     * @notice The latest proposal for each proposer
     **/
    mapping(address => uint256) public latestProposalIds;

    /**
     * @notice The EIP-712 typehash for the contract's domain
     **/
    bytes32 public constant DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,uint256 chainId,address verifyingContract)");

    /**
     * @notice The EIP-712 typehash for the ballot struct used by the contract
     **/
    bytes32 public constant BALLOT_TYPEHASH = keccak256("Ballot(uint256 proposalId,bool support)");

    /**
     * @notice An event emitted when a new proposal is created
     **/
    event ProposalCreated(
        uint256 id,
        address proposer,
        address[] targets,
        uint256[] values,
        string[] signatures,
        bytes[] calldatas,
        uint256 startBlock,
        uint256 endBlock,
        string description
    );

    /**
     * @notice An event emitted when a vote has been cast on a proposal
     **/
    event VoteCast(address voter, uint256 proposalId, bool support, uint256 votes);

    /**
     * @notice An event emitted when a proposal has been canceled
     **/
    event ProposalCanceled(uint256 id);

    /**
     * @notice An event emitted when a proposal has been queued in the Timelock
     **/
    event ProposalQueued(uint256 id, uint256 eta);

    /**
     * @notice An event emitted when a proposal has been executed in the Timelock
     **/
    event ProposalExecuted(uint256 id);

    constructor(
        IPENDLE _pendle,
        ITimelock _timelock,
        address _guardian
    ) {
        pendle = _pendle;
        timelock = _timelock;
        guardian = _guardian;
    }

    function propose(
        address[] memory targets,
        uint256[] memory values,
        string[] memory signatures,
        bytes[] memory calldatas,
        string memory description
    ) public returns (uint256) {
        require(
            pendle.getPriorVotes(msg.sender, block.number.sub(1)) > proposalThreshold(),
            "proposer votes below proposal threshold"
        );
        require(
            targets.length == values.length &&
                targets.length == signatures.length &&
                targets.length == calldatas.length,
            "proposal function information arity mismatch"
        );
        require(targets.length != 0, "must provide actions");
        require(targets.length <= proposalMaxOperations(), "too many actions");

        uint256 latestProposalId = latestProposalIds[msg.sender];
        if (latestProposalId != 0) {
            ProposalState proposersLatestProposalState = state(latestProposalId);
            require(
                proposersLatestProposalState != ProposalState.Active,
                "one live proposal per proposer, found an already active proposal"
            );
            require(
                proposersLatestProposalState != ProposalState.Pending,
                "one live proposal per proposer, found an already pending proposal"
            );
        }

        uint256 startBlock = block.number.add(votingDelay());
        uint256 endBlock = startBlock.add(votingPeriod());

        proposalCount++;
        Proposal storage newProposal = proposals[proposalCount];
        newProposal.id = proposalCount;
        newProposal.proposer = msg.sender;
        newProposal.eta = 0;
        newProposal.targets = targets;
        newProposal.values = values;
        newProposal.signatures = signatures;
        newProposal.calldatas = calldatas;
        newProposal.startBlock = startBlock;
        newProposal.endBlock = endBlock;
        newProposal.forVotes = 0;
        newProposal.againstVotes = 0;
        newProposal.canceled = false;
        newProposal.executed = false;

        latestProposalIds[newProposal.proposer] = newProposal.id;

        emit ProposalCreated(
            newProposal.id,
            msg.sender,
            targets,
            values,
            signatures,
            calldatas,
            startBlock,
            endBlock,
            description
        );
        return newProposal.id;
    }

    function queue(uint256 proposalId) public {
        require(
            state(proposalId) == ProposalState.Succeeded,
            "proposal can only be queued if it is succeeded"
        );
        Proposal storage proposal = proposals[proposalId];
        uint256 eta = block.timestamp.add(timelock.delay());
        for (uint256 i = 0; i < proposal.targets.length; i++) {
            _queueOrRevert(
                proposal.targets[i],
                proposal.values[i],
                proposal.signatures[i],
                proposal.calldatas[i],
                eta
            );
        }
        proposal.eta = eta;
        emit ProposalQueued(proposalId, eta);
    }

    function _queueOrRevert(
        address target,
        uint256 value,
        string memory signature,
        bytes memory data,
        uint256 eta
    ) internal {
        require(
            !timelock.queuedTransactions(
                keccak256(abi.encode(target, value, signature, data, eta))
            ),
            "proposal action already queued at eta"
        );
        timelock.queueTransaction(target, value, signature, data, eta);
    }

    function execute(uint256 proposalId) public payable {
        require(
            state(proposalId) == ProposalState.Queued,
            "proposal can only be executed if it is queued"
        );
        Proposal storage proposal = proposals[proposalId];
        proposal.executed = true;
        for (uint256 i = 0; i < proposal.targets.length; i++) {
            timelock.executeTransaction{value: proposal.values[i]}(
                proposal.targets[i],
                proposal.values[i],
                proposal.signatures[i],
                proposal.calldatas[i],
                proposal.eta
            );
        }
        emit ProposalExecuted(proposalId);
    }

    function cancel(uint256 proposalId) public {
        ProposalState currentState = state(proposalId);
        require(currentState != ProposalState.Executed, "cannot cancel executed proposal");

        Proposal storage proposal = proposals[proposalId];
        require(
            msg.sender == guardian ||
                pendle.getPriorVotes(proposal.proposer, block.number.sub(1)) < proposalThreshold(),
            "proposer above threshold"
        );

        proposal.canceled = true;
        for (uint256 i = 0; i < proposal.targets.length; i++) {
            timelock.cancelTransaction(
                proposal.targets[i],
                proposal.values[i],
                proposal.signatures[i],
                proposal.calldatas[i],
                proposal.eta
            );
        }

        emit ProposalCanceled(proposalId);
    }

    function getActions(uint256 proposalId)
        public
        view
        returns (
            address[] memory targets,
            uint256[] memory values,
            string[] memory signatures,
            bytes[] memory calldatas
        )
    {
        Proposal storage p = proposals[proposalId];
        return (p.targets, p.values, p.signatures, p.calldatas);
    }

    function getReceipt(uint256 proposalId, address voter) public view returns (Receipt memory) {
        return proposals[proposalId].receipts[voter];
    }

    function state(uint256 proposalId) public view returns (ProposalState) {
        require(proposalCount >= proposalId && proposalId > 0, "invalid proposal id");
        Proposal storage proposal = proposals[proposalId];
        if (proposal.canceled) {
            return ProposalState.Canceled;
        } else if (block.number <= proposal.startBlock) {
            return ProposalState.Pending;
        } else if (block.number <= proposal.endBlock) {
            return ProposalState.Active;
        } else if (
            proposal.forVotes <= proposal.againstVotes || proposal.forVotes < quorumVotes()
        ) {
            return ProposalState.Defeated;
        } else if (proposal.eta == 0) {
            return ProposalState.Succeeded;
        } else if (proposal.executed) {
            return ProposalState.Executed;
        } else if (block.timestamp >= proposal.eta.add(timelock.gracePeriod())) {
            return ProposalState.Expired;
        } else {
            return ProposalState.Queued;
        }
    }

    function castVote(uint256 proposalId, bool support) public {
        return _castVote(msg.sender, proposalId, support);
    }

    function castVoteBySig(
        uint256 proposalId,
        bool support,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public {
        bytes32 domainSeparator =
            keccak256(
                abi.encode(DOMAIN_TYPEHASH, keccak256(bytes(NAME)), getChainId(), address(this))
            );
        bytes32 structHash = keccak256(abi.encode(BALLOT_TYPEHASH, proposalId, support));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
        address signatory = ecrecover(digest, v, r, s);
        require(signatory != address(0), "invalid signature");
        return _castVote(signatory, proposalId, support);
    }

    function _castVote(
        address voter,
        uint256 proposalId,
        bool support
    ) internal {
        require(state(proposalId) == ProposalState.Active, "voting is closed");
        Proposal storage proposal = proposals[proposalId];
        Receipt storage receipt = proposal.receipts[voter];
        require(receipt.hasVoted == false, "Pendle::_castVote: voter already voted");
        uint256 votes = pendle.getPriorVotes(voter, proposal.startBlock);

        if (support) {
            proposal.forVotes = proposal.forVotes.add(votes);
        } else {
            proposal.againstVotes = proposal.againstVotes.add(votes);
        }

        receipt.hasVoted = true;
        receipt.support = support;
        receipt.votes = votes;

        emit VoteCast(voter, proposalId, support, votes);
    }

    function __acceptAdmin() public {
        require(msg.sender == guardian, "sender must be gov guardian");
        timelock.acceptAdmin();
    }

    function __abdicate() public {
        require(msg.sender == guardian, "sender must be gov guardian");
        guardian = address(0);
    }

    function __queueSetTimelockPendingAdmin(address newPendingAdmin, uint256 eta) public {
        require(msg.sender == guardian, "sender must be gov guardian");
        timelock.queueTransaction(
            address(timelock),
            0,
            "setPendingAdmin(address)",
            abi.encode(newPendingAdmin),
            eta
        );
    }

    function __executeSetTimelockPendingAdmin(address newPendingAdmin, uint256 eta) public {
        require(msg.sender == guardian, "sender must be gov guardian");
        timelock.executeTransaction(
            address(timelock),
            0,
            "setPendingAdmin(address)",
            abi.encode(newPendingAdmin),
            eta
        );
    }

    function getChainId() internal pure returns (uint256) {
        uint256 chainId;
        assembly {
            chainId := chainid()
        }
        return chainId;
    }
}
