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

import "./../../aave/v1/PendleAaveYieldTokenHolder.sol";
import "./../../abstract/PendleYieldContractDeployerBase.sol";

contract PendleAaveYieldContractDeployer is PendleYieldContractDeployerBase {
    constructor(address _governanceManager, bytes32 _forgeId)
        PendleYieldContractDeployerBase(_governanceManager, _forgeId)
    {}

    function deployYieldTokenHolder(address yieldToken, uint256 expiry)
        external
        override
        onlyForge
        returns (address yieldTokenHolder)
    {
        yieldTokenHolder = address(
            new PendleAaveYieldTokenHolder(
                address(governanceManager),
                address(forge),
                yieldToken,
                address(forge.rewardToken()),
                address(forge.rewardManager()),
                expiry
            )
        );
    }
}