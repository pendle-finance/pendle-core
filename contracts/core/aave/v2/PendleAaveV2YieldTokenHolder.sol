// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.7.6;

import "./../../abstract/PendleYieldTokenHolderBase.sol";
import "../../../interfaces/IAaveIncentivesController.sol";

contract PendleAaveV2YieldTokenHolder is PendleYieldTokenHolderBase {
    IAaveIncentivesController private immutable aaveIncentivesController;

    constructor(
        address _governanceManager,
        address _forge,
        address _yieldToken,
        address _rewardToken,
        address _rewardManager,
        address _aaveIncentivesController,
        uint256 _expiry
    )
        PendleYieldTokenHolderBase(
            _governanceManager,
            _forge,
            _yieldToken,
            _rewardToken,
            _rewardManager,
            _expiry
        )
    {
        require(_aaveIncentivesController != address(0), "ZERO_ADDRESS");
        aaveIncentivesController = IAaveIncentivesController(_aaveIncentivesController);
    }

    function redeemRewards() external override {
        address[] memory assets = new address[](1);
        assets[0] = yieldToken;

        aaveIncentivesController.claimRewards(assets, type(uint256).max, address(this));
    }
}
