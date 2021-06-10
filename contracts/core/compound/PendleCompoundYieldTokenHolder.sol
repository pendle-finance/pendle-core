// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.7.6;

import "./../abstract/PendleYieldTokenHolderBase.sol";
import "../../interfaces/IComptroller.sol";

contract PendleCompoundYieldTokenHolder is PendleYieldTokenHolderBase {
    IComptroller private immutable comptroller;

    constructor(
        address _governanceManager,
        address _forge,
        address _yieldToken,
        address _rewardToken,
        address _rewardManager,
        address _comptroller,
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
        require(_comptroller != address(0), "ZERO_ADDRESS");
        comptroller = IComptroller(_comptroller);
    }

    function redeemRewards() external override {
        address[] memory cTokens = new address[](1);
        address[] memory holders = new address[](1);
        cTokens[0] = yieldToken;
        holders[0] = address(this);
        comptroller.claimComp(holders, cTokens, false, true);
    }
}
