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
pragma solidity ^0.7.0;

import "../interfaces/IBenchmarkData.sol";
import "../interfaces/IBenchmarkFactory.sol";
import "../periphery/Permissions.sol";


contract BenchmarkData is IBenchmarkData, Permissions {
    mapping(Utils.Protocols => mapping(address => address)) public override getForge;
    mapping(address => mapping(address => address)) public override getMarket;
    mapping(address => mapping(uint256 => IBenchmarkYieldToken)) public override otTokens;
    mapping(address => mapping(uint256 => IBenchmarkYieldToken)) public override xytTokens;
    IBenchmark public override core;
    mapping(address => bool) internal isForge;
    mapping(address => bool) internal isMarket;
    address[] private allForges;
    address[] private allMarkets;

    constructor(address _governance) Permissions(_governance) {}

    modifier onlyFactory() {
        require(msg.sender == address(core.factory()), "Benchmark: only factory");
        _;
    }

    modifier onlyForge() {
        require(isForge[msg.sender], "Benchmark: only forge");
        _;
    }

    modifier onlyMarket() {
        require(isMarket[msg.sender], "Benchmark: only market");
        _;
    }

    function initialize(IBenchmark _core) external {
        require(msg.sender == initializer, "Benchmark: forbidden");
        require(address(_core) != address(0), "Benchmark: zero address");

        initializer = address(0);
        core = _core;
    }

    function setCore(IBenchmark _core) external override initialized onlyGovernance {
        require(address(_core) != address(0), "Benchmark: zero address");

        core = _core;
        emit CoreSet(address(_core));
    }

    function getBenchmarkYieldTokens(address _underlyingAsset, uint256 _expiry)
        external
        view
        override
        returns (IBenchmarkYieldToken ot, IBenchmarkYieldToken xyt)
    {
        ot = otTokens[_underlyingAsset][_expiry];
        xyt = xytTokens[_underlyingAsset][_expiry];
    }

    /***********
     *  FORGE  *
     ***********/

     function addForge (address _forge) external override initialized onlyFactory {
        allForges.push(_forge);
    }

    function storeForge(Utils.Protocols _protocol, address _underlyingAsset, address _forge)
        external
        override
        initialized
        onlyFactory
    {
        getForge[_protocol][_underlyingAsset] = _forge;
        isForge[_forge] = true;
    }

    function storeTokens(
        address _ot,
        address _xyt,
        address _underlyingAsset,
        uint256 _expiry
    ) external override initialized onlyForge {
        otTokens[_underlyingAsset][_expiry] = IBenchmarkYieldToken(_ot);
        xytTokens[_underlyingAsset][_expiry] = IBenchmarkYieldToken(_xyt);
    }

    function allForgesLength() external view override returns (uint256) {
        return allForges.length;
    }

    function getAllForges() public view override returns (address[] memory) {
        return allForges;
    }

    function getForgeFromXYT(address _xyt) public view override returns (address forge) {
        
    }

    /***********
     *  MARKET *
     ***********/
    function addMarket (address _market) external override initialized onlyFactory {
        allMarkets.push(_market);
    }

    function storeMarket(
        address _xyt,
        address _token,
        address _market
    ) external override initialized onlyFactory {
        getMarket[_xyt][_token] = _market;
        isMarket[_market] = true;
    }

    function allMarketsLength() external view override returns (uint256) {
        return allMarkets.length;
    }

    function getAllMarkets() public view override returns (address[] memory) {
        return allMarkets;
    }
}
