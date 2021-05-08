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

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "../../interfaces/IPendleYieldTokenHolder.sol";
import "../../interfaces/IPendleRouter.sol";
import "../../interfaces/IPendleForge.sol";

abstract contract PendleYieldTokenHolderBase is IPendleYieldTokenHolder {
    using SafeERC20 for IERC20;

    address internal yieldToken;
    address public forge;

    constructor(
        address _forge,
        address _router,
        address _yieldToken,
        address _rewardToken,
        address _rewardManager
    ) {
        require(
            _router != address(0) && _yieldToken != address(0) && _rewardToken != address(0),
            "ZERO_ADDRESS"
        );
        yieldToken = _yieldToken;
        IERC20(_yieldToken).safeApprove(_router, type(uint256).max);
        IERC20(_yieldToken).safeApprove(_forge, type(uint256).max);

        forge = _forge;
        IERC20(_rewardToken).safeApprove(_rewardManager, type(uint256).max);
    }

    function claimRewards() external virtual override;

    // Only forge can call this function
    // this will allow a spender to spend the whole balance of the specified tokens
    // the spender should ideally be a contract with logic for users to withdraw out their funds.
    function setUpEmergencyMode(address[] calldata tokens, address spender) external override {
        require(msg.sender == forge, "NOT_FROM_FORGE");
        for (uint256 i = 0; i < tokens.length; i++) {
            IERC20(tokens[i]).safeApprove(spender, type(uint256).max);
        }
    }
}
