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

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../libraries/ExpiryUtilsLib.sol";
import "../libraries/FactoryLib.sol";
import "../interfaces/ICToken.sol";
import "../interfaces/IPendleBaseToken.sol";
import "../interfaces/IPendleData.sol";
import "../interfaces/IPendleForge.sol";
import "../tokens/PendleFutureYieldToken.sol";
import "../tokens/PendleOwnershipToken.sol";
import "../periphery/Permissions.sol";

contract PendleCompoundForge is IPendleForge, Permissions {
    using ExpiryUtils for string;
    using SafeMath for uint256;

    struct PendleTokens {
        IPendleYieldToken xyt;
        IPendleYieldToken ot;
    }

    IPendleRouter public override router;
    bytes32 public immutable override forgeId;
    uint256 private initialRate = 0;
    mapping(address => address) public underlyingToCToken;
    mapping(address => mapping(uint256 => uint256)) public lastRateBeforeExpiry;
    mapping(address => mapping(uint256 => mapping(address => uint256))) public lastRate;

    string private constant OT = "OT";
    string private constant XYT = "XYT";

    event RegisterCTokens(address[] underlyingAssets, address[] cTokens);

    constructor(
        address _governance,
        IPendleRouter _router,
        bytes32 _forgeId
    ) Permissions(_governance) {
        require(address(_router) != address(0), "ZERO_ADDRESS");
        require(_forgeId != 0x0, "ZERO_BYTES");

        router = _router;
        forgeId = _forgeId;
    }

    modifier onlyRouter() {
        require(msg.sender == address(router), "ONLY_ROUTER");
        _;
    }

    modifier onlyXYT(address _underlyingAsset, uint256 _expiry) {
        IPendleData data = router.data();
        require(
            msg.sender == address(data.xytTokens(forgeId, _underlyingAsset, _expiry)),
            "ONLY_XYT"
        );
        _;
    }

    function registerCTokens(address[] calldata _underlyingAssets, address[] calldata _cTokens)
        external
        onlyGovernance
    {
        require(_underlyingAssets.length == _cTokens.length, "LENGTH_MISMATCH");

        for (uint256 i = 0; i < _cTokens.length; ++i) {
            underlyingToCToken[_underlyingAssets[i]] = _cTokens[i];
        }

        emit RegisterCTokens(_underlyingAssets, _cTokens);
    }

    function newYieldContracts(address _underlyingAsset, uint256 _expiry)
        external
        override
        onlyRouter
        returns (address ot, address xyt)
    {
        address cToken = underlyingToCToken[_underlyingAsset];
        uint8 cTokenDecimals = IPendleBaseToken(cToken).decimals();

        ot = _forgeOwnershipToken(
            _underlyingAsset,
            OT.concat(IPendleBaseToken(cToken).name(), _expiry, " "),
            OT.concat(IPendleBaseToken(cToken).symbol(), _expiry, "-"),
            cTokenDecimals,
            _expiry
        );
        xyt = _forgeFutureYieldToken(
            _underlyingAsset,
            ot,
            XYT.concat(IPendleBaseToken(cToken).name(), _expiry, " "),
            XYT.concat(IPendleBaseToken(cToken).symbol(), _expiry, "-"),
            cTokenDecimals,
            _expiry
        );

        IPendleData data = router.data();
        data.storeTokens(forgeId, ot, xyt, _underlyingAsset, _expiry);

        emit NewYieldContracts(ot, xyt, _expiry);
    }

    function redeemAfterExpiry(
        address _msgSender,
        address _underlyingAsset,
        uint256 _expiry,
        address _to
    ) external override onlyRouter returns (uint256 redeemedAmount) {
        require(block.timestamp > _expiry, "MUST_BE_AFTER_EXPIRY");

        ICToken cToken = ICToken(underlyingToCToken[_underlyingAsset]);
        PendleTokens memory tokens = _getTokens(_underlyingAsset, _expiry);
        redeemedAmount = tokens.ot.balanceOf(_msgSender);
        uint256 currentRate = cToken.exchangeRateCurrent();
        uint256 cTokensToRedeem = redeemedAmount.mul(initialRate).div(currentRate);

        // interests from the timestamp of the last XYT transfer (before expiry) to now is entitled to the OT holders
        // this means that the OT holders are getting some extra interests, at the expense of XYT holders
        uint256 totalAfterExpiry =
            currentRate.mul(cTokensToRedeem).div(lastRateBeforeExpiry[_underlyingAsset][_expiry]);
        cToken.transfer(_to, totalAfterExpiry);

        _settleDueInterests(tokens, _underlyingAsset, _expiry, _msgSender);
        tokens.ot.burn(_msgSender, redeemedAmount);

        emit RedeemYieldToken(_underlyingAsset, cTokensToRedeem, _expiry);
    }

    // msg.sender needs to have both OT and XYT tokens
    function redeemUnderlying(
        address _msgSender,
        address _underlyingAsset,
        uint256 _expiry,
        uint256 _amountToRedeem,
        address _to
    ) public override onlyRouter returns (uint256 redeemedAmount) {
        PendleTokens memory tokens = _getTokens(_underlyingAsset, _expiry);
        ICToken cToken = ICToken(underlyingToCToken[_underlyingAsset]);
        uint256 currentRate = cToken.exchangeRateCurrent();
        uint256 underlyingToRedeem = _amountToRedeem.mul(currentRate).div(initialRate);
        require(tokens.ot.balanceOf(_msgSender) >= underlyingToRedeem, "INSUFFICIENT_OT_AMOUNT");
        require(tokens.xyt.balanceOf(_msgSender) >= underlyingToRedeem, "INSUFFICIENT_XYT_AMOUNT");

        cToken.transfer(_to, _amountToRedeem);

        _settleDueInterests(tokens, _underlyingAsset, _expiry, _msgSender);

        tokens.ot.burn(_msgSender, underlyingToRedeem);
        tokens.xyt.burn(_msgSender, underlyingToRedeem);

        emit RedeemYieldToken(_underlyingAsset, _amountToRedeem, _expiry);
        return _amountToRedeem;
    }

    function redeemDueInterests(
        address _msgSender,
        address _underlyingAsset,
        uint256 _expiry
    ) external override onlyRouter returns (uint256 interests) {
        PendleTokens memory tokens = _getTokens(_underlyingAsset, _expiry);
        return _settleDueInterests(tokens, _underlyingAsset, _expiry, _msgSender);
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
        ICToken cToken = ICToken(underlyingToCToken[_underlyingAsset]);
        uint256 currentRate = cToken.exchangeRateCurrent();
        if (initialRate == 0) {
            initialRate = currentRate;
        }
        uint256 amountToMint = _amountToTokenize.mul(currentRate).div(initialRate);
        tokens.ot.mint(_to, amountToMint);
        tokens.xyt.mint(_to, amountToMint);
        lastRate[_underlyingAsset][_expiry][_to] = currentRate;

        emit MintYieldToken(_underlyingAsset, amountToMint, _expiry);
        return (address(tokens.ot), address(tokens.xyt));
    }

    function getYieldBearingToken(address _underlyingAsset)
        public
        view
        override
        returns (address)
    {
        return underlyingToCToken[_underlyingAsset];
    }

    function _forgeFutureYieldToken(
        address _underlyingAsset,
        address _ot,
        string memory _name,
        string memory _symbol,
        uint8 _decimals,
        uint256 _expiry
    ) internal returns (address xyt) {
        ICToken cToken = ICToken(underlyingToCToken[_underlyingAsset]);

        xyt = Factory.createContract(
            type(PendleFutureYieldToken).creationCode,
            abi.encodePacked(cToken, _underlyingAsset),
            abi.encode(
                _ot,
                _underlyingAsset,
                cToken,
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
        ICToken cToken = ICToken(underlyingToCToken[_underlyingAsset]);

        ot = Factory.createContract(
            type(PendleOwnershipToken).creationCode,
            abi.encodePacked(cToken, _underlyingAsset),
            abi.encode(
                cToken,
                _underlyingAsset,
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
        uint256 prevRate = lastRate[_underlyingAsset][_expiry][_account];
        ICToken cToken = ICToken(underlyingToCToken[_underlyingAsset]);
        uint256 currentRate;

        if (block.timestamp >= _expiry) {
            currentRate = lastRateBeforeExpiry[_underlyingAsset][_expiry];
        } else {
            currentRate = cToken.exchangeRateCurrent();
            lastRateBeforeExpiry[_underlyingAsset][_expiry] = currentRate;
        }

        lastRate[_underlyingAsset][_expiry][_account] = currentRate;
        // first time getting XYT
        if (prevRate == 0) {
            return 0;
        }
        // dueInterests is a difference between yields where newer yield increased proportionally
        // by currentExchangeRate / prevExchangeRate for cTokens to underyling asset
        uint256 dueInterests =
            principal.mul(currentRate).div(prevRate).sub(principal).mul(initialRate).div(
                currentRate
            );
        if (dueInterests > 0) {
            cToken.transfer(_account, dueInterests);

            emit DueInterestSettled(_underlyingAsset, _expiry, dueInterests, _account);
        }

        return dueInterests;
    }

    function _getTokens(address _underlyingAsset, uint256 _expiry)
        internal
        view
        returns (PendleTokens memory _tokens)
    {
        IPendleData data = router.data();
        (_tokens.ot, _tokens.xyt) = data.getPendleYieldTokens(forgeId, _underlyingAsset, _expiry);
    }
}
