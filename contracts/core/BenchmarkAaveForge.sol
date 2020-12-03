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
pragma solidity ^0.7.0;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import {Factory, Utils} from "../libraries/BenchmarkLibrary.sol";
import "../interfaces/IAaveLendingPoolCore.sol";
import "../interfaces/IBenchmarkBaseToken.sol";
import "../interfaces/IBenchmarkData.sol";
import "../interfaces/IBenchmarkForge.sol";
import "../interfaces/IBenchmarkAaveProvider.sol";
import "../tokens/BenchmarkFutureYieldToken.sol";
import "../tokens/BenchmarkOwnershipToken.sol";


contract BenchmarkAaveForge is IBenchmarkForge, IBenchmarkAaveProvider, ReentrancyGuard {
    using Utils for string;

    struct BenchmarkTokens {
        IBenchmarkYieldToken xyt;
        IBenchmarkYieldToken ot;
    }

    address public immutable override aaveLendingPoolCore;
    IBenchmark public immutable override core;

    mapping(uint256 => uint256) public lastNormalisedIncomeBeforeExpiry;
    mapping(uint256 => mapping(address => uint256)) public lastNormalisedIncome;

    string private constant OT = "OT";
    string private constant XYT = "XYT";

    constructor(
        IBenchmark _core
    ) {
        require(address(_core) != address(0), "Benchmark: zero address");
        core = _core;
    }

    modifier onlyCore() {
        require(msg.sender == address(core), "Benchmark: only core");
        _;
    }

    modifier onlyXYT(uint256 _expiry) {
        IBenchmarkData data = core.data();
        require(
            msg.sender == address(data.xytTokens(forgeId, underlyingAsset, _expiry)),
            "Benchmark: only XYT"
        );
        _;
    }

    function newYieldContracts(uint256 _expiry) public override returns (address ot, address xyt) {
        address aTokenAddress = provider.getATokenAddress(underlyingAsset);
        uint8 aTokenDecimals = IBenchmarkBaseToken(aTokenAddress).decimals();

        string memory otName = OT.concat(IBenchmarkBaseToken(aTokenAddress).name(), " ");
        string memory otSymbol = OT.concat(IBenchmarkBaseToken(aTokenAddress).symbol(), "-");
        string memory xytName = XYT.concat(IBenchmarkBaseToken(aTokenAddress).name(), " ");
        string memory xytSymbol = XYT.concat(IBenchmarkBaseToken(aTokenAddress).symbol(), "-");

        ot = _forgeOwnershipToken(
            otName.concat(_expiry, " "),
            otSymbol.concat(_expiry, "-"),
            aTokenDecimals,
            _expiry
        );
        xyt = _forgeFutureYieldToken(
            ot,
            xytName.concat(_expiry, " "),
            xytSymbol.concat(_expiry, "-"),
            aTokenDecimals,
            _expiry
        );

        IBenchmarkData data = core.data();
        data.storeTokens(ot, xyt, underlyingAsset, _expiry);

        emit NewYieldContracts(ot, xyt, _expiry);
    }

    function redeemDueInterests(uint256 _expiry) public override returns (uint256 interests) {
        BenchmarkTokens memory tokens = _getTokens(_expiry);
        return _settleDueInterests(tokens, _expiry, msg.sender);
    }

    function redeemDueInterestsBeforeTransfer(uint256 _expiry, address _account)
        public
        override
        onlyXYT(_expiry)
        returns (uint256 interests)
    {
        BenchmarkTokens memory tokens = _getTokens(_expiry);
        return _settleDueInterests(tokens, _expiry, _account);
    }

    function redeemAfterExpiry(uint256 _expiry, address _to)
        public
        override
        returns (uint256 redeemedAmount)
    {
        BenchmarkTokens memory tokens = _getTokens(_expiry);

        redeemedAmount = tokens.ot.balanceOf(msg.sender);
        require(block.timestamp > _expiry, "Benchmark: must be after expiry");

        IERC20(underlyingYieldToken).transfer(_to, redeemedAmount);
        _settleDueInterests(tokens, _expiry, msg.sender);
        tokens.ot.burn(msg.sender, redeemedAmount);
    }

    // msg.sender needs to have both OT and XYT tokens
    function redeemUnderlying(
        uint256 _expiry,
        uint256 _amountToRedeem,
        address _to
    ) public override returns (uint256 redeemedAmount) {
        BenchmarkTokens memory tokens = _getTokens(_expiry);

        require(tokens.ot.balanceOf(msg.sender) >= _amountToRedeem, "Must have enough OT tokens");
        require(tokens.xyt.balanceOf(msg.sender) >= _amountToRedeem, "Must have enough XYT tokens");

        IERC20(underlyingYieldToken).transfer(_to, _amountToRedeem);
        _settleDueInterests(tokens, _expiry, msg.sender);

        tokens.ot.burn(msg.sender, _amountToRedeem);
        tokens.xyt.burn(msg.sender, _amountToRedeem);

        return _amountToRedeem;
    }

    function tokenizeYield(
        uint256 _expiry,
        uint256 _amountToTokenize,
        address _to
    ) public override onlyCore returns (address ot, address xyt) {
        BenchmarkTokens memory tokens = _getTokens(_expiry);

        IERC20(underlyingYieldToken).transferFrom(msg.sender, address(this), _amountToTokenize);

        tokens.ot.mint(_to, _amountToTokenize);
        tokens.xyt.mint(_to, _amountToTokenize);
        lastNormalisedIncome[_expiry][_to] = provider.getAaveNormalisedIncome(
            address(underlyingAsset)
        );
        return (address(tokens.ot), address(tokens.xyt));
    }

    function getAaveNormalisedIncome(address _underlyingToken) public view override returns (uint256) {
        return IAaveLendingPoolCore(aaveLendingPoolCore).getReserveNormalizedIncome(_underlyingToken);
    }

    function getATokenAddress(address _underlyingYieldToken) public view override returns (address) {
        return IAaveLendingPoolCore(aaveLendingPoolCore).getReserveATokenAddress(_underlyingYieldToken);
    }

    function _forgeFutureYieldToken(
        address _ot,
        string memory _name,
        string memory _symbol,
        uint8 _decimals,
        uint256 _expiry
    ) internal nonReentrant() returns (address xyt) {
        xyt = Factory.createContract(
            type(BenchmarkFutureYieldToken).creationCode,
            abi.encodePacked(_ot, underlyingAsset, underlyingYieldToken),
            abi.encode(
                _ot,
                underlyingAsset,
                underlyingYieldToken,
                _name,
                _symbol,
                _decimals,
                _expiry
            )
        );
    }

    function _forgeOwnershipToken(
        string memory _name,
        string memory _symbol,
        uint8 _decimals,
        uint256 _expiry
    ) internal nonReentrant() returns (address ot) {
        ot = Factory.createContract(
            type(BenchmarkOwnershipToken).creationCode,
            abi.encodePacked(underlyingAsset, underlyingYieldToken),
            abi.encode(underlyingAsset, underlyingYieldToken, _name, _symbol, _decimals, _expiry)
        );
    }

    function _settleDueInterests(
        BenchmarkTokens memory _tokens,
        uint256 _expiry,
        address _account
    ) internal returns (uint256) {
        uint256 principal = _tokens.xyt.balanceOf(_account);
        uint256 Ix = lastNormalisedIncome[_expiry][_account];
        uint256 In;

        if (block.timestamp >= _expiry) {
            In = lastNormalisedIncomeBeforeExpiry[_expiry];
        } else {
            In = provider.getAaveNormalisedIncome(underlyingAsset);
            lastNormalisedIncomeBeforeExpiry[_expiry] = In;
        }

        uint256 dueInterests = principal.mul(In).div(Ix.sub(principal));

        if (dueInterests > 0) {
            IERC20(underlyingYieldToken).transfer(_account, dueInterests);
        }

        lastNormalisedIncome[_expiry][_account] = In;

        return dueInterests;
    }

    function _getTokens(address _underlyingAsset, uint256 _expiry) internal view returns (BenchmarkTokens memory _tokens) {
        IBenchmarkData data = core.data();
        bytes32 forge = data.getForge(address(this));
        (_tokens.ot, _tokens.xyt) = data.getBenchmarkYieldTokens(protocolIndex, _underlyingAsset, _expiry);
    }
}
