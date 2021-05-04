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

import "../libraries/FactoryLib.sol";
import "./PendleAaveMarket.sol";
import "../interfaces/IPendleRouter.sol";
import "../interfaces/IPendleData.sol";
import "../interfaces/IPendleMarketFactory.sol";
import "../interfaces/IPendleYieldToken.sol";
import "../periphery/Permissions.sol";
import "./abstract/PendleMarketFactoryBase.sol";

contract PendleAaveMarketFactory is PendleMarketFactoryBase {
    constructor(address _governance, bytes32 _marketFactoryId)
        PendleMarketFactoryBase(_governance, _marketFactoryId)
    {}

    /**
     * @notice create market
     * @param _forgeAddress forge address for the yield token
     * @param _xyt address of xyt token
     * @param _token address of token
     * @param _expiry expirty date of yield token
     */
    function _createMarket(
        address _forgeAddress,
        address _xyt,
        address _token,
        uint256 _expiry
    ) internal override returns (address) {
        return
            Factory.createContract(
                type(PendleAaveMarket).creationCode,
                abi.encodePacked(_forgeAddress, _xyt, _token, _expiry),
                abi.encode(_forgeAddress, _xyt, _token, _expiry)
            );
    }
}
