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

interface IPENDLE is IERC20 {
    function initiateConfigChanges(
        uint256 _emissionRateMultiplierNumerator,
        uint256 _terminalInflationRateNumerator,
        address _liquidityIncentivesRecipient,
        bool _isBurningAllowed
    ) external;

    function increaseAllowance(address spender, uint256 addedValue) external returns (bool);

    function decreaseAllowance(address spender, uint256 subtractedValue) external returns (bool);

    function burn(uint256 amount) external returns (bool);

    function applyConfigChanges() external;

    function claimLiquidityEmissions() external returns (uint256 totalEmissions);

    function isPendleToken() external view returns (bool);

    function getPriorVotes(address account, uint256 blockNumber) external view returns (uint256);

    function startTime() external view returns (uint256);

    function configChangesInitiated() external view returns (uint256);

    function emissionRateMultiplierNumerator() external view returns (uint256);

    function terminalInflationRateNumerator() external view returns (uint256);

    function liquidityIncentivesRecipient() external view returns (address);

    function isBurningAllowed() external view returns (bool);

    function pendingEmissionRateMultiplierNumerator() external view returns (uint256);

    function pendingTerminalInflationRateNumerator() external view returns (uint256);

    function pendingLiquidityIncentivesRecipient() external view returns (address);

    function pendingIsBurningAllowed() external view returns (bool);
}
