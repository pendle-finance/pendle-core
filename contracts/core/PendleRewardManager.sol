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
import "@openzeppelin/contracts/math/SafeMath.sol";
import "../periphery/Permissions.sol";
import "../periphery/Withdrawable.sol";
import "../interfaces/IPendleYieldTokenHolder.sol";
import "../interfaces/IPendleRewardManager.sol";
import "../interfaces/IPendleForge.sol";

contract PendleRewardManager is IPendleRewardManager, Permissions, Withdrawable {
    using SafeMath for uint256;

    bytes32 public override forgeId;
    IPendleForge private forge;
    IERC20 private rewardToken;
    uint256 private constant MULTIPLIER = 1e20;
    IPendleData private data;
    IPendleRouter private router;

    struct RewardData {
        uint256 rewardIndex;
        uint256 lastRewardBalance;
        mapping(address => uint256) userLastRewardIndex;
        mapping(address => uint256) dueReward;
    }

    mapping(address => mapping(uint256 => RewardData)) private rewardData;

    modifier onlyForge() {
        require(msg.sender == address(forge), "ONLY_FORGE");
        _;
    }

    modifier onlyRouter() {
        require(msg.sender == address(router), "ONLY_ROUTER");
        _;
    }

    constructor(address _governance, bytes32 _forgeId) Permissions(_governance) {
        forgeId = _forgeId;
    }

    function initialize(address _forgeAddress) external {
        require(msg.sender == initializer, "FORBIDDEN");
        require(address(_forgeAddress) != address(0), "ZERO_ADDRESS");

        initializer = address(0);
        forge = IPendleForge(_forgeAddress);
        require(forge.forgeId() == forgeId, "FORGE_ID_MISMATCH");
        rewardToken = forge.rewardToken();
        data = forge.data();
        router = forge.router();
    }

    // INVARIANT: this function must be called before any action that changes the total OT
    function _updateRewardIndex(
        address _underlyingAsset,
        uint256 _expiry,
        address yieldTokenHolder
    ) internal returns (IPendleYieldToken ot) {
        RewardData storage rData = rewardData[_underlyingAsset][_expiry];

        uint256 lastRewardIndex = rData.rewardIndex;
        if (lastRewardIndex == 0) {
            lastRewardIndex = 1; // always start from at least 1;
        }
        IPendleYieldTokenHolder(yieldTokenHolder).claimRewards();

        uint256 currentRewardBalance = rewardToken.balanceOf(yieldTokenHolder);
        uint256 rewardClaimed = currentRewardBalance.sub(rData.lastRewardBalance);
        ot = data.otTokens(forgeId, _underlyingAsset, _expiry);
        uint256 totalOT = ot.totalSupply();

        //TODO: what happens if there is no OT left ?
        if (rewardClaimed == 0 || totalOT == 0) return ot;
        rData.rewardIndex = rewardClaimed.mul(MULTIPLIER).div(totalOT).add(lastRewardIndex);
        rData.lastRewardBalance = currentRewardBalance;
    }

    // INVARIANT: this function must be called before any action that changes the OT balance of account
    function updateUserReward(
        address _underlyingAsset,
        uint256 _expiry,
        address _yieldTokenHolder,
        address _account
    ) public override onlyForge {
        IPendleYieldToken ot = _updateRewardIndex(_underlyingAsset, _expiry, _yieldTokenHolder);

        RewardData storage rData = rewardData[_underlyingAsset][_expiry];
        uint256 userLastRewardIndex = rData.userLastRewardIndex[_account];
        uint256 currentRewardIndex = rData.rewardIndex;

        rData.userLastRewardIndex[_account] = currentRewardIndex;
        if (userLastRewardIndex == 0) return;

        uint256 newReward =
            ot.balanceOf(_account).mul(currentRewardIndex.sub(userLastRewardIndex)).div(
                MULTIPLIER
            );
        rData.dueReward[_account] = rData.dueReward[_account].add(newReward);
    }

    function claimRewards(
        address[] memory _underlyingAssets,
        uint256[] memory _expiries,
        address _account
    ) external override onlyRouter returns (uint256[] memory rewards) {
        require(_underlyingAssets.length == _expiries.length, "ARRAY_LENGTH_MISMATCH");
        rewards = new uint256[](_underlyingAssets.length);
        for (uint256 i = 0; i < _underlyingAssets.length; i++) {
            rewards[i] = _claimReward(_underlyingAssets[i], _expiries[i], _account);
        }
    }

    function _claimReward(
        address _underlyingAsset,
        uint256 _expiry,
        address _account
    ) internal returns (uint256 reward) {
        address yieldTokenHolder = forge.yieldTokenHolders(_underlyingAsset, _expiry);
        // Update the user's reward before sending the reward out
        updateUserReward(_underlyingAsset, _expiry, yieldTokenHolder, _account);

        RewardData storage rData = rewardData[_underlyingAsset][_expiry];

        uint256 dueReward = rData.dueReward[_account];
        if (dueReward == 0) return 0;

        rData.dueReward[_account] = 0;
        rewardToken.transferFrom(yieldTokenHolder, _account, dueReward);
    }
}
