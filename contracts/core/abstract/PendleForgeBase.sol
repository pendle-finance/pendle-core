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

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "../../libraries/ExpiryUtilsLib.sol";
import "../../interfaces/IAaveLendingPoolCore.sol";
import "../../interfaces/IPendleBaseToken.sol";
import "../../interfaces/IPendleData.sol";
import "../../interfaces/IPendleForge.sol";
import "../../interfaces/IPendleRewardManager.sol";
import "../../interfaces/IPendleYieldContractDeployer.sol";
import "../../interfaces/IPendleYieldTokenHolder.sol";
import "../../tokens/PendleFutureYieldToken.sol";
import "../../tokens/PendleOwnershipToken.sol";
import "../../periphery/Permissions.sol";
import "../../libraries/MathLib.sol";

/// @notice Common contract base for a forge implementation.
/// @dev Each specific forge implementation will need to implement the virtual functions
abstract contract PendleForgeBase is IPendleForge, Permissions {
    using ExpiryUtils for string;
    using SafeMath for uint256;
    using Math for uint256;
    using SafeERC20 for IERC20;

    struct PendleTokens {
        IPendleYieldToken xyt;
        IPendleYieldToken ot;
    }

    IPendleRouter public override router;
    IPendleData public override data;
    bytes32 public immutable override forgeId;
    IERC20 public immutable override rewardToken; // COMP/StkAAVE
    IPendleRewardManager public override rewardManager;
    IPendleYieldContractDeployer public override yieldContractDeployer;
    IPendlePausingManager public pausingManager;

    mapping(address => mapping(uint256 => mapping(address => uint256)))
        public
        override dueInterests;

    mapping(address => mapping(uint256 => uint256)) public totalFee;
    mapping(address => mapping(uint256 => address)) public override yieldTokenHolders; // yieldTokenHolders[yieldToken][expiry]

    string private constant OT = "OT";
    string private constant XYT = "XYT";

    constructor(
        address _governance,
        IPendleRouter _router,
        bytes32 _forgeId,
        address _rewardToken,
        address _rewardManager,
        address _yieldContractDeployer
    ) Permissions(_governance) {
        require(address(_router) != address(0), "ZERO_ADDRESS");
        require(_forgeId != 0x0, "ZERO_BYTES");

        router = _router;
        forgeId = _forgeId;
        data = _router.data();
        rewardToken = IERC20(_rewardToken);
        rewardManager = IPendleRewardManager(_rewardManager);
        yieldContractDeployer = IPendleYieldContractDeployer(_yieldContractDeployer);
        pausingManager = data.pausingManager();
    }

    modifier onlyRouter() {
        require(msg.sender == address(router), "ONLY_ROUTER");
        _;
    }

    modifier onlyXYT(address _underlyingAsset, uint256 _expiry) {
        require(
            msg.sender == address(data.xytTokens(forgeId, _underlyingAsset, _expiry)),
            "ONLY_XYT"
        );
        _;
    }

    modifier onlyOT(address _underlyingAsset, uint256 _expiry) {
        require(
            msg.sender == address(data.otTokens(forgeId, _underlyingAsset, _expiry)),
            "ONLY_OT"
        );
        _;
    }

    // INVARIANT: All write functions must go through this check.
    // All XYT/OT transfers must go through this check as well. As such, XYT/OT transfers are also paused
    function checkNotPaused(address _underlyingAsset, uint256 _expiry) internal view {
        (bool paused, ) =
            pausingManager.checkYieldContractStatus(forgeId, _underlyingAsset, _expiry);
        require(!paused, "YIELD_CONTRACT_PAUSED");
    }

    // Only the forgeEmergencyHandler can call this function, when its in emergencyMode
    // this will allow a spender to spend the whole balance of the specified tokens of the yieldTokenHolder contract
    // the spender should ideally be a contract with logic for users to withdraw out their funds.
    function setUpEmergencyMode(
        address _underlyingAsset,
        uint256 _expiry,
        address[] calldata tokens,
        address spender
    ) external override {
        (, bool emergencyMode) =
            pausingManager.checkYieldContractStatus(forgeId, _underlyingAsset, _expiry);
        require(emergencyMode, "NOT_EMERGENCY");
        (address forgeEmergencyHandler, , ) = pausingManager.forgeEmergencyHandler();
        require(msg.sender == forgeEmergencyHandler, "NOT_EMERGENCY_HANDLER");
        IPendleYieldTokenHolder(yieldTokenHolders[_underlyingAsset][_expiry]).setUpEmergencyMode(
            tokens,
            spender
        );
    }

    function newYieldContracts(address _underlyingAsset, uint256 _expiry)
        external
        override
        onlyRouter
        returns (address ot, address xyt)
    {
        checkNotPaused(_underlyingAsset, _expiry);
        address yieldToken = _getYieldBearingToken(_underlyingAsset);
        uint8 yieldTokenDecimals = IPendleYieldToken(yieldToken).decimals();

        require(yieldToken != address(0), "INVALID_ASSET");

        ot = yieldContractDeployer.forgeOwnershipToken(
            _underlyingAsset,
            OT.concat(IPendleBaseToken(yieldToken).name(), _expiry, " "),
            OT.concat(IPendleBaseToken(yieldToken).symbol(), _expiry, "-"),
            yieldTokenDecimals,
            _expiry
        );

        xyt = yieldContractDeployer.forgeFutureYieldToken(
            _underlyingAsset,
            XYT.concat(IPendleBaseToken(yieldToken).name(), _expiry, " "),
            XYT.concat(IPendleBaseToken(yieldToken).symbol(), _expiry, "-"),
            yieldTokenDecimals,
            _expiry
        );

        // ot address is passed in to be used in the salt of CREATE2
        yieldTokenHolders[_underlyingAsset][_expiry] = yieldContractDeployer
            .deployYieldTokenHolder(yieldToken, ot);

        data.storeTokens(forgeId, ot, xyt, _underlyingAsset, _expiry);

        emit NewYieldContracts(forgeId, _underlyingAsset, _expiry, ot, xyt);
    }

    function redeemAfterExpiry(
        address _account,
        address _underlyingAsset,
        uint256 _expiry,
        uint256 _transferOutRate
    )
        external
        override
        onlyRouter
        returns (
            uint256 redeemedAmount,
            uint256 amountTransferOut,
            uint256 amountToRenew
        )
    {
        checkNotPaused(_underlyingAsset, _expiry);
        IERC20 yieldToken = IERC20(_getYieldBearingToken(_underlyingAsset));
        PendleTokens memory tokens = _getTokens(_underlyingAsset, _expiry);
        uint256 expiredOTamount = IERC20(address(tokens.ot)).balanceOf(_account);
        require(expiredOTamount > 0, "NOTHING_TO_REDEEM");

        // _account will get the principal + the interests from last action before expiry to now
        // NOTE: the interest from the last action before expiry until now, for the OT holders,
        // is not charged a Forge fee. Forge fee is only charged on interests from XYT exclusively.
        redeemedAmount = _calcTotalAfterExpiry(_underlyingAsset, _expiry, expiredOTamount);

        redeemedAmount = redeemedAmount.add(
            _beforeTransferDueInterests(tokens, _underlyingAsset, _expiry, _account, false)
        );

        amountTransferOut = redeemedAmount.rmul(_transferOutRate);
        amountToRenew = redeemedAmount.sub(amountTransferOut);

        _safeTransfer(yieldToken, _underlyingAsset, _expiry, _account, amountTransferOut);

        tokens.ot.burn(_account, expiredOTamount);

        emit RedeemYieldToken(forgeId, _underlyingAsset, _expiry, expiredOTamount, redeemedAmount);
    }

    function redeemUnderlying(
        address _account,
        address _underlyingAsset,
        uint256 _expiry,
        uint256 _amountToRedeem
    ) external override onlyRouter returns (uint256 redeemedAmount) {
        checkNotPaused(_underlyingAsset, _expiry);
        PendleTokens memory tokens = _getTokens(_underlyingAsset, _expiry);
        require(tokens.ot.balanceOf(_account) >= _amountToRedeem, "INSUFFICIENT_OT_AMOUNT");
        require(tokens.xyt.balanceOf(_account) >= _amountToRedeem, "INSUFFICIENT_XYT_AMOUNT");

        IERC20 yieldToken = IERC20(_getYieldBearingToken(_underlyingAsset));

        tokens.ot.burn(_account, _amountToRedeem);
        tokens.xyt.burn(_account, _amountToRedeem);

        // dueInterests has been updated during the process of burning XYT
        redeemedAmount = _calcUnderlyingToRedeem(_underlyingAsset, _amountToRedeem).add(
            _beforeTransferDueInterests(tokens, _underlyingAsset, _expiry, _account, true)
        );
        _safeTransfer(yieldToken, _underlyingAsset, _expiry, _account, redeemedAmount);

        emit RedeemYieldToken(forgeId, _underlyingAsset, _expiry, _amountToRedeem, redeemedAmount);

        return redeemedAmount;
    }

    function redeemDueInterests(
        address _account,
        address _underlyingAsset,
        uint256 _expiry
    ) external override onlyRouter returns (uint256 amountOut) {
        checkNotPaused(_underlyingAsset, _expiry);
        PendleTokens memory tokens = _getTokens(_underlyingAsset, _expiry);
        IERC20 yieldToken = IERC20(_getYieldBearingToken(_underlyingAsset));
        amountOut = _beforeTransferDueInterests(
            tokens,
            _underlyingAsset,
            _expiry,
            _account,
            false
        );
        _safeTransfer(yieldToken, _underlyingAsset, _expiry, _account, amountOut);
    }

    function updateDueInterests(
        address _underlyingAsset,
        uint256 _expiry,
        address _account
    ) external override onlyXYT(_underlyingAsset, _expiry) {
        checkNotPaused(_underlyingAsset, _expiry);
        PendleTokens memory tokens = _getTokens(_underlyingAsset, _expiry);
        uint256 principal = tokens.xyt.balanceOf(_account);
        _updateDueInterests(principal, _underlyingAsset, _expiry, _account);
    }

    function redeemRewardsBeforeOtTransfer(
        address _underlyingAsset,
        uint256 _expiry,
        address _account
    ) external override onlyOT(_underlyingAsset, _expiry) {
        checkNotPaused(_underlyingAsset, _expiry);
        rewardManager.settleUserRewards(_underlyingAsset, _expiry, _account);
    }

    function tokenizeYield(
        address _underlyingAsset,
        uint256 _expiry,
        uint256 _amountToTokenize,
        address _to
    )
        external
        override
        onlyRouter
        returns (
            address ot,
            address xyt,
            uint256 amountTokenMinted
        )
    {
        checkNotPaused(_underlyingAsset, _expiry);
        PendleTokens memory tokens = _getTokens(_underlyingAsset, _expiry);

        amountTokenMinted = _calcAmountToMint(_underlyingAsset, _amountToTokenize);

        tokens.ot.mint(_to, amountTokenMinted);
        tokens.xyt.mint(_to, amountTokenMinted);

        emit MintYieldToken(forgeId, _underlyingAsset, _expiry, amountTokenMinted);
        return (address(tokens.ot), address(tokens.xyt), amountTokenMinted);
    }

    function withdrawForgeFee(address _underlyingAsset, uint256 _expiry)
        external
        override
        onlyGovernance
    {
        checkNotPaused(_underlyingAsset, _expiry);
        IERC20 yieldToken = IERC20(_getYieldBearingToken(_underlyingAsset));

        _updateForgeFee(_underlyingAsset, _expiry, 0); //ping to update interest up to now
        uint256 _totalFee = totalFee[_underlyingAsset][_expiry];
        totalFee[_underlyingAsset][_expiry] = 0;

        address treasuryAddress = data.treasury();
        _safeTransfer(yieldToken, _underlyingAsset, _expiry, treasuryAddress, _totalFee);
    }

    function forwardYieldToken(
        address _underlyingAsset,
        uint256 _fromExpiry,
        uint256 _toExpiry,
        uint256 _amount
    ) external override onlyRouter {
        checkNotPaused(_underlyingAsset, _fromExpiry);
        IERC20 yieldToken = IERC20(_getYieldBearingToken(_underlyingAsset));
        _safeTransfer(
            yieldToken,
            _underlyingAsset,
            _fromExpiry,
            yieldTokenHolders[_underlyingAsset][_toExpiry],
            _amount
        );
    }

    function getYieldBearingToken(address _underlyingAsset) external override returns (address) {
        return _getYieldBearingToken(_underlyingAsset);
    }

    // Invariant: this function must be called before a user's XYT balance is changed
    function _beforeTransferDueInterests(
        PendleTokens memory _tokens,
        address _underlyingAsset,
        uint256 _expiry,
        address _account,
        bool _skipUpdateDueInterests
    ) internal returns (uint256 amountOut) {
        uint256 principal = _tokens.xyt.balanceOf(_account);

        if (!_skipUpdateDueInterests) {
            // INVARIANT: after _updateDueInterests is called, dueInterests[][][] must already be
            // updated with all the due interest for the account, until exactly the current timestamp (no caching whatsoever)
            _updateDueInterests(principal, _underlyingAsset, _expiry, _account);
        }

        amountOut = dueInterests[_underlyingAsset][_expiry][_account];
        dueInterests[_underlyingAsset][_expiry][_account] = 0;

        uint256 forgeFee = data.forgeFee();
        // INVARIANT: every single interest payout due to XYT must go through this line
        if (forgeFee > 0) {
            uint256 forgeFeeAmount = amountOut.rmul(forgeFee);
            amountOut = amountOut.sub(forgeFeeAmount);
            _updateForgeFee(_underlyingAsset, _expiry, forgeFeeAmount);
        }

        emit DueInterestSettled(forgeId, _underlyingAsset, _expiry, amountOut, _account);
    }

    function _safeTransfer(
        IERC20 _yieldToken,
        address _underlyingAsset,
        uint256 _expiry,
        address _account,
        uint256 _amount
    ) internal {
        if (_amount == 0) return;
        address yieldTokenHolder = yieldTokenHolders[_underlyingAsset][_expiry];
        _amount = Math.min(_amount, _yieldToken.balanceOf(yieldTokenHolder));
        _yieldToken.safeTransferFrom(yieldTokenHolder, _account, _amount);
    }

    function _getTokens(address _underlyingAsset, uint256 _expiry)
        internal
        view
        returns (PendleTokens memory _tokens)
    {
        (_tokens.ot, _tokens.xyt) = data.getPendleYieldTokens(forgeId, _underlyingAsset, _expiry);
    }

    // internal functions to be overridden by the specific forge implementation
    function _updateDueInterests(
        uint256 principal,
        address _underlyingAsset,
        uint256 _expiry,
        address _account
    ) internal virtual;

    function _updateForgeFee(
        address _underlyingAsset,
        uint256 _expiry,
        uint256 _feeAmount
    ) internal virtual;

    function _calcTotalAfterExpiry(
        address _underlyingAsset,
        uint256 _expiry,
        uint256 redeemedAmount
    ) internal virtual returns (uint256 totalAfterExpiry);

    function _calcUnderlyingToRedeem(address, uint256 _amountToRedeem)
        internal
        virtual
        returns (uint256 underlyingToRedeem)
    {
        underlyingToRedeem = _amountToRedeem;
    }

    function _calcAmountToMint(address, uint256 _amountToTokenize)
        internal
        virtual
        returns (uint256 amountToMint)
    {
        amountToMint = _amountToTokenize;
    }

    function _getYieldBearingToken(address _underlyingAsset) internal virtual returns (address);
}
