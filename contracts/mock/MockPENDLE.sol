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

import "../tokens/PENDLE.sol";

contract MockPENDLE is PENDLE {
    constructor(
        address _governance,
        address pendleTeamTokens,
        address pendleEcosystemFund,
        address salesMultisig,
        address _liquidityIncentivesRecipient
    )
        PENDLE(
            _governance,
            pendleTeamTokens,
            pendleEcosystemFund,
            salesMultisig,
            _liquidityIncentivesRecipient
        )
    {
        isBurningAllowed = true;
    }

    /**
    @dev comment out these 2 functions since mint and burn are already non-internal
     */
    // function mint(address account, uint256 amount) public {
    //     _mint(account, amount);
    // }

    // function burn(address account, uint256 amount) public {
    //     _burn(account, amount);
    // }

    function transferInternal(
        address from,
        address to,
        uint256 value
    ) public {
        _transfer(from, to, value);
    }

    function approveInternal(
        address from,
        address to,
        uint256 value
    ) public {
        _approve(from, to, value);
    }

    function getCurrentWeek() public view returns (uint256) {
        return _getCurrentWeek();
    }

    function getTotalSupply() public view returns (uint256) {
        return totalSupply;
    }

    function getCurrentTime() public view returns (uint256 time) {
        time = block.timestamp;
    }

    function burn(address from, uint256 value) public {
        _burn(from, value);
    }
}
