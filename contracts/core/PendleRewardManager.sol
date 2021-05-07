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
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../periphery/Permissions.sol";
import "../periphery/Withdrawable.sol";
import "../interfaces/IPendleYieldTokenHolder.sol";
import "../interfaces/IPendleRewardManager.sol";
import "../interfaces/IPendleForge.sol";

/**
@dev the logic of distributing rewards is very similar to that of PendleCompoundMarket & PendleCompoundLiquidityMining
    Any major differences are likely to be bugs
*/
contract PendleRewardManager is IPendleRewardManager, Permissions, Withdrawable, ReentrancyGuard {
    using SafeMath for uint256;

    bytes32 public override forgeId;
    IPendleForge private forge;
    IERC20 private rewardToken;
    uint256 private constant MULTIPLIER = 1e20;
    IPendleData private data;
    IPendleRouter private router;

    struct RewardData {
        uint256 paramL;
        uint256 lastRewardBalance;
        mapping(address => uint256) lastParamL;
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

        forge = IPendleForge(_forgeAddress);
        require(forge.forgeId() == forgeId, "FORGE_ID_MISMATCH");
        initializer = address(0);
        rewardToken = forge.rewardToken();
        data = forge.data();
        router = forge.router();
    }

    // INVARIANT: this function must be called before any action that changes the OT balance of account
    function claimRewards(
        address _underlyingAsset,
        uint256 _expiry,
        address _account
    ) external override nonReentrant returns (uint256 dueRewards) {
        RewardData storage rwd = rewardData[_underlyingAsset][_expiry];

        address _yieldTokenHolder = forge.yieldTokenHolders(_underlyingAsset, _expiry);
        _updateParamL(_underlyingAsset, _expiry, _yieldTokenHolder);

        uint256 rewardsAmountPerOT = _getRewardsAmountPerOT(_underlyingAsset, _expiry, _account);
        if (rewardsAmountPerOT == 0) return 0;

        IPendleYieldToken ot = data.otTokens(forgeId, _underlyingAsset, _expiry);
        dueRewards = ot.balanceOf(_account).mul(rewardsAmountPerOT).div(MULTIPLIER);
        if (dueRewards == 0) return 0;

        rwd.lastRewardBalance = rwd.lastRewardBalance.sub(dueRewards);
        rewardToken.transferFrom(_yieldTokenHolder, _account, dueRewards);
    }

    // INVARIANT: this function must be called before any action that changes the total OT
    function _updateParamL(
        address _underlyingAsset,
        uint256 _expiry,
        address yieldTokenHolder
    ) internal {
        RewardData storage rwd = rewardData[_underlyingAsset][_expiry];

        IPendleYieldTokenHolder(yieldTokenHolder).claimRewards();

        IPendleYieldToken ot = data.otTokens(forgeId, _underlyingAsset, _expiry);

        uint256 currentRewardBalance = rewardToken.balanceOf(yieldTokenHolder);
        (uint256 firstTerm, uint256 paramR) =
            _getFirstTermAndParamR(_underlyingAsset, _expiry, currentRewardBalance);

        uint256 totalOT = ot.totalSupply();
        uint256 secondTerm;

        if (totalOT != 0) {
            secondTerm = paramR.mul(MULTIPLIER).div(totalOT);
        }

        // Update new states
        rwd.paramL = firstTerm.add(secondTerm);
        rwd.lastRewardBalance = currentRewardBalance;
    }

    function _getFirstTermAndParamR(
        address _underlyingAsset,
        uint256 _expiry,
        uint256 currentRewardBalance
    ) internal view returns (uint256 firstTerm, uint256 paramR) {
        RewardData storage rwd = rewardData[_underlyingAsset][_expiry];
        firstTerm = rwd.paramL;
        paramR = currentRewardBalance.sub(rwd.lastRewardBalance);
    }

    function _getRewardsAmountPerOT(
        address _underlyingAsset,
        uint256 _expiry,
        address account
    ) internal returns (uint256 interestValuePerLP) {
        RewardData storage rwd = rewardData[_underlyingAsset][_expiry];
        if (rwd.lastParamL[account] == 0) {
            interestValuePerLP = 0;
        } else {
            interestValuePerLP = rwd.paramL.sub(rwd.lastParamL[account]);
        }
        rwd.lastParamL[account] = rwd.paramL;
    }
}
