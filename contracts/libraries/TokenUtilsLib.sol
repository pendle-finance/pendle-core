// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.7.0;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

library TokenUtils {
    function requireERC20(address tokenAddr) internal view {
        require(IERC20(tokenAddr).totalSupply() > 0, "INVALID_ERC20");
    }

    function requireERC20(IERC20 token) internal view {
        require(token.totalSupply() > 0, "INVALID_ERC20");
    }
}
