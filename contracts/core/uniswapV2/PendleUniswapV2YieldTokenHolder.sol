// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.7.6;

import "../abstract/PendleYieldTokenHolderBase.sol";
import "../../interfaces/IComptroller.sol";

contract PendleUniswapV2YieldTokenHolder is PendleYieldTokenHolderBase {
    constructor(
        address _governanceManager,
        address _forge,
        address _yieldToken,
        address _rewardManager,
        uint256 _expiry
    )
        PendleYieldTokenHolderBase(
            _governanceManager,
            _forge,
            _yieldToken,
            address(0),
            _rewardManager,
            _expiry
        )
    {}

    function redeemRewards() external override {}
}
