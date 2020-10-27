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

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "../interfaces/IBenchmarkTreasury.sol";
import "../periphery/Permissions.sol";


contract BenchmarkTreasury is IBenchmarkTreasury, Permissions {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    // IERC20 public defaultToken;
    // SwapRouter public swapRouter;
    // address public ecoFund;
    // address public gov;
    // address internal govSetter;

    // mapping(address => uint256) public ecoFundAmts;

    // // 1% = 100
    // uint256 public constant MAX_FUND_PERCENTAGE = 1500; // 15%
    // uint256 public constant PERCENTAGE_PRECISION = 10000; // 100%
    // uint256 public fundPercentage = 500; // 5%
    
    constructor(address _governance) Permissions(_governance) {}

    // constructor(SwapRouter _swapRouter, IERC20 _defaultToken, address _ecoFund) public {
    //     swapRouter = _swapRouter;
    //     defaultToken = _defaultToken;
    //     ecoFund = _ecoFund;
    //     govSetter = msg.sender;
    // }

    // function setGov(address _gov) external {
    //     require(msg.sender == govSetter, "not authorized");
    //     gov = _gov;
    //     govSetter = address(0);
    // }

    // function setSwapRouter(SwapRouter _swapRouter) external onlyOwner {
    //     swapRouter = _swapRouter;
    // }

    // function setEcoFund(address _ecoFund) external onlyOwner {
    //     ecoFund = _ecoFund;
    // }

    // function setFundPercentage(uint256 _fundPercentage) external onlyOwner {
    //     require(_fundPercentage <= MAX_FUND_PERCENTAGE, "exceed max percent");
    //     fundPercentage = _fundPercentage;
    // }

    // function balanceOf(IERC20 token) public view returns (uint256) {
    //     return token.balanceOf(address(this)).sub(ecoFundAmts[address(token)]);
    // }

    // function deposit(IERC20 token, uint256 amount) external {
    //     token.safeTransferFrom(msg.sender, address(this), amount);
    //     // portion allocated to ecoFund
    //     ecoFundAmts[address(token)] = amount.mul(fundPercentage).div(PERCENTAGE_PRECISION);
    // }

    // // only default token withdrawals allowed
    // function withdraw(uint256 amount, address withdrawAddress) external {
    //     require(msg.sender == gov, "caller not gov");
    //     require(balanceOf(defaultToken) >= amount, "insufficient funds");
    //     defaultToken.safeTransfer(withdrawAddress, amount);
    // }
}
