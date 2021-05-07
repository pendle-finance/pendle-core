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
import "../interfaces/IPendleCompoundForge.sol";
import "../interfaces/IPendleData.sol";
import "../interfaces/IPendleForge.sol";
import "../interfaces/IComptroller.sol";
import "../tokens/PendleFutureYieldToken.sol";
import "../tokens/PendleOwnershipToken.sol";
import "../periphery/Permissions.sol";
import "./abstract/PendleForgeBase.sol";
import "./PendleCompoundYieldTokenHolder.sol";

contract PendleCompoundForge is PendleForgeBase, IPendleCompoundForge {
    using ExpiryUtils for string;
    using SafeMath for uint256;
    using Math for uint256;

    IComptroller public immutable comptroller;

    mapping(address => uint256) public initialRate;
    mapping(address => address) public underlyingToCToken;
    mapping(address => mapping(uint256 => uint256)) public lastRateBeforeExpiry;
    mapping(address => mapping(uint256 => mapping(address => uint256))) public lastRate;

    event RegisterCTokens(address[] underlyingAssets, address[] cTokens);

    constructor(
        address _governance,
        IPendleRouter _router,
        IComptroller _comptroller,
        bytes32 _forgeId,
        address _rewardToken,
        address _rewardManager,
        address _yieldContractDeployer
    )
        PendleForgeBase(
            _governance,
            _router,
            _forgeId,
            _rewardToken,
            _rewardManager,
            _yieldContractDeployer
        )
    {
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
            verifyCToken(_underlyingAssets[i], _cTokens[i]);
            underlyingToCToken[_underlyingAssets[i]] = _cTokens[i];
            initialRate[_underlyingAssets[i]] = ICToken(_cTokens[i]).exchangeRateCurrent();
        }

        emit RegisterCTokens(_underlyingAssets, _cTokens);
    }

    function verifyCToken(address _underlyingAsset, address _cTokenAddress) internal {
        require(
            comptroller.markets(_cTokenAddress).isListed &&
                ICToken(_cTokenAddress).isCToken() &&
                ICToken(_cTokenAddress).underlying() == _underlyingAsset,
            "INVALID_CTOKEN_DATA"
        );
    }

    function _calcTotalAfterExpiry(
        address _underlyingAsset,
        uint256 _expiry,
        uint256 redeemedAmount
    ) internal view override returns (uint256 totalAfterExpiry) {
        // interests from the timestamp of the last XYT transfer (before expiry) to now is entitled to the OT holders
        // this means that the OT holders are getting some extra interests, at the expense of XYT holders
        totalAfterExpiry = redeemedAmount.mul(initialRate[_underlyingAsset]).div(
            lastRateBeforeExpiry[_underlyingAsset][_expiry]
        );
    }

    function getExchangeRateBeforeExpiry(address _underlyingAsset, uint256 _expiry)
        internal
        returns (uint256)
    {
        if (block.timestamp > _expiry) {
            return lastRateBeforeExpiry[_underlyingAsset][_expiry];
        }
        uint256 exchangeRate = ICToken(underlyingToCToken[_underlyingAsset]).exchangeRateCurrent();

        lastRateBeforeExpiry[_underlyingAsset][_expiry] = exchangeRate;
        return exchangeRate;
    }

    function getExchangeRate(address _underlyingAsset) public override returns (uint256) {
        return ICToken(underlyingToCToken[_underlyingAsset]).exchangeRateCurrent();
    }

    function _calcUnderlyingToRedeem(address _underlyingAsset, uint256 _amountToRedeem)
        internal
        override
        returns (uint256 underlyingToRedeem)
    {
        uint256 currentRate = getExchangeRate(_underlyingAsset);
        underlyingToRedeem = _amountToRedeem.mul(initialRate[_underlyingAsset]).div(currentRate);
    }

    function _calcAmountToMint(address _underlyingAsset, uint256 _amountToTokenize)
        internal
        override
        returns (uint256 amountToMint)
    {
        uint256 currentRate = getExchangeRate(_underlyingAsset);
        amountToMint = _amountToTokenize.mul(currentRate).div(initialRate[_underlyingAsset]);
    }

    function _getYieldBearingToken(address _underlyingAsset)
        internal
        view
        override
        returns (address)
    {
        require(underlyingToCToken[_underlyingAsset] != address(0), "INVALID_UNDERLYING_ASSET");
        return underlyingToCToken[_underlyingAsset];
    }

    /**
    * @dev different from AaveForge, here there is no compound interest occured because the amount
    of cToken always remains unchanged, only the exchangeRate does.
    */
    function _updateDueInterests(
        uint256 principal,
        address _underlyingAsset,
        uint256 _expiry,
        address _account
    ) internal override {
        uint256 prevRate = lastRate[_underlyingAsset][_expiry][_account];
        uint256 currentRate = getExchangeRateBeforeExpiry(_underlyingAsset, _expiry);

        lastRate[_underlyingAsset][_expiry][_account] = currentRate;
        // first time getting XYT
        if (prevRate == 0) {
            return;
        }
        // split into 2 statements to avoid stack error
        uint256 interestFromXyt = principal.mul(currentRate).div(prevRate).sub(principal);
        interestFromXyt = interestFromXyt.mul(initialRate[_underlyingAsset]).div(currentRate);

        dueInterests[_underlyingAsset][_expiry][_account] = dueInterests[_underlyingAsset][
            _expiry
        ][_account]
            .add(interestFromXyt);
    }

    function _updateForgeFee(
        address _underlyingAsset,
        uint256 _expiry,
        uint256 _feeAmount
    ) internal override {
        totalFee[_underlyingAsset][_expiry] = totalFee[_underlyingAsset][_expiry].add(_feeAmount);
    }
}
