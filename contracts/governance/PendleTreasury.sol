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

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "../interfaces/IPendleTreasury.sol";
import "../periphery/PermissionsV2.sol";

contract PendleTreasury is IPendleTreasury, PermissionsV2 {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    IERC20 public override fundToken;
    uint256 public constant MAX_FUND_PERCENTAGE = 1500; // 15%
    uint256 public constant PERCENTAGE_PRECISION = 10000; // 100%
    uint256 public fundPercentage = 500; // 5%

    constructor(address _governanceManager) PermissionsV2(_governanceManager) {
        initializer = msg.sender;
    }

    function initialize(IERC20 _fundToken) external {
        require(msg.sender == initializer, "FORBIDDEN");
        require(address(_fundToken) != address(0), "ZERO_ADDRESS");

        initializer = address(0);
        fundToken = _fundToken;
    }

    function setFundPercentage(uint256 _fundPercentage) external override onlyGovernance {
        require(_fundPercentage <= MAX_FUND_PERCENTAGE, "EXCEEDED_MAX%");
        fundPercentage = _fundPercentage;
    }

    function deposit(IERC20 token, uint256 amount) external override {
        token.safeTransferFrom(msg.sender, address(this), amount);
    }

    function withdraw(uint256 amount, address withdrawAddress) external override onlyGovernance {
        require(balanceOf(fundToken) >= amount, "INSUFFICIENT_FUND");
        fundToken.safeTransfer(withdrawAddress, amount);
    }

    function balanceOf(IERC20 token) public view override returns (uint256) {
        return token.balanceOf(address(this));
    }
}
