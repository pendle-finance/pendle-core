// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.7.6;
pragma abicoder v2;

import "../../periphery/PermissionsV2.sol";
import "../../interfaces/IPendleLiquidityMiningV2.sol";
import "../../libraries/MathLib.sol";
import "../../libraries/TokenUtilsLib.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract PendleLiquidityMiningV2EmergencyHandler is PermissionsV2, ReentrancyGuard {
    using Math for uint256;
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    struct LiqData {
        IERC20 stakeToken;
        IERC20 yieldToken;
        uint256 totalStake;
        mapping(address => bool) haveWithdrawn;
    }

    mapping(address => LiqData) public liqData;
    IERC20 public immutable pendleToken;

    modifier oneTimeWithdrawal(address liqAddr) {
        require(!liqData[liqAddr].haveWithdrawn[msg.sender], "NOTHING_TO_WITHDRAW");
        _;
        liqData[liqAddr].haveWithdrawn[msg.sender] = true;
    }

    constructor(address _governanceManager, address _pendleToken)
        PermissionsV2(_governanceManager)
    {
        TokenUtils.requireERC20(_pendleToken);
        pendleToken = IERC20(_pendleToken);
    }

    function setUpEmergencyMode(address liqAddr, bool extraFlag) external onlyGovernance {
        IPendleLiquidityMiningV2 liq = IPendleLiquidityMiningV2(liqAddr);
        LiqData storage lid = liqData[liqAddr];
        require(address(lid.stakeToken) != address(0), "DUPLICATED_EMERGENCY_SETUP");

        liq.setUpEmergencyMode(address(this), extraFlag);
        lid.stakeToken = IERC20(liq.stakeToken());
        lid.yieldToken = IERC20(liq.yieldToken());
        lid.totalStake = liq.totalStake();
    }

    function withdraw(address liqAddr) external oneTimeWithdrawal(liqAddr) nonReentrant {
        LiqData storage lid = liqData[liqAddr];

        IPendleLiquidityMiningV2 liq = IPendleLiquidityMiningV2(liqAddr);

        uint256 amountStakeTokenOut = liq.balances(msg.sender);
        lid.stakeToken.safeTransferFrom(address(liqAddr), msg.sender, amountStakeTokenOut);

        if (address(lid.yieldToken) != address(0)) {
            uint256 stakeTokenProportion = amountStakeTokenOut.rdiv(lid.totalStake);
            uint256 amountYieldTokenOut = stakeTokenProportion.rmul(
                lid.yieldToken.balanceOf(address(liqAddr))
            );
            lid.yieldToken.safeTransferFrom(address(liqAddr), msg.sender, amountYieldTokenOut);
        }

        lid.totalStake = lid.totalStake.sub(amountStakeTokenOut);
    }

    function withdrawPendle(address liqAddr, address to) external onlyGovernance {
        pendleToken.safeTransferFrom(liqAddr, to, pendleToken.balanceOf(liqAddr));
    }
}
