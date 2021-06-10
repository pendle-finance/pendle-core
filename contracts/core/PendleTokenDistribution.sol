// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.7.6;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../periphery/Permissions.sol";
import "../interfaces/IPENDLE.sol";
import "../interfaces/IPendleTokenDistribution.sol";

// There will be two instances of this contract to be deployed to be
// the pendleTeamTokens and pendleEcosystemFund (for PENDLE.sol constructor arguments)
contract PendleTokenDistribution is Permissions, IPendleTokenDistribution {
    using SafeMath for uint256;

    IPENDLE public override pendleToken;

    uint256[] public timeDurations;
    uint256[] public claimableFunds;
    mapping(uint256 => bool) public claimed;
    uint256 public numberOfDurations;

    constructor(
        address _governance,
        uint256[] memory _timeDurations,
        uint256[] memory _claimableFunds
    ) Permissions(_governance) {
        require(_timeDurations.length == _claimableFunds.length, "MISMATCH_ARRAY_LENGTH");
        numberOfDurations = _timeDurations.length;
        for (uint256 i = 0; i < numberOfDurations; i++) {
            timeDurations.push(_timeDurations[i]);
            claimableFunds.push(_claimableFunds[i]);
        }
    }

    function initialize(IPENDLE _pendleToken) external {
        require(msg.sender == initializer, "FORBIDDEN");
        require(address(_pendleToken) != address(0), "ZERO_ADDRESS");
        require(_pendleToken.isPendleToken(), "INVALID_PENDLE_TOKEN");
        require(_pendleToken.balanceOf(address(this)) > 0, "UNDISTRIBUTED_PENDLE_TOKEN");
        pendleToken = _pendleToken;
        initializer = address(0);
    }

    function claimTokens(uint256 timeDurationIndex) public onlyGovernance {
        require(timeDurationIndex < numberOfDurations, "INVALID_INDEX");
        require(!claimed[timeDurationIndex], "ALREADY_CLAIMED");
        claimed[timeDurationIndex] = true;

        uint256 claimableTimestamp = pendleToken.startTime().add(timeDurations[timeDurationIndex]);
        require(block.timestamp >= claimableTimestamp, "NOT_CLAIMABLE_YET");
        uint256 currentPendleBalance = pendleToken.balanceOf(address(this));

        uint256 amount =
            claimableFunds[timeDurationIndex] < currentPendleBalance
                ? claimableFunds[timeDurationIndex]
                : currentPendleBalance;
        require(pendleToken.transfer(governance, amount), "FAIL_PENDLE_TRANSFER");
        emit ClaimedTokens(
            governance,
            timeDurations[timeDurationIndex],
            claimableFunds[timeDurationIndex],
            amount
        );
    }
}
