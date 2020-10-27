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
import "../interfaces/IBenchmarkProvider.sol";
import "../interfaces/IBenchmarkToken.sol";
import "../periphery/Utils.sol";
import "../tokens/BenchmarkFutureYieldToken.sol";
import "../tokens/BenchmarkOwnershipToken.sol";

contract BenchmarkForge is IBenchmarkForge, ReentrancyGuard, Utils {
    address public immutable override factory;
    address public immutable override underlyingYieldToken;
    IBenchmarkProvider public immutable override provider;

    mapping(ContractDurations => mapping(uint256 => address)) public otTokens;
    mapping(ContractDurations => mapping(uint256 => mapping(address => uint256)))
        public lastNormalisedIncome;
    mapping(ContractDurations => mapping(uint256 => address)) public xytTokens;

    constructor(IBenchmarkProvider _provider, address _underlyingYieldToken) {
        require(_underlyingYieldToken != address(0), "Benchmark: zero address");

        factory = msg.sender;
        provider = _provider;
        underlyingYieldToken = _underlyingYieldToken;
    }

    function newYieldContracts(ContractDurations contractDuration, uint256 expiry)
        external
        override
        returns (address ot, address xyt)
    {
        address aTokenAddress = provider.getATokenAddress(underlyingYieldToken);
        uint8 aTokenDecimals = IBenchmarkToken(aTokenAddress).decimals(); // IBenchmarkToken extends ERC20, so using this is good enough

        // TODO: Use actual aTokens
        ot = _forgeOwnershipToken(
            aTokenAddress,
            aTokenDecimals,
            "OT Test Token",
            "OT_TEST",
            contractDuration,
            expiry
        );
        xyt = _forgeFutureYieldToken(
            ot,
            aTokenAddress,
            aTokenDecimals,
            "XYT Test Token",
            "XYT_TEST",
            contractDuration,
            expiry
        );
        otTokens[contractDuration][expiry] = ot;
        xytTokens[contractDuration][expiry] = xyt;
    }

    function redeem(uint256 _amount) external {
        // require(_amount > 0, "Amount to redeem needs to be > 0");

        // uint256 amountToRedeem = _amount;

        // //if amount is equal to uint(-1), the user wants to redeem everything
        // if (_amount == UINT_MAX_VALUE) {
        //     amountToRedeem = currentBalance;
        // }

        // require(
        //     amountToRedeem <= token.balanceOf(msg.sender),
        //     "Cannot redeem more than the available balance"
        // );

        // // burns tokens equivalent to the amount requested
        // _burn(msg.sender, amountToRedeem);

        // // executes redeem of the underlying asset
        // forge.redeemUnderlying(
        //     underlyingAssetAddress,
        //     msg.sender,
        //     amountToRedeem,
        //     currentBalance.sub(amountToRedeem)
        // );

        // emit Redeem(msg.sender, amountToRedeem);
    }

    // msg.sender needs to have both OT and XYT tokens
    function redeemUnderlying(
        ContractDurations contractDuration,
        uint256 expiry,
        uint256 amountToRedeem,
        address to
    ) external override returns (uint256 redeemedAmount) {
        BenchmarkFutureYieldToken xytContract = BenchmarkFutureYieldToken(
            xytTokens[contractDuration][expiry]
        );
        BenchmarkOwnershipToken otContract = BenchmarkOwnershipToken(
            otTokens[contractDuration][expiry]
        );
        IERC20 underlyingToken = IERC20(provider.getATokenAddress(underlyingYieldToken));

        require(otContract.balanceOf(msg.sender) >= amountToRedeem, "Must have enough OT tokens");
        require(
            xytContract.balanceOf(msg.sender) >= amountToRedeem,
            "Must have enough XYT tokens"
        );

        underlyingToken.transfer(to, amountToRedeem);
        settleDueInterests(contractDuration, expiry, xytContract, msg.sender);
        otContract.burn(msg.sender, amountToRedeem);
        xytContract.burn(msg.sender, amountToRedeem);

        return amountToRedeem;
    }

    //TODO: safemath
    function settleDueInterests(
        ContractDurations contractDuration,
        uint256 expiry,
        BenchmarkFutureYieldToken xytContract,
        address account
    ) internal returns (uint256) {
        IERC20 underlyingToken = IERC20(provider.getATokenAddress(underlyingYieldToken));
        uint256 principal = xytContract.balanceOf(account);
        uint256 Ix = lastNormalisedIncome[contractDuration][expiry][account];
        uint256 In = provider.getAaveNormalisedIncome(underlyingYieldToken);

        uint256 dueInterests = (principal * In) / Ix - principal;

        if (dueInterests > 0) {
            underlyingToken.transfer(account, dueInterests);
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
        BenchmarkFutureYieldToken xytContract = BenchmarkFutureYieldToken(
            xytTokens[_contractDuration][_expiry]
        );
        BenchmarkOwnershipToken otContract = BenchmarkOwnershipToken(
            otTokens[_contractDuration][_expiry]
        );

        IERC20 underlyingToken = IERC20(provider.getATokenAddress(underlyingYieldToken));
        underlyingToken.transferFrom(msg.sender, address(this), _amountToTokenize);

        otContract.mint(_to, _amountToTokenize);
        xytContract.mint(_to, _amountToTokenize);
        lastNormalisedIncome[_contractDuration][_expiry][_to] = provider.getAaveNormalisedIncome(
            address(underlyingToken)
        );
        return (address(otContract), address(xytContract));
    }

    function _forgeFutureYieldToken(
        address _ot,
        address _underlyingYieldToken,
        uint8 _underlyingYieldTokenDecimals,
        string memory _tokenName,
        string memory _tokenSymbol,
        ContractDurations _contractDuration,
        uint256 _expiry
    ) internal nonReentrant() returns (address xyt) {
        bytes memory bytecode = type(BenchmarkFutureYieldToken).creationCode;
        bytes32 salt = keccak256(abi.encodePacked(_ot, _underlyingYieldToken, _contractDuration));

        bytecode = abi.encodePacked(
            bytecode,
            abi.encode(
                _ot,
                _underlyingYieldToken,
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
        address _underlyingYieldToken,
        uint8 _underlyingYieldTokenDecimals,
        string memory _tokenName,
        string memory _tokenSymbol,
        ContractDurations _contractDuration,
        uint256 _expiry
    ) internal nonReentrant() returns (address ot) {
        bytes memory bytecode = type(BenchmarkOwnershipToken).creationCode;
        bytes32 salt = keccak256(abi.encodePacked(_underlyingYieldToken, _contractDuration));

        bytecode = abi.encodePacked(
            bytecode,
            abi.encode(
                _underlyingYieldToken,
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
