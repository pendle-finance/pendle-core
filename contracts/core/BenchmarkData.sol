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
    bytes32[] public allForges;
    mapping(bytes32 => address) public override forges;

    mapping(bytes32 => mapping(address => mapping(address => address))) public override getMarket;
    mapping(bytes32 => mapping(address => mapping(uint256 => IBenchmarkYieldToken))) public override otTokens;
    mapping(bytes32 => mapping(address => mapping(uint256 => IBenchmarkYieldToken))) public override xytTokens;
    IBenchmark public override core;
    mapping(address => bool) internal isForge;
    mapping(address => bool) internal isMarket;
    /* address[] private allForges; */
    address[] private allMarkets;

    constructor(address _governance) Permissions(_governance) {}

    modifier onlyFactory() {
        require(msg.sender == address(core.factory()), "Benchmark: only factory");
        _;
    }

    modifier onlyCore() {
        require(msg.sender == address(core), "Benchmark: only core");
        _;
    }

    modifier onlyForgeForProtocol(bytes32 _protocol) {
        require(forges[_protocol] == msg.sender, "Benchmark: only forge");
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

    function getBenchmarkYieldTokens(bytes32 _protocol, address _underlyingAsset, uint256 _expiry)
        external
        view
        override
        returns (IBenchmarkYieldToken ot, IBenchmarkYieldToken xyt)
    {
        ot = otTokens[_protocol][_underlyingAsset][_expiry];
        xyt = xytTokens[_protocol][_underlyingAsset][_expiry];
    }

    function addProtocol (address _forge, bytes32 _protocolId) external override initialized onlyCore {
        allForges.push(_protocolId);
        forges[_protocolId] = _forge;
    }

    /* function storeForge(address _underlyingAsset, address _forge)
        external
        override
        initialized
        onlyFactory
    {
        getForgeFromUnderlyingAsset[_underlyingAsset] = _forge;
        isForge[_forge] = true;
    } */

    function storeTokens(
        bytes32 _protocol,
        address _ot,
        address _xyt,
        address _underlyingAsset,
        /* address _forge, */
        uint256 _expiry
    ) external override initialized onlyForgeForProtocol(_protocol) {
        /* getForgeFromXYT[_xyt] = _forge; */
        otTokens[_protocol][_underlyingAsset][_expiry] = IBenchmarkYieldToken(_ot);
        xytTokens[_protocol][_underlyingAsset][_expiry] = IBenchmarkYieldToken(_xyt);
    }

    /* function allForgesLength() external view override returns (uint256) {
        return allForges.length;
    } */

    /* function getAllForges() public view override returns (address[] memory) {
        return allForges;
    } */

    /***********
     *  MARKET *
     ***********/
    function addMarket (address _market) external override initialized onlyFactory {
        allMarkets.push(_market);
    }

    function storeMarket(
        bytes32 _protocol,
        address _xyt,
        address _token,
        address _market
    ) external override initialized onlyFactory {
        getMarket[_protocol][_xyt][_token] = _market;
        isMarket[_market] = true;
    }

    function allMarketsLength() external view override returns (uint256) {
        return allMarkets.length;
    }

    function getAllMarkets() public view override returns (address[] memory) {
        return allMarkets;
    }
}
