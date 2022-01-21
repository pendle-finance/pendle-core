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
pragma abicoder v2;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IPendleZapEstimator {
    enum ZapMode {
        ONLY_OT,
        ONLY_YT,
        BOTH
    }

    enum ForgeMode {
        SINGLE_UNDERLYING,
        DOUBLE_UNDERLYING
    }

    struct ForgeData {
        ForgeMode mode;
        bytes32 forgeId;
        address underlyingAsset;
        uint256 expiry;
    }

    struct MintingData {
        ForgeData forge;
        address[] underlyingPath;
        address[] underlyingPath2; // LP token case
        address[] baseTokenPath;
        uint256 inAmount;
    }

    struct SwapData {
        uint256 amountIn;
        uint256 exactOut;
    }

    struct AnyTokenZapData {
        ZapMode mode;
        MintingData mintingData;
        uint256 slippage;
    }

    function estimateAnyTokenZap(AnyTokenZapData memory data)
        external
        view
        returns (
            SwapData memory,
            SwapData memory,
            SwapData memory
        );
}
