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
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../libraries/ExpiryUtilsLib.sol";
import "../libraries/FactoryLib.sol";
import "../interfaces/ICToken.sol";
import "../interfaces/IPendleBaseToken.sol";
import "../interfaces/IPendleData.sol";
import "../interfaces/IPendleForge.sol";
import "../interfaces/IComptroller.sol";
import "../tokens/PendleFutureYieldToken.sol";
import "../tokens/PendleOwnershipToken.sol";
import "../periphery/Permissions.sol";
import "./PendleForgeBase.sol";

contract PendleCompoundForge is PendleForgeBase {
    using ExpiryUtils for string;
    using SafeMath for uint256;

    IComptroller public immutable comptroller;

    uint256 private initialRate = 0;
    mapping(address => address) public underlyingToCToken;
    mapping(address => mapping(uint256 => uint256)) public lastRateBeforeExpiry;
    mapping(address => mapping(uint256 => mapping(address => uint256))) public lastRate;

    event RegisterCTokens(address[] underlyingAssets, address[] cTokens);

    constructor(
        address _governance,
        IPendleRouter _router,
        IComptroller _comptroller,
        bytes32 _forgeId
    ) PendleForgeBase(_governance, _router, _forgeId) {
        require(address(_comptroller) != address(0), "ZERO_ADDRESS");

        comptroller = _comptroller;
    }

    function registerCTokens(address[] calldata _underlyingAssets, address[] calldata _cTokens)
        external
        onlyGovernance
    {
        require(_underlyingAssets.length == _cTokens.length, "LENGTH_MISMATCH");

        for (uint256 i = 0; i < _cTokens.length; ++i) {
            // once the underlying CToken has been set, it cannot be changed
            require(underlyingToCToken[_underlyingAssets[i]] == address(0), "FORBIDDEN");
            require(_isValidCToken(_underlyingAssets[i], _cTokens[i]), "INVALID_CTOKEN_DATA");
            underlyingToCToken[_underlyingAssets[i]] = _cTokens[i];
        }

        emit RegisterCTokens(_underlyingAssets, _cTokens);
    }

    function _isValidCToken(address _underlyingAsset, address _cTokenAddress)
        internal
        returns (bool isValid)
    {
        if (comptroller.markets(_cTokenAddress).isListed != true) {
            return false;
        }
        if (ICToken(_cTokenAddress).isCToken() != true) {
            return false;
        }
        if (ICToken(_cTokenAddress).underlying() != _underlyingAsset) {
            return false;
        }
        return true;
    }

    function _calcTotalAfterExpiry(
        address,
        address _underlyingAsset,
        uint256 _expiry,
        uint256 redeemedAmount
    ) internal view override returns (uint256 totalAfterExpiry) {
        // interests from the timestamp of the last XYT transfer (before expiry) to now is entitled to the OT holders
        // this means that the OT holders are getting some extra interests, at the expense of XYT holders
        totalAfterExpiry = redeemedAmount.mul(initialRate).div(
            lastRateBeforeExpiry[_underlyingAsset][_expiry]
        );
    }

    function _calcUnderlyingToRedeem(address _underlyingAsset, uint256 _amountToRedeem)
        internal
        override
        returns (uint256 underlyingToRedeem)
    {
        ICToken cToken = ICToken(underlyingToCToken[_underlyingAsset]);
        uint256 currentRate = cToken.exchangeRateCurrent();
        underlyingToRedeem = _amountToRedeem.mul(initialRate).div(currentRate);
    }

    function _calcAmountToMint(address _underlyingAsset, uint256 _amountToTokenize)
        internal
        override
        returns (uint256 amountToMint)
    {
        ICToken cToken = ICToken(underlyingToCToken[_underlyingAsset]);
        uint256 currentRate = cToken.exchangeRateCurrent();
        if (initialRate == 0) {
            initialRate = currentRate;
        }
        amountToMint = _amountToTokenize.mul(currentRate).div(initialRate);
    }

    function _getYieldBearingToken(address _underlyingAsset)
        internal
        view
        override
        returns (address)
    {
        return underlyingToCToken[_underlyingAsset];
    }

    struct InterestVariables {
        uint256 prevRate;
        uint256 currentRate;
        ICToken cToken;
    }

    function _calcDueInterests(
        uint256 principal,
        address _underlyingAsset,
        uint256 _expiry,
        address _account
    ) internal override returns (uint256 dueInterests) {
        InterestVariables memory interestVariables;

        interestVariables.prevRate = lastRate[_underlyingAsset][_expiry][_account];
        interestVariables.cToken = ICToken(underlyingToCToken[_underlyingAsset]);

        if (block.timestamp >= _expiry) {
            interestVariables.currentRate = lastRateBeforeExpiry[_underlyingAsset][_expiry];
        } else {
            interestVariables.currentRate = interestVariables.cToken.exchangeRateCurrent();
            lastRateBeforeExpiry[_underlyingAsset][_expiry] = interestVariables.currentRate;
        }

        lastRate[_underlyingAsset][_expiry][_account] = interestVariables.currentRate;
        // first time getting XYT
        if (interestVariables.prevRate == 0) {
            return 0;
        }
        // dueInterests is a difference between yields where newer yield increased proportionally
        // by currentExchangeRate / prevExchangeRate for cTokens to underyling asset
        if (interestVariables.currentRate <= interestVariables.prevRate) {
            return 0;
        }
        dueInterests = principal
            .mul(interestVariables.currentRate)
            .div(interestVariables.prevRate)
            .sub(principal)
            .mul(initialRate)
            .div(interestVariables.currentRate);
    }
}
