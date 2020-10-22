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

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./BenchmarkProvider.sol";
import "../interfaces/IBenchmarkForge.sol";
import "../interfaces/IBenchmarkToken.sol";
import "../tokens/BenchmarkFutureYieldToken.sol";
import "../tokens/BenchmarkOwnershipToken.sol";
import "@nomiclabs/buidler/console.sol";


contract BenchmarkForge is IBenchmarkForge, ReentrancyGuard {
    address public immutable override factory;
    address public immutable override treasury;
    address public immutable override underlyingToken;
    BenchmarkProvider public immutable override provider;

    mapping (ContractDurations => mapping(uint256 => address)) public otTokens;
    mapping (ContractDurations => mapping(uint256 => mapping(address => uint256))) public lastNormalisedIncome;
    mapping (ContractDurations => mapping(uint256 => address)) public xytTokens;
    mapping (uint256 => uint256) public lastNormalisedIncomeBeforeExpiry;

    constructor(address _underlyingToken, address _treasury, BenchmarkProvider _provider) {
        require(_underlyingToken != address(0), "Benchmark: zero address");
        require(_treasury != address(0), "Benchmark: zero address");
        require(address(_provider) != address(0), "Benchmark: zero address");

        factory = msg.sender;
        underlyingToken = _underlyingToken;
        treasury = _treasury;
        provider = _provider;
    }

    struct Tokens {
        BenchmarkFutureYieldToken xytContract;
        BenchmarkOwnershipToken otContract;
        IERC20 underlyingYieldToken;
    }

    function getTokens(
        ContractDurations contractDuration,
        uint256 expiry
    ) internal returns (Tokens memory _tokens) {
        _tokens.xytContract = BenchmarkFutureYieldToken(xytTokens[contractDuration][expiry]);
        _tokens.otContract = BenchmarkOwnershipToken(otTokens[contractDuration][expiry]);
        _tokens.underlyingYieldToken = IERC20(provider.getATokenAddress(underlyingToken));
    }

    function redeemDueInterests(
        ContractDurations contractDuration,
        uint256 expiry
    ) external override returns (uint256 interests) {
        Tokens memory tokens = getTokens(contractDuration, expiry);
        return settleDueInterests(tokens, contractDuration, expiry, msg.sender);
    }

    function redeemDueInterestsBeforeTransfer(
        ContractDurations contractDuration,
        uint256 expiry,
        address account
    ) external returns (uint256 interests) {
        require(msg.sender == xytTokens[contractDuration][expiry], "Must be from the XYT token contract");
        Tokens memory tokens = getTokens(contractDuration, expiry);
        return settleDueInterests(tokens, contractDuration, expiry, account);
    }

    function redeemAfterExpiry(
        ContractDurations contractDuration,
        uint256 expiry,
        address to
    ) external override returns (uint256 redeemedAmount) {
        Tokens memory tokens = getTokens(contractDuration, expiry);

        redeemedAmount = tokens.otContract.balanceOf(msg.sender);
        require(block.timestamp > expiry, "Must have after expiry");

        tokens.underlyingYieldToken.transfer(to, redeemedAmount);
        settleDueInterests(tokens, contractDuration, expiry, msg.sender);
        tokens.otContract.burn(msg.sender, redeemedAmount);
    }

    // msg.sender needs to have both OT and XYT tokens
    function redeemUnderlying(
        ContractDurations contractDuration,
        uint256 expiry,
        uint256 amountToRedeem,
        address to
    ) external override returns (uint256 redeemedAmount) {
        Tokens memory tokens = getTokens(contractDuration, expiry);

        require(tokens.otContract.balanceOf(msg.sender) >= amountToRedeem, "Must have enough OT tokens");
        require(tokens.xytContract.balanceOf(msg.sender) >= amountToRedeem, "Must have enough XYT tokens");

        tokens.underlyingYieldToken.transfer(to, amountToRedeem);
        settleDueInterests(tokens, contractDuration, expiry, msg.sender);

        tokens.otContract.burn(msg.sender, amountToRedeem);
        tokens.xytContract.burn(msg.sender, amountToRedeem);

        return amountToRedeem;
    }

    //TODO: safemath
    function settleDueInterests(
        Tokens memory tokens,
        ContractDurations contractDuration,
        uint256 expiry,
        address account
    ) internal returns (uint256){
        uint256 principal = tokens.xytContract.balanceOf(account);
        uint256 Ix = lastNormalisedIncome[contractDuration][expiry][account];
        uint256 In;
        if (block.timestamp >= expiry) {
            In = lastNormalisedIncomeBeforeExpiry[expiry];
        } else {
            In = provider.getAaveNormalisedIncome(underlyingToken);
            lastNormalisedIncomeBeforeExpiry[expiry] = In;
        }

        uint256 dueInterests = principal * In / Ix - principal;

        if (dueInterests > 0) {
          tokens.underlyingYieldToken.transfer(account, dueInterests);
        }

        lastNormalisedIncome[contractDuration][expiry][account] = In;
        return dueInterests;
    }

    function tokenizeYield(
        ContractDurations _contractDuration,
        uint256 _expiry,
        uint256 _amountToTokenize,
        address _to
    ) external override returns (address ot, address xyt) {
        Tokens memory tokens = getTokens(_contractDuration, _expiry);

        tokens.underlyingYieldToken.transferFrom(msg.sender, address(this), _amountToTokenize);

        tokens.otContract.mint(_to, _amountToTokenize);
        tokens.xytContract.mint(_to, _amountToTokenize);
        lastNormalisedIncome[_contractDuration][_expiry][_to] = provider.getAaveNormalisedIncome(address(underlyingToken));
        return (address(tokens.otContract), address(tokens.xytContract));
    }


    function newYieldContracts(
        ContractDurations contractDuration,
        uint256 expiry
    ) external override returns (address ot, address xyt) {
        address aTokenAddress = provider.getATokenAddress(underlyingToken);
        uint8 aTokenDecimals = IBenchmarkToken(aTokenAddress).decimals(); // IBenchmarkToken extends ERC20, so using this is good enough

        // TODO: Use actual aTokens
        ot = _forgeOwnershipToken(aTokenDecimals, "OT Test Token", "OT_TEST", contractDuration, expiry);
        xyt = _forgeFutureYieldToken(aTokenDecimals, "XYT Test Token", "XYT_TEST", contractDuration, expiry);
        otTokens[contractDuration][expiry] = ot;
        xytTokens[contractDuration][expiry] = xyt;
    }

    function _forgeFutureYieldToken(
        uint8 _underlyingYieldTokenDecimals,
        string memory _tokenName,
        string memory _tokenSymbol,
        ContractDurations _contractDuration,
        uint256 _expiry
    ) internal nonReentrant() returns (address xyt) {
        bytes memory bytecode = type(BenchmarkFutureYieldToken).creationCode;
        bytes32 salt = keccak256(abi.encodePacked(underlyingToken, _contractDuration));

        bytecode = abi.encodePacked(
            bytecode,
            abi.encode(
                address(provider),
                underlyingToken,
                _underlyingYieldTokenDecimals,
                _tokenName,
                _tokenSymbol,
                _contractDuration,
                _expiry
            )
        );

        assembly {
            xyt := create2(0, add(bytecode, 32), mload(bytecode), salt)
        }
    }

    function _forgeOwnershipToken(
        uint8 _underlyingYieldTokenDecimals,
        string memory _tokenName,
        string memory _tokenSymbol,
        ContractDurations _contractDuration,
        uint256 _expiry
    ) internal nonReentrant() returns (address ot) {
        bytes memory bytecode = type(BenchmarkOwnershipToken).creationCode;
        bytes32 salt = keccak256(abi.encodePacked(underlyingToken, _contractDuration));

        bytecode = abi.encodePacked(
            bytecode,
            abi.encode(
                address(provider),
                underlyingToken,
                _underlyingYieldTokenDecimals,
                _tokenName,
                _tokenSymbol,
                _contractDuration,
                _expiry
            )
        );

        assembly {
            ot := create2(0, add(bytecode, 32), mload(bytecode), salt)
        }
    }
}
