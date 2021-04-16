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
pragma experimental ABIEncoderV2;
import "../interfaces/IPendleData.sol";

abstract contract PendleNonReentrant {
    uint8 internal cntEntered;

    modifier pendleNonReentrant() {
        _checkNonReentrancy(); // use functions to reduce bytecode size
        _;
        cntEntered--;
    }

    function _checkNonReentrancy() internal {
        if (_getData().isMarket(msg.sender)) {
            // == 1 because the call must have gone through the router first
            require(cntEntered == 1, "REENTRANT_CALL");
        } else {
            require(cntEntered == 0, "REENTRANT_CALL");
        }
        // Any calls to nonReentrant after this point will fail
        cntEntered++;
    }

    function _getData() internal view virtual returns (IPendleData);
}
