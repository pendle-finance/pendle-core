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

import "./PendleBaseToken.sol";
import "../interfaces/IPendleForge.sol";
import "../interfaces/IPendleYieldToken.sol";

contract PendleFutureYieldToken is PendleBaseToken, IPendleYieldToken {
    address public override forge;
    address public override underlyingAsset;
    address public override underlyingYieldToken;
    address public ot;
    mapping(address => uint256) public lastNormalisedIncome;

    constructor(
        address _ot,
        address _underlyingAsset,
        address _underlyingYieldToken,
        string memory _name,
        string memory _symbol,
        uint8 _underlyingYieldTokenDecimals,
        uint256 _start,
        uint256 _expiry
    ) PendleBaseToken(_name, _symbol, _underlyingYieldTokenDecimals, _start, _expiry) {
        forge = msg.sender;
        ot = _ot;
        underlyingAsset = _underlyingAsset;
        underlyingYieldToken = _underlyingYieldToken;
    }

    modifier onlyForge() {
        require(msg.sender == address(forge), "Pendle: only forge");
        _;
    }

    /**
     * @dev Burns OT or XYT tokens from account, reducting the total supply.
     * @param account The address performing the burn.
     * @param amount The amount to be burned.
     **/
    function burn(address account, uint256 amount) public override onlyForge {
        _burn(account, amount);
        emit Burn(account, amount);
    }

    /**
     * @dev Mints new OT or XYT tokens for account, increasing the total supply.
     * @param account The address to send the minted tokens.
     * @param amount The amount to be minted.
     **/
    function mint(address account, uint256 amount) public override onlyForge {
        _mint(account, amount);
        emit Mint(account, amount);
    }

    function _beforeTokenTransfer(address from, address to) internal override {
        IPendleForge(forge).redeemDueInterestsBeforeTransfer(underlyingAsset, expiry, from);
        IPendleForge(forge).redeemDueInterestsBeforeTransfer(underlyingAsset, expiry, to);
    }
}
