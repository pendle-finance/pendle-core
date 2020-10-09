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

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../interfaces/IBenchmarkToken.sol";



/**
 *   @title BenchmarkBaseToken
 *   @dev The contract implements the standard ERC20 functions, plus some
 *        Benchmark specific fields and functions, namely:
 *          - forgeAddress()
 *          - underlyingYieldToken()
 *
 *        This abstract contract is inherited by BenchmarkFutureYieldToken
 *        and BenchmarkOwnershipToken contracts.
 **/
abstract contract BenchmarkBaseToken is IBenchmarkToken {
    using SafeMath for uint256;

    modifier onlyYieldForge {
        require(msg.sender == forgeAddress, "Benchmark: Must be forge");
        _;
    }

    mapping(address => mapping(address => uint256)) public override allowance;
    mapping(address => uint) public override balanceOf;
    ContractDurations public contractDuration;
    string public override name;
    string public override symbol;
    uint8 public override decimals;
    uint256 public expiry;
    uint256 public override totalSupply;
    address public override forgeAddress;
    address public override underlyingYieldToken;

    constructor(
        address _underlyingYieldToken,
        uint8 _underlyingYieldTokenDecimals,
        string memory _name,
        string memory _symbol,
        ContractDurations _contractDuration,
        uint256 _expiry
    ) {
        contractDuration = _contractDuration;
        decimals = _underlyingYieldTokenDecimals;
        expiry = _expiry;
        forgeAddress = msg.sender;
        name = _name;
        symbol = _symbol;
        underlyingYieldToken = _underlyingYieldToken;
    }

   /**
     * @dev Sets amount as the allowance of spender over the owner's tokens.
     * @param spender The address spending the owner's tokens.
     * @param amount The amount allowed to be spent.
     * @return Returns true if approval has succeeded, otherwise false.
     **/
    function approve(address spender, uint256 amount) public override returns (bool) {
        _approve(msg.sender, spender, amount);
        return true;
    }

    /**
     * @dev Burns OT or XYT tokens from account, reducting the total supply.
     * @param account The address performing the burn.
     * @param amount The amount to be burned.
     **/
    function burn(address account, uint256 amount) public override onlyYieldForge {
        _burn(account, amount);
    }

    /**
     * @dev Decreases the allowance granted to spender by the caller.
     * @param spender The address to reduce the allowance from.
     * @param subtractedValue The amount allowance to subtract.
     * @return Returns true if allowance has decreased, otherwise false.
     **/
    function decreaseAllowance(address spender, uint256 subtractedValue) public override returns (bool) {
        _approve(msg.sender, spender, allowance[msg.sender][spender].sub(subtractedValue, "BenchmarkToken: decreased allowance below zero"));
        return true;
    }

    /**
     * @dev Increases the allowance granted to spender by the caller.
     * @param spender The address to increase the allowance from.
     * @param addedValue The amount allowance to add.
     * @return returns true if allowance has increased, otherwise false
     **/
    function increaseAllowance(address spender, uint256 addedValue) public override returns (bool) {
        _approve(msg.sender, spender, allowance[msg.sender][spender].add(addedValue));
        return true;
    }

    /**
     * @dev Mints new OT or XYT tokens for account, increasing the total supply.
     * @param account The address to send the minted tokens.
     * @param amount The amount to be minted.
     **/
    function mint(address account, uint256 amount) public override onlyYieldForge {
        _mint(account, amount);
    }

    /**
     * @dev The amount of tokens to transfer to recipient.
     * @param recipient The address receiving the tokens.
     * @param amount The amount to be transferred.
     * @return Returns true if transfer has succeeded, otherwise false.
     */
    function transfer(address recipient, uint256 amount) public override returns (bool) {
        _transfer(msg.sender, recipient, amount);
        return true;
    }

    /**
     * @dev The amount of tokens to transfer to recipient from the sender's address.
     * @param sender The address sending the tokens.
      * @param recipient The address receiving the tokens.
     * @param amount The amount to be transferred.
     * @return Returns true if transferFrom has succeeded, otherwise false.
     */
    function transferFrom(address sender, address recipient, uint256 amount) public virtual override returns (bool) {
        _transfer(sender, recipient, amount);
        _approve(sender, msg.sender, allowance[sender][msg.sender].sub(amount, "BenchmarkToken: transfer amount exceeds allowance"));
        return true;
    }

    function _approve(address owner, address spender, uint256 amount) internal virtual {
        require(owner != address(0), "BenchmarkToken: approve from the zero address");
        require(spender != address(0), "BenchmarkToken: approve to the zero address");

        allowance[owner][spender] = amount;
        emit Approval(owner, spender, amount);
    }

    function _mint(address account, uint256 amount) internal {
        require(account != address(0), "BenchmarkToken: mint to the zero address");

        totalSupply = totalSupply.add(amount);
        balanceOf[account] = balanceOf[account].add(amount);
        emit Transfer(address(0), account, amount);
    }

    function _burn(address account, uint256 amount) internal {
        require(account != address(0), "BenchmarkToken: burn from the zero address");

        balanceOf[account] = balanceOf[account].sub(amount, "BenchmarkToken: burn amount exceeds balance");
        totalSupply = totalSupply.sub(amount);
        emit Transfer(account, address(0), amount);
    }

    function _transfer(address sender, address recipient, uint256 amount) internal {
        require(sender != address(0), "BenchmarkToken: transfer from the zero address");
        require(recipient != address(0), "BenchmarkToken: transfer to the zero address");

        balanceOf[sender] = balanceOf[sender].sub(amount, "BenchmarkToken: transfer amount exceeds balance");
        balanceOf[recipient] = balanceOf[recipient].add(amount);
        emit Transfer(sender, recipient, amount);
    }
}
