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
import "../interfaces/IPendleData.sol";

abstract contract PendleRouterNonReentrant {
    uint8 internal _guardCounter;

    modifier nonReentrant() {
        _checkNonReentrancy(); // use functions to reduce bytecode size
        _;
        _guardCounter--;
    }

    constructor() {
        _guardCounter = 1;
    }

    /**
    * We allow markets to make at most ONE Reentrant call
    in the case of redeemLpInterests
    * The flow of redeemLpInterests will be: Router.redeemLpInterests -> market.redeemLpInterests
    -> Router.redeemDueInterests (so there is at most ONE Reentrant call)
    */
    function _checkNonReentrancy() internal {
        if (_getData().isMarket(msg.sender)) {
            require(_guardCounter <= 2, "REENTRANT_CALL");
        } else {
            require(_guardCounter == 1, "REENTRANT_CALL");
        }
        _guardCounter++;
    }

    function _getData() internal view virtual returns (IPendleData);
}
