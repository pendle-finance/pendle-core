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

import "./PendleBaseToken.sol";
import "../interfaces/IPendleForge.sol";
import "../interfaces/IPendleYieldTokenCommon.sol";

contract PendleFutureYieldToken is PendleBaseToken, IPendleYieldTokenCommon {
    address public immutable override forge;
    address public immutable override underlyingAsset;
    address public immutable override underlyingYieldToken;

    mapping(address => uint256) public lastNormalisedIncome;

    constructor(
        address _router,
        address _forge,
        address _underlyingAsset,
        address _underlyingYieldToken,
        string memory _name,
        string memory _symbol,
        uint8 _underlyingYieldTokenDecimals,
        uint256 _start,
        uint256 _expiry
    ) PendleBaseToken(_router, _name, _symbol, _underlyingYieldTokenDecimals, _start, _expiry) {
        require(
            _underlyingAsset != address(0) && _underlyingYieldToken != address(0),
            "ZERO_ADDRESS"
        );
        require(_forge != address(0), "ZERO_ADDRESS");
        forge = _forge;
        underlyingAsset = _underlyingAsset;
        underlyingYieldToken = _underlyingYieldToken;
    }

    modifier onlyForge() {
        require(msg.sender == address(forge), "ONLY_FORGE");
        _;
    }

    /**
     * @dev Burns OT or XYT tokens from user, reducing the total supply.
     * @param user The address performing the burn.
     * @param amount The amount to be burned.
     **/
    function burn(address user, uint256 amount) public override onlyForge {
        _burn(user, amount);
        emit Burn(user, amount);
    }

    /**
     * @dev Mints new OT or XYT tokens for user, increasing the total supply.
     * @param user The address to send the minted tokens.
     * @param amount The amount to be minted.
     **/
    function mint(address user, uint256 amount) public override onlyForge {
        _mint(user, amount);
        emit Mint(user, amount);
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override {
        super._beforeTokenTransfer(from, to, amount);
        if (from != address(0))
            IPendleForge(forge).updateDueInterests(underlyingAsset, expiry, from);
        if (to != address(0)) IPendleForge(forge).updateDueInterests(underlyingAsset, expiry, to);
    }

    function approveRouter(address user) external {
        require(msg.sender == address(router), "NOT_ROUTER");
        _approve(user, address(router), type(uint256).max);
    }
}
