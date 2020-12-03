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
import "../interfaces/IAaveLendingPoolCore.sol";
import "../tokens/BenchmarkFutureYieldToken.sol";
import "../tokens/BenchmarkOwnershipToken.sol";


contract BenchmarkAaveForge is IBenchmarkForge, ReentrancyGuard {
    using Utils for string;

    struct BenchmarkTokens {
        IBenchmarkYieldToken xyt;
        IBenchmarkYieldToken ot;
    }

    /* address public immutable override factory; */
    IAaveLendingPoolCore public aaveLendingPoolCore;
    address public immutable override underlyingAsset;
    address public immutable override underlyingYieldToken;
    IBenchmark public immutable override core;

    mapping(uint256 => uint256) public lastNormalisedIncomeBeforeExpiry;
    mapping(uint256 => mapping(address => uint256)) public lastNormalisedIncome;
    bytes32 public override protocolId;

    string private constant OT = "OT-Aave";
    string private constant XYT = "XYT-Aave";

    //TODO: automatically get underlyingYieldToken from the provider
    constructor(
        IAaveLendingPoolCore _aaveLendingPoolCore,
        IBenchmark _core,
        address _underlyingAsset,
        address _underlyingYieldToken,
        bytes32 _protocolId
    ) {
        require(address(_aaveLendingPoolCore) != address(0), "Benchmark: zero address");
        require(address(_core) != address(0), "Benchmark: zero address");
        require(_underlyingAsset != address(0), "Benchmark: zero address");
        require(_underlyingYieldToken != address(0), "Benchmark: zero address");

        aaveLendingPoolCore = _aaveLendingPoolCore;
        core = _core;
        underlyingAsset = _underlyingAsset;
        underlyingYieldToken = _underlyingYieldToken;
        protocolId = _protocolId;
    }

    modifier onlyXYT(uint256 _expiry) {
        IBenchmarkData data = core.data();
        require(
            msg.sender == address(data.xytTokens(protocolId, underlyingAsset, _expiry)),
            "Benchmark: only XYT"
        );
        _;
    }

    function newYieldContracts(uint256 expiry) public override returns (address ot, address xyt) {
        address aTokenAddress = aaveLendingPoolCore.getReserveATokenAddress(underlyingAsset);
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
            xytName.concat(expiry, " "),
            xytSymbol.concat(expiry, "-"),
            aTokenDecimals,
            expiry
        );

        IBenchmarkData data = core.data();
        data.storeTokens(protocolId, ot, xyt, underlyingAsset, expiry);

        emit NewYieldContracts(ot, xyt, expiry);
    }

    function redeemDueInterests(uint256 expiry) public override returns (uint256 interests) {
        BenchmarkTokens memory tokens = _getTokens(expiry);
        return _settleDueInterests(tokens, expiry, msg.sender);
    }

    function redeemDueInterestsBeforeTransfer(uint256 _expiry, address account)
        public
        override
        onlyXYT(_expiry)
        returns (uint256 interests)
    {
        BenchmarkTokens memory tokens = _getTokens(_expiry);
        return _settleDueInterests(tokens, _expiry, account);
    }

    function redeemAfterExpiry(uint256 expiry, address to)
        public
        override
        returns (uint256 redeemedAmount)
    {
        BenchmarkTokens memory tokens = _getTokens(expiry);

        redeemedAmount = tokens.ot.balanceOf(msg.sender);
        require(block.timestamp > expiry, "Must be after expiry");

        IERC20(underlyingYieldToken).transfer(to, redeemedAmount);
        _settleDueInterests(tokens, expiry, msg.sender);
        tokens.ot.burn(msg.sender, redeemedAmount);
    }

    // msg.sender needs to have both OT and XYT tokens
    function redeemUnderlying(
        uint256 expiry,
        uint256 amountToRedeem,
        address to
    ) public override returns (uint256 redeemedAmount) {
        BenchmarkTokens memory tokens = _getTokens(expiry);

        require(tokens.ot.balanceOf(msg.sender) >= amountToRedeem, "Must have enough OT tokens");
        require(tokens.xyt.balanceOf(msg.sender) >= amountToRedeem, "Must have enough XYT tokens");

        IERC20(underlyingYieldToken).transfer(to, amountToRedeem);
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
        BenchmarkTokens memory tokens = _getTokens(_expiry);

        IERC20(underlyingYieldToken).transferFrom(msg.sender, address(this), _amountToTokenize);

        tokens.ot.mint(_to, _amountToTokenize);
        tokens.xyt.mint(_to, _amountToTokenize);
        lastNormalisedIncome[_expiry][_to] = aaveLendingPoolCore.getReserveNormalizedIncome(address(underlyingAsset));
        return (address(tokens.ot), address(tokens.xyt));
    }

    function _forgeFutureYieldToken(
        string memory _name,
        string memory _symbol,
        uint8 _decimals,
        uint256 _expiry
    ) internal nonReentrant() returns (address xyt) {
        xyt = Factory.createContract(
            type(BenchmarkFutureYieldToken).creationCode,
            abi.encodePacked(underlyingAsset, underlyingYieldToken),
            abi.encode(
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

    //TODO: safemath
    function _settleDueInterests(
        BenchmarkTokens memory tokens,
        uint256 expiry,
        address account
    ) internal returns (uint256) {
        uint256 principal = tokens.xyt.balanceOf(account);
        uint256 Ix = lastNormalisedIncome[expiry][account];
        uint256 In;
        if (block.timestamp >= expiry) {
            In = lastNormalisedIncomeBeforeExpiry[expiry];
        } else {
            In = aaveLendingPoolCore.getReserveNormalizedIncome(underlyingAsset);
            lastNormalisedIncomeBeforeExpiry[expiry] = In;
        }

        uint256 dueInterests = (principal * In) / Ix - principal;

        if (dueInterests > 0) {
            IERC20(underlyingYieldToken).transfer(account, dueInterests);
        }

        lastNormalisedIncome[expiry][account] = In;
        return dueInterests;
    }

    function _getTokens(uint256 _expiry) internal view returns (BenchmarkTokens memory _tokens) {
        IBenchmarkData data = core.data();
        (_tokens.ot, _tokens.xyt) = data.getBenchmarkYieldTokens(protocolId, underlyingAsset, _expiry);
    }
}
