/* solhint-disable  const-name-snakecase*/
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
pragma experimental ABIEncoderV2;

import "../interfaces/IPENDLE.sol";
import "../periphery/Permissions.sol";
import "../periphery/Withdrawable.sol";

contract PENDLE is IPENDLE, Permissions, Withdrawable {
    /// @notice A checkpoint for marking number of votes from a given block
    struct Checkpoint {
        uint64 fromBlock;
        uint192 votes;
    }

    string public constant name = "Pendle";
    string public constant symbol = "PENDLE";
    uint8 public constant decimals = 18;
    uint256 public totalSupply;

    uint192 private constant TEAM_TOKEN_AMOUNT = 91602839 * 1e18;
    uint192 private constant ECOSYSTEM_FUND_TOKEN_AMOUNT = 50 * 1_000_000 * 1e18;
    uint192 private constant PUBLIC_SALES_TOKEN_AMOUNT = 15897161 * 1e18;
    uint192 private constant INITIAL_LIQUIDITY_EMISSION = 1200000 * 1e18;
    uint192 private constant CONFIG_DENOMINATOR = 72000000000;
    uint256 private constant CONFIG_CHANGES_TIME_LOCK = 7 days;
    uint192 public emissionRateMultiplierNumerator;
    uint192 public terminalInflationRateNumerator;
    address public liquidityIncentivesRecipient;
    uint192 public pendingEmissionRateMultiplierNumerator;
    uint192 public pendingTerminalInflationRateNumerator;
    address public pendingLiquidityIncentivesRecipient;
    uint256 public configChangesInitiated;
    uint256 public startTime;
    uint192 public lastWeeklyEmission;
    uint256 public lastWeekEmissionSent;

    mapping(address => mapping(address => uint192)) internal allowances;
    mapping(address => uint192) internal balances;
    mapping(address => address) public delegates;

    /// @notice A record of votes checkpoints for each account, by index
    mapping(address => mapping(uint64 => Checkpoint)) public checkpoints;

    /// @notice The number of checkpoints for each account
    mapping(address => uint64) public numCheckpoints;

    /// @notice The EIP-712 typehash for the contract's domain
    bytes32 public constant DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,uint256 chainId,address verifyingContract)");

    /// @notice The EIP-712 typehash for the delegation struct used by the contract
    bytes32 public constant DELEGATION_TYPEHASH =
        keccak256("Delegation(address delegatee,uint256 nonce,uint256 expiry)");

    /// @notice A record of states for signing / validating signatures
    mapping(address => uint256) public nonces;

    /// @notice An event thats emitted when an account changes its delegate
    event DelegateChanged(
        address indexed delegator,
        address indexed fromDelegate,
        address indexed toDelegate
    );

    /// @notice An event thats emitted when a delegate account's vote balance changes
    event DelegateVotesChanged(
        address indexed delegate,
        uint256 previousBalance,
        uint256 newBalance
    );

    /// @notice The standard EIP-20 transfer event
    event Transfer(address indexed from, address indexed to, uint256 amount);

    /// @notice The standard EIP-20 approval event
    event Approval(address indexed owner, address indexed spender, uint256 amount);

    event PendingConfigChanges(uint192 pendingEmissionRateMultiplierNumerator, uint192 pendingTerminalInflationRateNumerator, address pendingLiquidityIncentivesRecipient);

    event ConfigsChanged(uint192 emissionRateMultiplierNumerator, uint192 terminalInflationRateNumerator, address liquidityIncentivesRecipient);

    /**
     * @notice Construct a new PENDLE token
     */
    constructor(address _governance, address pendleTeamTokens, address pendleEcosystemFund, address salesMultisig, address _liquidityIncentivesRecipient) Permissions(_governance) {
        _mint(pendleTeamTokens, TEAM_TOKEN_AMOUNT);
        _mint(pendleEcosystemFund, ECOSYSTEM_FUND_TOKEN_AMOUNT);
        _mint(salesMultisig, PUBLIC_SALES_TOKEN_AMOUNT);
        _mint(_liquidityIncentivesRecipient, INITIAL_LIQUIDITY_EMISSION * 26);
        emissionRateMultiplierNumerator = 7120800000; // emission rate = 98.9% -> 1.1% decay
        terminalInflationRateNumerator = 1440000; // terminal inflation rate = 2%
        liquidityIncentivesRecipient = _liquidityIncentivesRecipient;
        startTime = block.timestamp;
        lastWeeklyEmission = INITIAL_LIQUIDITY_EMISSION;
        lastWeekEmissionSent = 26; // already done liquidity emissions for the first 26 weeks
    }

    /**
     * @notice Approve `spender` to transfer up to `amount` from `src`
     * @dev This will overwrite the approval amount for `spender`
     *  and is subject to issues noted [here](https://eips.ethereum.org/EIPS/eip-20#approve)
     * @param spender The address of the account which may transfer tokens
     * @param rawAmount The number of tokens that are approved (2^256-1 means infinite)
     * @return Whether or not the approval succeeded
     **/
    function approve(address spender, uint256 rawAmount) external returns (bool) {
        uint192 amount;
        if (rawAmount == uint256(-1)) {
            amount = uint192(-1);
        } else {
            amount = safe192(rawAmount, "AMOUNT_EXCEED_192_BITS");
        }

        allowances[msg.sender][spender] = amount;

        emit Approval(msg.sender, spender, amount);
        return true;
    }

    /**
     * @notice Transfer `amount` tokens from `msg.sender` to `dst`
     * @param dst The address of the destination account
     * @param rawAmount The number of tokens to transfer
     * @return Whether or not the transfer succeeded
     */
    function transfer(address dst, uint256 rawAmount) external returns (bool) {
        uint192 amount = safe192(rawAmount, "AMOUNT_EXCEED_192_BITS");
        _transferTokens(msg.sender, dst, amount);
        return true;
    }

    /**
     * @notice Transfer `amount` tokens from `src` to `dst`
     * @param src The address of the source account
     * @param dst The address of the destination account
     * @param rawAmount The number of tokens to transfer
     * @return Whether or not the transfer succeeded
     */
    function transferFrom(
        address src,
        address dst,
        uint256 rawAmount
    ) external returns (bool) {
        address spender = msg.sender;
        uint192 spenderAllowance = allowances[src][spender];
        uint192 amount = safe192(rawAmount, "AMOUNT_EXCEED_192_BITS");

        if (spender != src && spenderAllowance != uint192(-1)) {
            uint192 newAllowance = sub192(spenderAllowance, amount, "TRANSFER_EXCEED_BALANCE");
            allowances[src][spender] = newAllowance;

            emit Approval(src, spender, newAllowance);
        }

        _transferTokens(src, dst, amount);
        return true;
    }

    /**
     * @notice Get the number of tokens `spender` is approved to spend on behalf of `account`
     * @param account The address of the account holding the funds
     * @param spender The address of the account spending the funds
     * @return The number of tokens approved
     **/
    function allowance(address account, address spender) external view returns (uint256) {
        return allowances[account][spender];
    }

    /**
     * @notice Get the number of tokens held by the `account`
     * @param account The address of the account to get the balance of
     * @return The number of tokens held
     */
    function balanceOf(address account) external view returns (uint256) {
        return balances[account];
    }

    /**
     * @notice Gets the current votes balance for `account`
     * @param account The address to get votes balance
     * @return The number of current votes for `account`
     */
    function getCurrentVotes(address account) external view returns (uint192) {
        uint64 nCheckpoints = numCheckpoints[account];
        return nCheckpoints > 0 ? checkpoints[account][nCheckpoints - 1].votes : 0;
    }

    /**
     * @notice Delegate votes from `msg.sender` to `delegatee`
     * @param delegatee The address to delegate votes to
     */
    function delegate(address delegatee) public {
        return _delegate(msg.sender, delegatee);
    }

    /**
     * @notice Delegates votes from signatory to `delegatee`
     * @param delegatee The address to delegate votes to
     * @param nonce The contract state required to match the signature
     * @param expiry The time at which to expire the signature
     * @param v The recovery byte of the signature
     * @param r Half of the ECDSA signature pair
     * @param s Half of the ECDSA signature pair
     */
    function delegateBySig(
        address delegatee,
        uint256 nonce,
        uint256 expiry,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public {
        bytes32 domainSeparator =
            keccak256(
                abi.encode(DOMAIN_TYPEHASH, keccak256(bytes(name)), getChainId(), address(this))
            );
        bytes32 structHash = keccak256(abi.encode(DELEGATION_TYPEHASH, delegatee, nonce, expiry));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
        address signatory = ecrecover(digest, v, r, s);
        require(signatory != address(0), "INVALID_SIGNATURE");
        require(nonce == nonces[signatory]++, "INVALID_NONCE");
        require(block.timestamp <= expiry, "SIGNATURE_EXPIRED");
        return _delegate(signatory, delegatee);
    }

    /**
     * @notice Determine the prior number of votes for an account as of a block number
     * @dev Block number must be a finalized block or else
                this function will revert to prevent misinformation
     * @param account The address of the account to check
     * @param blockNumber The block number to get the vote balance at
     * @return The number of votes the account had as of the given block
     */
    function getPriorVotes(address account, uint256 blockNumber)
        public
        view
        override
        returns (uint192)
    {
        require(blockNumber < block.number, "NOT_YET_DETERMINED");

        uint64 nCheckpoints = numCheckpoints[account];
        if (nCheckpoints == 0) {
            return 0;
        }

        // First check most recent balance
        if (checkpoints[account][nCheckpoints - 1].fromBlock <= blockNumber) {
            return checkpoints[account][nCheckpoints - 1].votes;
        }

        // Next check implicit zero balance
        if (checkpoints[account][0].fromBlock > blockNumber) {
            return 0;
        }

        uint64 lower = 0;
        uint64 upper = nCheckpoints - 1;
        while (upper > lower) {
            uint64 center = upper - (upper - lower) / 2; // ceil, avoiding overflow
            Checkpoint memory cp = checkpoints[account][center];
            if (cp.fromBlock == blockNumber) {
                return cp.votes;
            } else if (cp.fromBlock < blockNumber) {
                lower = center;
            } else {
                upper = center - 1;
            }
        }
        return checkpoints[account][lower].votes;
    }

    function _delegate(address delegator, address delegatee) internal {
        address currentDelegate = delegates[delegator];
        uint192 delegatorBalance = balances[delegator];
        delegates[delegator] = delegatee;

        emit DelegateChanged(delegator, currentDelegate, delegatee);

        _moveDelegates(currentDelegate, delegatee, delegatorBalance);
    }

    function _transferTokens(
        address src,
        address dst,
        uint192 amount
    ) internal {
        require(src != address(0), "SENDER_ZERO_ADDR");
        require(dst != address(0), "RECEIVER_ZERO_ADDR");

        balances[src] = sub192(balances[src], amount, "TRANSFER_EXCEED_BALANCE");
        balances[dst] = add192(balances[dst], amount, "TRANSFER_AMOUNT_OVERFLOW");
        emit Transfer(src, dst, amount);

        _moveDelegates(delegates[src], delegates[dst], amount);
    }

    function _moveDelegates(
        address srcRep,
        address dstRep,
        uint192 amount
    ) internal {
        if (srcRep != dstRep && amount > 0) {
            if (srcRep != address(0)) {
                uint64 srcRepNum = numCheckpoints[srcRep];
                uint192 srcRepOld = srcRepNum > 0 ? checkpoints[srcRep][srcRepNum - 1].votes : 0;
                uint192 srcRepNew = sub192(srcRepOld, amount, "VOTE_AMOUNT_UNDERFLOW");
                _writeCheckpoint(srcRep, srcRepNum, srcRepOld, srcRepNew);
            }

            if (dstRep != address(0)) {
                uint64 dstRepNum = numCheckpoints[dstRep];
                uint192 dstRepOld = dstRepNum > 0 ? checkpoints[dstRep][dstRepNum - 1].votes : 0;
                uint192 dstRepNew = add192(dstRepOld, amount, "VOTE_AMOUNT_OVERFLOW");
                _writeCheckpoint(dstRep, dstRepNum, dstRepOld, dstRepNew);
            }
        }
    }

    function _writeCheckpoint(
        address delegatee,
        uint64 nCheckpoints,
        uint192 oldVotes,
        uint192 newVotes
    ) internal {
        uint64 blockNumber = safe64(block.number, "BLOCK_NUM_EXCEED_32_BITS");

        if (
            nCheckpoints > 0 && checkpoints[delegatee][nCheckpoints - 1].fromBlock == blockNumber
        ) {
            checkpoints[delegatee][nCheckpoints - 1].votes = newVotes;
        } else {
            checkpoints[delegatee][nCheckpoints] = Checkpoint(blockNumber, newVotes);
            numCheckpoints[delegatee] = nCheckpoints + 1;
        }

        emit DelegateVotesChanged(delegatee, oldVotes, newVotes);
    }

    function safe64(uint256 n, string memory errorMessage) internal pure returns (uint64) {
        require(n < 2**64, errorMessage);
        return uint64(n);
    }

    function safe192(uint256 n, string memory errorMessage) internal pure returns (uint192) {
        require(n < 2**192, errorMessage);
        return uint192(n);
    }

    function add192(
        uint192 a,
        uint192 b,
        string memory errorMessage
    ) internal pure returns (uint192) {
        uint192 c = a + b;
        require(c >= a, errorMessage);
        return c;
    }

    function sub192(
        uint192 a,
        uint192 b,
        string memory errorMessage
    ) internal pure returns (uint192) {
        require(b <= a, errorMessage);
        return a - b;
    }

    function mul192(
        uint192 a,
        uint192 b,
        string memory errorMessage
    ) internal pure returns (uint192) {
        if (a == 0) {
            return 0;
        }

        uint192 c = a * b;
        require(c / a == b, errorMessage);

        return c;
    }

    /* function div192(
        uint192 a,
        uint192 b,
        string memory errorMessage
    ) internal pure returns (uint192) {
        require(b > 0, errorMessage);
        return a / b;
    } */

    function getChainId() internal pure returns (uint256) {
        uint256 chainId;
        assembly {
            chainId := chainid()
        }
        return chainId;
    }

    function _mint(address account, uint192 amount) internal {
        require(account != address(0), "MINT_TO_ZERO_ADDR");

        totalSupply = add192(safe192(totalSupply, "TOTAL_SUPPLY_EXCEEDS_UINT192"), amount, "TOTAL_SUPPLY_OVERFLOW");
        balances[account] = add192(balances[account], amount, "BALANCES_OVERFLOW");
        emit Transfer(address(0), account, amount);
    }

    function initiateConfigChanges(uint192 _emissionRateMultiplierNumerator, uint192 _terminalInflationRateNumerator, address _liquidityIncentivesRecipient) external onlyGovernance {
        require(liquidityIncentivesRecipient != address(0), "ZERO_ADDRESS");
        pendingEmissionRateMultiplierNumerator = _emissionRateMultiplierNumerator;
        pendingTerminalInflationRateNumerator = _terminalInflationRateNumerator;
        pendingLiquidityIncentivesRecipient = _liquidityIncentivesRecipient;
        emit PendingConfigChanges(_emissionRateMultiplierNumerator, _terminalInflationRateNumerator, _liquidityIncentivesRecipient);
        configChangesInitiated = block.timestamp;
    }

    function applyConfigChanges() external {
        require(configChangesInitiated != 0, "UNINITIATED_CONFIG_CHANGES");
        require(block.timestamp > configChangesInitiated + CONFIG_CHANGES_TIME_LOCK, "TIMELOCK_IS_NOT_OVER");

        _mintLiquidityEmissions(); // We must settle the pending liquidity emissions first, to make sure the weeks in the past follow the old configs

        emissionRateMultiplierNumerator = pendingEmissionRateMultiplierNumerator;
        terminalInflationRateNumerator = pendingTerminalInflationRateNumerator;
        liquidityIncentivesRecipient = pendingLiquidityIncentivesRecipient;
        configChangesInitiated = 0;
        emit ConfigsChanged(emissionRateMultiplierNumerator, terminalInflationRateNumerator, liquidityIncentivesRecipient);
    }

    function claimLiquidityEmissions() external returns (uint256 totalEmissions) {
        require(msg.sender == liquidityIncentivesRecipient, "NOT_INCENTIVES_RECIPIENT");
        totalEmissions = _mintLiquidityEmissions();
    }

    function _mintLiquidityEmissions() internal returns (uint192 totalEmissions) {
        uint256 _currentWeek = _getCurrentWeek();
        if (_currentWeek <= lastWeekEmissionSent) {
            return 0;
        }
        for (uint256 i = lastWeekEmissionSent; i <= _currentWeek; i++) {
            if (_currentWeek <= 259) {
                lastWeeklyEmission = mul192(lastWeeklyEmission, emissionRateMultiplierNumerator, "WEEKLY_EMISSION_MULTIPLICATION_OVERFLOW") / CONFIG_DENOMINATOR;
            } else {
                lastWeeklyEmission = mul192(safe192(totalSupply, "TOTAL_SUPPLY_EXCEEDS_UINT192"), terminalInflationRateNumerator, "WEEKLY_EMISSION_MULTIPLICATION_OVERFLOW") / CONFIG_DENOMINATOR;
            }
            _mint(liquidityIncentivesRecipient, lastWeeklyEmission);
            totalEmissions = add192(totalEmissions, lastWeeklyEmission, "TOTAL_EMISSION_OVERFLOW");
        }
        lastWeekEmissionSent = _currentWeek;
    }

    // get current 1-indexed week id
    function _getCurrentWeek() internal view returns (uint256 weekId) {
        weekId = (block.timestamp - startTime) / (7 days) + 1;
    }
}
