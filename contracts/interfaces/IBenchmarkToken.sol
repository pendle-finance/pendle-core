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


abstract contract IBenchmarkToken is IERC20, IBenchmarkCommon {
    /**
     * @dev emitted after the mint action
     * @param sender the address performing the mint
     * @param amount the amount to be minted
     **/
    event Mint(address indexed sender, uint256 amount);

    /**
     * @dev emitted when burning the underlying
     * @param sender the address performing the mint
     * @param amount the amount to be burned
     **/
    event Burn(address indexed sender, uint256 amount);

    /**
     * @dev mint new benchmark ownership or yield tokens
     * @param to the address to send the minted tokens
     * @param amount the amount to be minted
     **/
    function mint(address to, uint256 amount) external virtual;

    /**
     * @dev burn the underlying token by burning benchmark ownership and yield tokens
     * @param amount the amount to be burned
     **/
    function burn(uint256 amount) external virtual;

    /**
     * @dev ERC20 standard: returns the number of decimals the token uses
     * @return returns the token's decimals
     **/
    function decimals() external virtual pure returns (uint8);

    /**
     * @dev ERC20 standard: returns the name of the token
     * @return returns the token's name
     **/
    function name() external virtual pure returns (string memory);

    /**
     * @dev ERC20 standard: returns the symbol of the token
     * @return returns the token's symbol
     **/
    function symbol() external virtual pure returns (string memory);

    /**
     * @dev returns the address of the forge
     * @return returns the forge address
     **/
    function forgeAddress() external virtual view returns (address);

    function permit(
        address owner,
        address spender,
        uint256 value,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external virtual;

    /**
     * @dev returns the address of the underlying yield token
     * @return returns the underlying forge address
     **/
    function underlyingYieldToken() external virtual view returns (address);
}
