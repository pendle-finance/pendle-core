//SPDX-License-Identifier: MIT
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
pragma solidity =0.7.1;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../tokens/BenchmarkOwnershipToken.sol";
import "../tokens/BenchmarkFutureYieldToken.sol";
import "./Roles.sol";


contract Withdrawable is Roles {

    event OTWithdraw(OwnershipToken token, uint256 amount, address sendTo);
    event XYTWithdraw(YieldToken token, uint256 amount, address sendTo);
    event TokenWithdraw(IERC20 token, uint256 amount, address sendTo);
    event EtherWithdraw(uint256 amount, address sendTo);

    constructor(address _admin) public Roles(_admin) {}

    /**
     * @dev Withdraw Ethers
     */
    function withdrawEther(uint256 amount, address payable sendTo) external onlyAdmin {
        (bool success, ) = sendTo.call{value: amount}("");
        require(success, "withdraw failed");
        emit EtherWithdraw(amount, sendTo);
    }

    /**
     * @dev Withdraw all IERC20 compatible tokens
     * @param token IERC20 The address of the token contract
     */
    function withdrawToken(
        IERC20 token,
        uint256 amount,
        address sendTo
    ) external onlyAdmin {
        token.transfer(sendTo, amount);
        emit TokenWithdraw(token, amount, sendTo);
    }

    function withdrawOT(
        OwnershipToken token,
        uint256 amount,
        address sendTo
    ) external onlyAdmin {
        token.transfer(sendTo, amount);
        emit OTWithdraw(token, amount, sendTo);
    }

    function withdrawXYT(
        YieldToken token,
        uint256 amount,
        address sendTo
    ) external onlyAdmin {
        token.transfer(sendTo, amount);
        emit XYTWithdraw(token, amount, sendTo);
    }
}
