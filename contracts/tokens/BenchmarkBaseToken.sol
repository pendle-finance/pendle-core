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


contract BenchmarkBaseToken is IBenchmarkToken, ERC20 {
    /**
    * @dev emitted after the redeem action
    * @param _from the address performing the redeem
    * @param _value the amount to be redeemed
    **/
    /* event Redeem(
        address indexed _from,
        uint256 _value
    ); */

    modifier onlyYieldForge {
        require(
            msg.sender == forgeAddress,
            "Must be forge"
        );
        _;
    }

    address public forgeAddress;
    address public underlyingYieldToken;
    ContractDurations public contractDuration;
    uint256 public expiry;

    // Forge private forge;

    constructor(
        address _underlyingYieldToken,
        uint8 _underlyingYieldTokenDecimals,
        string memory _name,
        string memory _symbol,
        ContractDurations _contractDuration,
        uint256 _expiry,
    ) public ERC20Detailed(_name, _symbol, _underlyingYieldTokenDecimals) {
        // forge = ... // reference the forge
        underlyingYieldToken = _underlyingYieldToken;
        contractDuration = _contractDuration;
        expiry = _expiry;
        forgeAddress = msg.sender
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

    /**
     * @param _account the address receiving the minted tokens
     * @param _amount the amount of tokens to mint
     */
    /* function mintOnDeposit(address _recipient, uint256 _recipient)
        external
        override
        // role == minter
    {
        // minting logic

        _mint(_recipient, _recipient);
        emit MintOnDeposit(_account, _amount);
    } */


    // Should the redeem logic be done in the Forge, and we just need to burn stuff here, when called by the Forge?

    /* function redeem(uint256 _amount) external {
        require(_amount > 0, "Amount to redeem needs to be > 0");

        uint256 amountToRedeem = _amount;

        //if amount is equal to uint(-1), the user wants to redeem everything
        if(_amount == UINT_MAX_VALUE){
            amountToRedeem = currentBalance;
        }

        require(amountToRedeem <= token.balanceOf(msg.sender), "Cannot redeem more than the available balance");

        // burns tokens equivalent to the amount requested
        _burn(msg.sender, amountToRedeem);

        // executes redeem of the underlying asset
        forge.redeemUnderlying(
            underlyingAssetAddress,
            msg.sender,
            amountToRedeem,
            currentBalance.sub(amountToRedeem)
        );

        emit Redeem(msg.sender, amountToRedeem);
    } */
}
