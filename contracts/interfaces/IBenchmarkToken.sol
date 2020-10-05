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

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/IBenchmarkCommon.sol";


interface IBenchmarkToken is IBenchmarkCommon, IERC20 {
    /**
     * @dev Emitted when burning OT or XYT tokens.
     * @param account The address performing the burn.
     * @param amount The amount to be burned.
     **/
    event Burn(address indexed account, uint256 amount);

    /**
     * @dev Emitted when minting OT or XYT tokens.
     * @param account The address performing the mint.
     * @param amount The amount to be minted.
     **/
    event Mint(address indexed account, uint256 amount);

    /**
     * @dev Burns OT or XYT tokens from account, reducing the total supply.
     * @param account The address performing the burn.
     * @param amount The amount to be burned.
     **/
    function burn(address account, uint256 amount) external;

    /**
     * @dev Decreases the allowance granted to spender by the caller.
     * @param spender The address to reduce the allowance from.
     * @param subtractedValue The amount allowance to subtract.
     * @return Returns true if allowance has decreased, otherwise false.
     **/
    function decreaseAllowance(address spender, uint256 subtractedValue) external returns (bool);

    /**
     * @dev Increases the allowance granted to spender by the caller.
     * @param spender The address to increase the allowance from.
     * @param addedValue The amount allowance to add.
     * @return returns true if allowance has increased, otherwise false
     **/
    function increaseAllowance(address spender, uint256 addedValue) external returns (bool);

    /**
     * @dev Mints new OT or XYT tokens for account, increasing the total supply.
     * @param account The address to send the minted tokens.
     * @param amount The amount to be minted.
     **/
    function mint(address account, uint256 amount) external;

    /**
     * @dev Returns the number of decimals the token uses.
     * @return Returns the token's decimals.
     **/
    function decimals() external view returns (uint8);

    /**
     * @dev Returns the address of the BenchmarkForge for this BenchmarkToken.
     * @return Returns the forge's address.
     **/
    function forgeAddress() external view returns (address);

    /**
     * @dev Returns the name of the token.
     * @return returns the token's name.
     **/
    function name() external view returns (string memory);

    /**
     * @dev Returns the symbol of the token.
     * @return Returns the token's symbol.
     **/
    function symbol() external view returns (string memory);

    /**
     * @dev returns the address of the underlying yield token
     * @return returns the underlying forge address
     **/
    function underlyingYieldToken() external view returns (address);
}
