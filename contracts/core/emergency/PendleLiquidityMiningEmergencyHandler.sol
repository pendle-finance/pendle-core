// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.7.6;
pragma abicoder v2;

import "../../periphery/PermissionsV2.sol";
import "../../interfaces/IPendleMarket.sol";
import "../../interfaces/IPendleLiquidityMining.sol";
import "../../interfaces/IPendleLpHolder.sol";
import "../../interfaces/IPendlePausingManager.sol";
import "../../interfaces/IPendleForge.sol";
import "../../libraries/MathLib.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract PendleLiquidityMiningEmergencyHandler is PermissionsV2, ReentrancyGuard {
    using Math for uint256;
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    struct LiqData {
        IPendleLpHolder lpHolder;
        IERC20 lpToken;
        IERC20 underlyingYieldToken;
        uint256 totalLp;
        mapping(address => bool) haveWithdrawn;
    }

    mapping(address => mapping(uint256 => LiqData)) public liqData;
    IPendlePausingManager public immutable pausingManager;
    IERC20 public immutable pendleToken;

    modifier oneTimeWithdrawal(address _liqAddr, uint256 _expiry) {
        require(!liqData[_liqAddr][_expiry].haveWithdrawn[msg.sender], "NOTHING_TO_WITHDRAW");
        _;
        liqData[_liqAddr][_expiry].haveWithdrawn[msg.sender] = true;
    }

    constructor(
        address _governanceManager,
        address _pausingManager,
        address _pendleTokenAddress
    ) PermissionsV2(_governanceManager) {
        require(_pausingManager != address(0), "ZERO_ADDRESS");
        pausingManager = IPendlePausingManager(_pausingManager);
        pendleToken = IERC20(_pendleTokenAddress);
    }

    function setUpEmergencyMode(address _liqAddr, uint256[] calldata _expiries)
        external
        onlyGovernance
    {
        IPendleLiquidityMining liq = IPendleLiquidityMining(_liqAddr);
        liq.setUpEmergencyMode(_expiries, address(this));
        for (uint256 i = 0; i < _expiries.length; i++) {
            LiqData storage lid = liqData[_liqAddr][_expiries[i]];
            require(address(lid.lpHolder) != address(0), "DUPLICATED_EMERGENCY_SETUP");

            lid.lpHolder = IPendleLpHolder(liq.lpHolderForExpiry(_expiries[i]));
            lid.lpToken = IERC20(lid.lpHolder.pendleMarket());
            lid.underlyingYieldToken = IERC20(lid.lpHolder.underlyingYieldToken());
            lid.totalLp = lid.lpToken.balanceOf(address(lid.lpHolder));
        }
    }

    // TODO: Should this function be a batch function?
    /**
    @dev after every withdraw transaction of users, we pretend that their LP are burnt, therefore
    decrease the totalLp of LpHolder. This way, the amount of underlyingYieldToken they receive when
    doing withdraw will always be proportional to amountLpOut/totalLp
    */
    function withdraw(address _liqAddr, uint256 _expiry)
        external
        oneTimeWithdrawal(_liqAddr, _expiry)
        nonReentrant
    {
        LiqData storage lid = liqData[_liqAddr][_expiry];

        IPendleLiquidityMining liq = IPendleLiquidityMining(_liqAddr);

        uint256 amountLpOut = liq.getBalances(_expiry, msg.sender);
        lid.lpToken.transferFrom(address(lid.lpHolder), msg.sender, amountLpOut);

        uint256 lpProportion = amountLpOut.rdiv(lid.totalLp);
        uint256 amountYieldTokenOut =
            lpProportion.rmul(lid.underlyingYieldToken.balanceOf(address(lid.lpHolder)));
        lid.underlyingYieldToken.transferFrom(
            address(lid.lpHolder),
            msg.sender,
            amountYieldTokenOut
        );

        lid.totalLp = lid.totalLp.sub(amountLpOut);
    }

    function withdrawPendle(address _liqAddr, address _to) external onlyGovernance {
        pendleToken.transferFrom(_liqAddr, _to, pendleToken.balanceOf(_liqAddr));
    }
}
