// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.7.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../libraries/TokenUtilsLib.sol";

contract PendleSimpleERC20TokenHolder {
    using TokenUtils for IERC20;

    constructor(address[] memory tokens, address spender) {
        for (uint256 i = 0; i < tokens.length; i++) {
            if (tokens[i] == address(0)) continue;
            IERC20(tokens[i]).safeApprove(spender, type(uint256).max);
        }
    }

    receive() external payable {
        revert("ETH_NOT_ALLOWED");
    }
}
