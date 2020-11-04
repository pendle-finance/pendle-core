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
import {Factory, Utils} from "../libraries/BenchmarkLibrary.sol";
import "../interfaces/IBenchmarkBaseToken.sol";
import "../interfaces/IBenchmarkData.sol";
import "../interfaces/IBenchmarkForge.sol";
import "../tokens/BenchmarkFutureYieldToken.sol";
import "../tokens/BenchmarkOwnershipToken.sol";


contract BenchmarkForge is IBenchmarkForge, ReentrancyGuard {
    using Utils for string;

    struct Tokens {
        BenchmarkFutureYieldToken xyt;
        BenchmarkOwnershipToken ot;
        IERC20 underlyingYieldToken;
    }

    address public immutable override factory;
    address public immutable override underlyingAsset;
    address public immutable override underlyingYieldToken;
    IBenchmark public immutable override core;
    IBenchmarkProvider public immutable override provider;

    mapping(uint256 => address) public otTokens;
    mapping(uint256 => address) public xytTokens;
    mapping(uint256 => uint256) public lastNormalisedIncomeBeforeExpiry;
    mapping(uint256 => mapping(address => uint256)) public lastNormalisedIncome;

    string private constant OT = "OT";
    string private constant XYT = "XYT";

    constructor(
        IBenchmark _core,
        IBenchmarkProvider _provider,
        address _factory,
        address _underlyingAsset,
        address _underlyingYieldToken
    ) {
        require(address(_core) != address(0), "Benchmark: zero address");
        require(address(_provider) != address(0), "Benchmark: zero address");
        require(_factory != address(0), "Benchmark: zero address");
        require(_underlyingAsset != address(0), "Benchmark: zero address");
        require(_underlyingYieldToken != address(0), "Benchmark: zero address");

        factory = msg.sender;
        core = _core;
        provider = _provider;
        underlyingAsset = _underlyingAsset;
        underlyingYieldToken = _underlyingYieldToken;
    }

    function newYieldContracts(uint256 expiry) public override returns (address ot, address xyt) {
        address aTokenAddress = provider.getATokenAddress(underlyingAsset);
        uint8 aTokenDecimals = IBenchmarkBaseToken(aTokenAddress).decimals();

        string memory otName = OT.concat(IBenchmarkBaseToken(aTokenAddress).name(), " ");
        string memory otSymbol = OT.concat(IBenchmarkBaseToken(aTokenAddress).symbol(), "-");
        string memory xytName = XYT.concat(IBenchmarkBaseToken(aTokenAddress).name(), " ");
        string memory xytSymbol = XYT.concat(IBenchmarkBaseToken(aTokenAddress).symbol(), "-");

        ot = _forgeOwnershipToken(
            otName.concat(expiry, " "),
            otSymbol.concat(expiry, "-"),
            aTokenDecimals,
            expiry
        );
        xyt = _forgeFutureYieldToken(
            ot,
            xytName.concat(expiry, " "),
            xytSymbol.concat(expiry, "-"),
            aTokenDecimals,
            expiry
        );

        otTokens[expiry] = ot;
        xytTokens[expiry] = xyt;

        IBenchmarkData data = core.data();
        data.storeXYT(xyt, address(this));

        emit NewYieldContracts(ot, xyt, expiry);
    }

    function redeemDueInterests(uint256 expiry) public override returns (uint256 interests) {
        Tokens memory tokens = _getTokens(expiry);
        return _settleDueInterests(tokens, expiry, msg.sender);
    }

    function redeemDueInterestsBeforeTransfer(uint256 expiry, address account)
        public
        override
        returns (uint256 interests)
    {
        require(msg.sender == xytTokens[expiry], "Must be from the XYT token contract");
        Tokens memory tokens = _getTokens(expiry);
        return _settleDueInterests(tokens, expiry, account);
    }

    function redeemAfterExpiry(uint256 expiry, address to)
        public
        override
        returns (uint256 redeemedAmount)
    {
        Tokens memory tokens = _getTokens(expiry);

        redeemedAmount = tokens.ot.balanceOf(msg.sender);
        require(block.timestamp > expiry, "Must be after expiry");

        tokens.underlyingYieldToken.transfer(to, redeemedAmount);
        _settleDueInterests(tokens, expiry, msg.sender);
        tokens.ot.burn(msg.sender, redeemedAmount);
    }

    // msg.sender needs to have both OT and XYT tokens
    function redeemUnderlying(
        uint256 expiry,
        uint256 amountToRedeem,
        address to
    ) public override returns (uint256 redeemedAmount) {
        Tokens memory tokens = _getTokens(expiry);

        require(tokens.ot.balanceOf(msg.sender) >= amountToRedeem, "Must have enough OT tokens");
        require(tokens.xyt.balanceOf(msg.sender) >= amountToRedeem, "Must have enough XYT tokens");

        tokens.underlyingYieldToken.transfer(to, amountToRedeem);
        _settleDueInterests(tokens, expiry, msg.sender);

        tokens.ot.burn(msg.sender, amountToRedeem);
        tokens.xyt.burn(msg.sender, amountToRedeem);

        return amountToRedeem;
    }

    function tokenizeYield(
        uint256 _expiry,
        uint256 _amountToTokenize,
        address _to
    ) public override returns (address ot, address xyt) {
        Tokens memory tokens = _getTokens(_expiry);

        tokens.underlyingYieldToken.transferFrom(msg.sender, address(this), _amountToTokenize);

        tokens.ot.mint(_to, _amountToTokenize);
        tokens.xyt.mint(_to, _amountToTokenize);
        lastNormalisedIncome[_expiry][_to] = provider.getAaveNormalisedIncome(
            address(underlyingAsset)
        );
        return (address(tokens.ot), address(tokens.xyt));
    }

    function getAllXYTFromExpiry(uint256 _expiry)
        public
        view
        override
        returns (address[] memory)
    {}

    function getAllOTFromExpiry(uint256 _expiry) public view override returns (address[] memory) {}

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

    function _getTokens(uint256 expiry) internal view returns (Tokens memory _tokens) {
        _tokens.xyt = BenchmarkFutureYieldToken(xytTokens[expiry]);
        _tokens.ot = BenchmarkOwnershipToken(otTokens[expiry]);
        _tokens.underlyingYieldToken = IERC20(provider.getATokenAddress(underlyingAsset));
    }

    //TODO: safemath
    function _settleDueInterests(
        Tokens memory tokens,
        uint256 expiry,
        address account
    ) internal returns (uint256) {
        uint256 principal = tokens.xyt.balanceOf(account);
        uint256 Ix = lastNormalisedIncome[expiry][account];
        uint256 In;
        if (block.timestamp >= expiry) {
            In = lastNormalisedIncomeBeforeExpiry[expiry];
        } else {
            In = provider.getAaveNormalisedIncome(underlyingAsset);
            lastNormalisedIncomeBeforeExpiry[expiry] = In;
        }

        uint256 dueInterests = (principal * In) / Ix - principal;

        if (dueInterests > 0) {
            tokens.underlyingYieldToken.transfer(account, dueInterests);
        }

        lastNormalisedIncome[expiry][account] = In;
        return dueInterests;
    }
}
