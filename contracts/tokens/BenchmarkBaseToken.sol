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

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../interfaces/IBenchmarkToken.sol";
import "../utils/Utils.sol";


abstract contract BenchmarkBaseToken is IBenchmarkToken, ERC20 {
    modifier onlyYieldForge {
        require(msg.sender == forgeAddress, "Must be forge");
        _;
    }

    uint256 public expiry;
    address public override forgeAddress;
    ContractDurations public contractDuration;
    address public override underlyingYieldToken;

    constructor(
        address _underlyingYieldToken,
        uint8 _underlyingYieldTokenDecimals,
        string memory _name,
        string memory _symbol,
        ContractDurations _contractDuration,
        uint256 _expiry
    ) ERC20(_name, _symbol) {
        contractDuration = _contractDuration;
        expiry = _expiry;
        forgeAddress = msg.sender;
        underlyingYieldToken = _underlyingYieldToken;
        _setupDecimals(_underlyingYieldTokenDecimals);
    }

    /**
     * @dev Burns `value` tokens owned by account.
     * @param value amount of tokens to burn.
     */
    function burn(address account, uint256 value) external override onlyYieldForge {
        _burn(account, value);
    }

    /**
     * @dev mint `value` tokens for `msg.sender`.
     * @param value amount of tokens to burn.
     */
    function mint(address account, uint256 value) external override onlyYieldForge {
        _mint(account, value);
    }
}
