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
import "../../libraries/FactoryLib.sol";
import "../../interfaces/IAaveLendingPoolCore.sol";
import "../../interfaces/IPendleBaseToken.sol";
import "../../interfaces/IPendleData.sol";
import "../../interfaces/IPendleForge.sol";
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
    mapping(address => uint256) internal dueInterests;

    string private constant OT = "OT";
    string private constant XYT = "XYT";

    constructor(
        address _governance,
        IPendleRouter _router,
        bytes32 _forgeId
    ) Permissions(_governance) {
        require(address(_router) != address(0), "ZERO_ADDRESS");
        require(_forgeId != 0x0, "ZERO_BYTES");

        router = _router;
        forgeId = _forgeId;
        data = _router.data();
    }

    modifier onlyRouter() {
        require(msg.sender == address(router), "ONLY_ROUTER");
        _;
    }

    modifier onlyXYT(address _underlyingAsset, uint256 _expiry) {
        require(msg.sender == address(data.xytTokens(forgeId, _underlyingAsset, _expiry)), "ONLY_XYT");
        _;
    }

    function newYieldContracts(address _underlyingAsset, uint256 _expiry)
        external
        override
        onlyRouter
        returns (address ot, address xyt)
    {
        address yieldToken = _getYieldBearingToken(_underlyingAsset);
        uint8 yieldTokenDecimals = IPendleBaseToken(yieldToken).decimals();

        require(yieldToken != address(0), "INVALID_ASSET");

        ot = _forgeOwnershipToken(
            _underlyingAsset,
            OT.concat(IPendleBaseToken(yieldToken).name(), _expiry, " "),
            OT.concat(IPendleBaseToken(yieldToken).symbol(), _expiry, "-"),
            yieldTokenDecimals,
            _expiry
        );

        xyt = _forgeFutureYieldToken(
            _underlyingAsset,
            XYT.concat(IPendleBaseToken(yieldToken).name(), _expiry, " "),
            XYT.concat(IPendleBaseToken(yieldToken).symbol(), _expiry, "-"),
            yieldTokenDecimals,
            _expiry
        );

        data.storeTokens(forgeId, ot, xyt, _underlyingAsset, _expiry);

        emit NewYieldContracts(forgeId, _underlyingAsset, _expiry, ot, xyt);
    }

    function redeemAfterExpiry(
        address _account,
        address _underlyingAsset,
        uint256 _expiry,
        uint256 _transferOutRate
    ) external override onlyRouter returns (uint256 redeemedAmount, uint256 amountTransferOut) {
        IERC20 yieldToken = IERC20(_getYieldBearingToken(_underlyingAsset));
        PendleTokens memory tokens = _getTokens(_underlyingAsset, _expiry);
        uint256 expiredOTamount = tokens.ot.balanceOf(_account);
        require(expiredOTamount > 0, "NOTHING_TO_REDEEM");

        // _account will get the principal + the interests from last action before expiry to now
        redeemedAmount = _calcTotalAfterExpiry(_underlyingAsset, _expiry, expiredOTamount);

        redeemedAmount = redeemedAmount.add(_settleDueInterests(tokens, _underlyingAsset, _expiry, _account, false));

        amountTransferOut = redeemedAmount.rmul(_transferOutRate);

        _safeTransferOut(yieldToken, _account, amountTransferOut);

        tokens.ot.burn(_account, expiredOTamount);

        emit RedeemYieldToken(forgeId, _underlyingAsset, _expiry, expiredOTamount, redeemedAmount);
    }

    function redeemUnderlying(
        address _account,
        address _underlyingAsset,
        uint256 _expiry,
        uint256 _amountToRedeem
    ) external override returns (uint256 redeemedAmount) {
        PendleTokens memory tokens = _getTokens(_underlyingAsset, _expiry);
        require(tokens.ot.balanceOf(_account) >= _amountToRedeem, "INSUFFICIENT_OT_AMOUNT");
        require(tokens.xyt.balanceOf(_account) >= _amountToRedeem, "INSUFFICIENT_XYT_AMOUNT");

        IERC20 yieldToken = IERC20(_getYieldBearingToken(_underlyingAsset));

        redeemedAmount = _calcUnderlyingToRedeem(_underlyingAsset, _amountToRedeem);

        redeemedAmount = redeemedAmount.add(_settleDueInterests(tokens, _underlyingAsset, _expiry, _account, false));

        tokens.ot.burn(_account, _amountToRedeem);
        tokens.xyt.burn(_account, _amountToRedeem);
        _safeTransferOut(yieldToken, _account, redeemedAmount);

        emit RedeemYieldToken(forgeId, _underlyingAsset, _expiry, _amountToRedeem, redeemedAmount);

        return redeemedAmount;
    }

    function redeemDueInterests(
        address _account,
        address _underlyingAsset,
        uint256 _expiry
    ) external override onlyRouter returns (uint256 amountOut) {
        PendleTokens memory tokens = _getTokens(_underlyingAsset, _expiry);
        return _settleDueInterests(tokens, _underlyingAsset, _expiry, _account, true);
    }

    function redeemDueInterestsBeforeTransfer(
        address _underlyingAsset,
        uint256 _expiry,
        address _account
    ) external override onlyXYT(_underlyingAsset, _expiry) returns (uint256 amountOut) {
        PendleTokens memory tokens = _getTokens(_underlyingAsset, _expiry);
        return _settleDueInterests(tokens, _underlyingAsset, _expiry, _account, true);
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
        PendleTokens memory tokens = _getTokens(_underlyingAsset, _expiry);
        _settleDueInterests(tokens, _underlyingAsset, _expiry, _to, true);

        amountTokenMinted = _calcAmountToMint(_underlyingAsset, _amountToTokenize);

        tokens.ot.mint(_to, amountTokenMinted);
        tokens.xyt.mint(_to, amountTokenMinted);

        emit MintYieldToken(forgeId, _underlyingAsset, _expiry, amountTokenMinted);
        return (address(tokens.ot), address(tokens.xyt), amountTokenMinted);
    }

    function getYieldBearingToken(address _underlyingAsset) external override returns (address) {
        return _getYieldBearingToken(_underlyingAsset);
    }

    function _forgeFutureYieldToken(
        address _underlyingAsset,
        string memory _name,
        string memory _symbol,
        uint8 _decimals,
        uint256 _expiry
    ) internal returns (address xyt) {
        IERC20 yieldToken = IERC20(_getYieldBearingToken(_underlyingAsset));

        xyt = Factory.createContract(
            type(PendleFutureYieldToken).creationCode,
            abi.encodePacked(yieldToken, _underlyingAsset),
            abi.encode(_underlyingAsset, yieldToken, _name, _symbol, _decimals, block.timestamp, _expiry)
        );
    }

    function _forgeOwnershipToken(
        address _underlyingAsset,
        string memory _name,
        string memory _symbol,
        uint8 _decimals,
        uint256 _expiry
    ) internal returns (address ot) {
        IERC20 yieldToken = IERC20(_getYieldBearingToken(_underlyingAsset));

        ot = Factory.createContract(
            type(PendleOwnershipToken).creationCode,
            abi.encodePacked(yieldToken, _underlyingAsset),
            abi.encode(_underlyingAsset, yieldToken, _name, _symbol, _decimals, block.timestamp, _expiry)
        );
    }

    // Invariant: this function must be called before a user's XYT balance is changed
    function _settleDueInterests(
        PendleTokens memory _tokens,
        address _underlyingAsset,
        uint256 _expiry,
        address _account,
        bool doTransferNow
    ) internal returns (uint256 amountOut) {
        uint256 principal = _tokens.xyt.balanceOf(_account);

        _updateDueInterests(principal, _underlyingAsset, _expiry, _account);

        if (dueInterests[_account] > principal.rmul(data.interestUpdateRateDeltaForForge())) {
            IERC20 yieldToken = IERC20(_getYieldBearingToken(_underlyingAsset));
            amountOut = dueInterests[_account];
            dueInterests[_account] = 0;
            if (doTransferNow) {
                _safeTransferOut(yieldToken, _account, amountOut);
            }
            emit DueInterestSettled(forgeId, _underlyingAsset, _expiry, amountOut, _account);
        }
    }

    function _safeTransferOut(
        IERC20 yieldToken,
        address _account,
        uint256 _amount
    ) internal {
        _amount = Math.min(_amount, yieldToken.balanceOf(address(this)));
        if (_amount > 0) yieldToken.safeTransfer(_account, _amount);
    }

    function _getTokens(address _underlyingAsset, uint256 _expiry) internal view returns (PendleTokens memory _tokens) {
        (_tokens.ot, _tokens.xyt) = data.getPendleYieldTokens(forgeId, _underlyingAsset, _expiry);
    }

    // internal functions to be overrided by the specific forge implementation
    function _updateDueInterests(
        uint256 principal,
        address _underlyingAsset,
        uint256 _expiry,
        address _account
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

    function _calcAmountToMint(address, uint256 _amountToTokenize) internal virtual returns (uint256 amountToMint) {
        amountToMint = _amountToTokenize;
    }

    function _getYieldBearingToken(address _underlyingAsset) internal virtual returns (address);
}
