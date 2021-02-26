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
/* pragma solidity 0.7.6;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../libraries/ExpiryUtilsLib.sol";
import "../libraries/FactoryLib.sol";
import "../interfaces/IAaveLendingPoolCore.sol";
import "../interfaces/IPendleBaseToken.sol";
import "../interfaces/IPendleData.sol";
import "../interfaces/IPendleForge.sol";
import "../tokens/PendleFutureYieldToken.sol";
import "../tokens/PendleOwnershipToken.sol";
import "../periphery/Permissions.sol";
import "hardhat/console.sol";

contract PendleAaveForge is IPendleForge, Permissions {
    using ExpiryUtils for string;
    using SafeMath for uint256;

    struct PendleTokens {
        IPendleYieldToken xyt;
        IPendleYieldToken ot;
    }

    IPendleRouter public override router;
    IPendleData private data;
    bytes32 public immutable override forgeId;

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
        require(
            msg.sender == address(data.xytTokens(forgeId, _underlyingAsset, _expiry)),
            "ONLY_XYT"
        );
        _;
    }

    function newYieldContracts(address _underlyingAsset, uint256 _expiry)
        external
        override
        onlyRouter
        returns (address ot, address xyt)
    {
        address yieldToken = getYieldBearingToken(_underlyingAsset);
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

        emit NewYieldContracts(ot, xyt, _expiry);
    }

    function redeemAfterExpiry(
        address _account,
        address _underlyingAsset,
        uint256 _expiry,
        address _to
    ) external override onlyRouter returns (uint256 redeemedAmount) {
        require(block.timestamp > _expiry, "MUST_BE_AFTER_EXPIRY");

        IERC20 yieldToken = IERC20(getYieldBearingToken(_underlyingAsset));
        PendleTokens memory tokens = _getTokens(_underlyingAsset, _expiry);
        redeemedAmount = tokens.ot.balanceOf(_account);

        uint256 totalAfterExpiry = _calcTotalAfterExpiry(_underlyingAsset, _expiry, redeemedAmount);
        yieldToken.transfer(_to, totalAfterExpiry);

        _settleDueInterests(tokens, _underlyingAsset, _expiry, _account);
        tokens.ot.burn(_account, redeemedAmount);

        emit RedeemYieldToken(_underlyingAsset, _expiry, redeemedAmount);
    }

    function _calcTotalAfterExpiry(address _underlyingAsset, uint256 _expiry, uint256 redeemedAmount) internal view virtual returns (uint256 totalAfterExpiry) {}

    /// @dev msg.sender needs to have both OT and XYT tokens
    function redeemUnderlying(
        address _account,
        address _underlyingAsset,
        uint256 _expiry,
        uint256 _amountToRedeem,
        address _to
    ) external override returns (uint256 redeemedAmount) {
        PendleTokens memory tokens = _getTokens(_underlyingAsset, _expiry);



        require(tokens.ot.balanceOf(_account) >= _amountToRedeem, "INSUFFICIENT_OT_AMOUNT");
        require(tokens.xyt.balanceOf(_account) >= _amountToRedeem, "INSUFFICIENT_XYT_AMOUNT");

        IERC20 yieldToken = IERC20(getYieldBearingToken(_underlyingAsset));

        yieldToken.transfer(_to, _amountToRedeem);

        _settleDueInterests(tokens, _underlyingAsset, _expiry, _account);

        tokens.ot.burn(_account, _amountToRedeem);
        tokens.xyt.burn(_account, _amountToRedeem);

        emit RedeemYieldToken(_underlyingAsset, _expiry, _amountToRedeem);

        return _amountToRedeem;
    }

    function redeemDueInterests(
        address _account,
        address _underlyingAsset,
        uint256 _expiry
    ) external override onlyRouter returns (uint256 interests) {
        PendleTokens memory tokens = _getTokens(_underlyingAsset, _expiry);
        return _settleDueInterests(tokens, _underlyingAsset, _expiry, _account);
    }

    function redeemDueInterestsBeforeTransfer(
        address _underlyingAsset,
        uint256 _expiry,
        address _account
    ) external override onlyXYT(_underlyingAsset, _expiry) returns (uint256 interests) {
        PendleTokens memory tokens = _getTokens(_underlyingAsset, _expiry);
        return _settleDueInterests(tokens, _underlyingAsset, _expiry, _account);
    }

    function tokenizeYield(
        address _underlyingAsset,
        uint256 _expiry,
        uint256 _amountToTokenize,
        address _to
    ) external override onlyRouter returns (address ot, address xyt) {
        PendleTokens memory tokens = _getTokens(_underlyingAsset, _expiry);

        tokens.ot.mint(_to, _amountToTokenize);
        tokens.xyt.mint(_to, _amountToTokenize);
        lastNormalisedIncome[_underlyingAsset][_expiry][_to] = aaveLendingPoolCore
            .getReserveNormalizedIncome(address(_underlyingAsset));

        emit MintYieldToken(_underlyingAsset, _expiry, _amountToTokenize);
        return (address(tokens.ot), address(tokens.xyt));
    }

    function getYieldBearingToken(address _underlyingAsset)
        public
        view
        override
        returns (address)
    {
        return aaveLendingPoolCore.getReserveATokenAddress(_underlyingAsset);
    }

    function _forgeFutureYieldToken(
        address _underlyingAsset,
        string memory _name,
        string memory _symbol,
        uint8 _decimals,
        uint256 _expiry
    ) internal returns (address xyt) {
        IERC20 yieldToken = IERC20(getYieldBearingToken(_underlyingAsset));

        xyt = Factory.createContract(
            type(PendleFutureYieldToken).creationCode,
            abi.encodePacked(yieldToken, _underlyingAsset),
            abi.encode(
                _underlyingAsset,
                yieldToken,
                _name,
                _symbol,
                _decimals,
                block.timestamp,
                _expiry
            )
        );
    }

    function _forgeOwnershipToken(
        address _underlyingAsset,
        string memory _name,
        string memory _symbol,
        uint8 _decimals,
        uint256 _expiry
    ) internal returns (address ot) {
        IERC20 yieldToken = IERC20(getYieldBearingToken(_underlyingAsset));

        ot = Factory.createContract(
            type(PendleOwnershipToken).creationCode,
            abi.encodePacked(yieldToken, _underlyingAsset),
            abi.encode(
                _underlyingAsset,
                yieldToken,
                _name,
                _symbol,
                _decimals,
                block.timestamp,
                _expiry
            )
        );
    }

    function _settleDueInterests(
        PendleTokens memory _tokens,
        address _underlyingAsset,
        uint256 _expiry,
        address _account
    ) internal returns (uint256) {
        uint256 principal = _tokens.xyt.balanceOf(_account);
        uint256 ix = lastNormalisedIncome[_underlyingAsset][_expiry][_account];
        uint256 normalizedIncome;

        if (block.timestamp >= _expiry) {
            normalizedIncome = lastNormalisedIncomeBeforeExpiry[_underlyingAsset][_expiry];
        } else {
            normalizedIncome = aaveLendingPoolCore.getReserveNormalizedIncome(_underlyingAsset);
            lastNormalisedIncomeBeforeExpiry[_underlyingAsset][_expiry] = normalizedIncome;
        }
        // first time getting XYT
        if (ix == 0) {
            lastNormalisedIncome[_underlyingAsset][_expiry][_account] = normalizedIncome;
            return 0;
        }
        lastNormalisedIncome[_underlyingAsset][_expiry][_account] = normalizedIncome;

        uint256 dueInterests = principal.mul(normalizedIncome).div(ix).sub(principal);

        if (dueInterests > 0) {
            IERC20 yieldToken = IERC20(getYieldBearingToken(_underlyingAsset));
            IERC20(yieldToken).transfer(_account, dueInterests);

            emit DueInterestSettled(_underlyingAsset, _expiry, dueInterests, _account);
        }

        return dueInterests;
    }

    function _getTokens(address _underlyingAsset, uint256 _expiry)
        internal
        view
        returns (PendleTokens memory _tokens)
    {
        (_tokens.ot, _tokens.xyt) = data.getPendleYieldTokens(forgeId, _underlyingAsset, _expiry);
    }
} */
