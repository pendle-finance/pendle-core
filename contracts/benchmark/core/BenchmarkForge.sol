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
import "../interfaces/IBenchmarkForge.sol";
import "../interfaces/IBenchmarkToken.sol";
import "../tokens/BenchmarkFutureYieldToken.sol";
import "../tokens/BenchmarkOwnershipToken.sol";
import "./BenchmarkProvider.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";


contract BenchmarkForge is IBenchmarkForge, ReentrancyGuard {
    address public override factory;
    address public override underlyingToken;
    BenchmarkProvider public override provider;

    mapping (ContractDurations => mapping(uint256 => address)) public otTokens;
    mapping (ContractDurations => mapping(uint256 => mapping(address => uint256))) public lastNormalisedIncome;
    mapping (ContractDurations => mapping(uint256 => address)) public xytTokens;

    constructor() {
        factory = msg.sender;
    }

    function initialize(address _underlyingToken, BenchmarkProvider _provider) external override {
        require(msg.sender == factory, "Benchmark: only factory");
        underlyingToken = _underlyingToken;
        provider = _provider;
    }


    // function redeem(uint256 _amount) external {
    //     require(_amount > 0, "Amount to redeem needs to be > 0");

    //     uint256 amountToRedeem = _amount;

    //     //if amount is equal to uint(-1), the user wants to redeem everything
    //     if (_amount == UINT_MAX_VALUE) {
    //         amountToRedeem = currentBalance;
    //     }

    //     require(
    //         amountToRedeem <= token.balanceOf(msg.sender),
    //         "Cannot redeem more than the available balance"
    //     );

    //     // burns tokens equivalent to the amount requested
    //     _burn(msg.sender, amountToRedeem);

    //     // executes redeem of the underlying asset
    //     forge.redeemUnderlying(
    //         underlyingAssetAddress,
    //         msg.sender,
    //         amountToRedeem,
    //         currentBalance.sub(amountToRedeem)
    //     );

    //     emit Redeem(msg.sender, amountToRedeem);
    // }

    // msg.sender needs to have both OT and XYT tokens
    function redeemUnderlying(
        ContractDurations contractDuration,
        uint256 expiry,
        uint256 amountToRedeem,
        address to
    ) external override returns (uint256 redeemedAmount) {
        BenchmarkFutureYieldToken xytContract = BenchmarkFutureYieldToken(xytTokens[contractDuration][expiry]);
        BenchmarkOwnershipToken otContract = BenchmarkOwnershipToken(otTokens[contractDuration][expiry]);
        ERC20 underlyingYieldToken = ERC20(provider.getReserveATokenAddress(underlyingToken));

        require(otContract.balanceOf(msg.sender) >= amountToRedeem, "Must have enough OT tokens");
        require(xytContract.balanceOf(msg.sender) >= amountToRedeem, "Must have enough XYT tokens");

        underlyingYieldToken.transfer(to, amountToRedeem);
        settleDueInterests(contractDuration, expiry, xytContract, msg.sender, underlyingYieldToken);
        otContract.burn(msg.sender, amountToRedeem);
        xytContract.burn(msg.sender, amountToRedeem);



        return amountToRedeem;
    }

    //TODO: safemath
    function settleDueInterests(
        ContractDurations contractDuration,
        uint256 expiry,
        BenchmarkFutureYieldToken xytContract,
        address account,
        ERC20 underlyingYieldToken
    ) internal returns (uint256){
        uint256 principal = xytContract.balanceOf(account);
        uint256 Ix = lastNormalisedIncome[contractDuration][expiry][account];
        uint256 In = provider.getAaveNormalisedIncome(underlyingToken);

        uint256 dueInterests = principal * In / Ix - principal;

        if (dueInterests > 0) {
          underlyingYieldToken.transfer(account, dueInterests);
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
        BenchmarkFutureYieldToken xytContract = BenchmarkFutureYieldToken(xytTokens[_contractDuration][_expiry]);
        BenchmarkOwnershipToken otContract = BenchmarkOwnershipToken(otTokens[_contractDuration][_expiry]);

        ERC20 underlyingYieldToken = ERC20(provider.getReserveATokenAddress(underlyingToken));
        underlyingYieldToken.transferFrom(msg.sender, address(this), _amountToTokenize);

        otContract.mint(_to, _amountToTokenize);
        xytContract.mint(_to, _amountToTokenize);
        lastNormalisedIncome[_contractDuration][_expiry][_to] = provider.getAaveNormalisedIncome(underlyingToken);
        return (address(otContract), address(xytContract));
    }


    function newYieldContracts(
        ContractDurations contractDuration,
        uint256 expiry
    ) external override returns (address ot, address xyt) {
        address aTokenAddress = provider.getReserveATokenAddress(underlyingToken);
        uint8 aTokenDecimals = IBenchmarkToken(aTokenAddress).decimals(); // IBenchmarkToken extends ERC20, so using this is good enough

        ot = _forgeOwnershipToken("OT Test Token", "OT_TEST", aTokenDecimals, aTokenAddress, contractDuration, expiry);
        xyt = _forgeFutureYieldToken("XYT Test Token", "XYT_TEST", aTokenDecimals, aTokenAddress, contractDuration, expiry);
        otTokens[contractDuration][expiry] = ot;
        xytTokens[contractDuration][expiry] = xyt;
    }

    function _forgeFutureYieldToken(
        /* string calldata _tokenName,
        string calldata _tokenSymbol, */
        string memory _tokenName,
        string memory _tokenSymbol,
        uint8 _tokenDecimals,
        address _underlyingYieldToken,
        ContractDurations _contractDuration,
        uint256 _expiry
    ) internal nonReentrant() returns (address xyt) {
        bytes memory bytecode = type(BenchmarkFutureYieldToken).creationCode;
        bytes32 salt = keccak256(abi.encodePacked(underlyingToken, _contractDuration));

        bytecode = abi.encodePacked(
            bytecode,
            abi.encode(
                _underlyingYieldToken,
                _tokenDecimals,
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
        /* string calldata _tokenName,
        string calldata _tokenSymbol, */
        string memory _tokenName,
        string memory _tokenSymbol,
        uint8 _tokenDecimals,
        address _underlyingYieldToken,
        ContractDurations _contractDuration,
        uint256 _expiry
    ) internal nonReentrant() returns (address ot) {
        bytes memory bytecode = type(BenchmarkOwnershipToken).creationCode;
        bytes32 salt = keccak256(abi.encodePacked(underlyingToken, _contractDuration));

        bytecode = abi.encodePacked(
            bytecode,
            abi.encode(
                _underlyingYieldToken,
                _tokenDecimals,
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
