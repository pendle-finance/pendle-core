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

import "./BenchmarkForge.sol";
import "./BenchmarkMarket.sol";
import "../interfaces/IBenchmarkFactory.sol";
import "../interfaces/IBenchmarkProvider.sol";
import "../utils/Permissions.sol";

contract BenchmarkFactory is IBenchmarkFactory {
    mapping(address => address) public override getForge;
    mapping(address => mapping(address => address)) public override getMarket;
    IBenchmarkProvider public provider;
    address public override core;
    address public override treasury;
    address private initializer;
    address[] private allForges;
    address[] private allMarkets;
    address governance;

    constructor(
        address _governance,
        address _treasury,
        IBenchmarkProvider _provider
    ) {
        require(_governance != address(0), "Benchmark: zero address");
        require(_treasury != address(0), "Benchmark: zero address");
        require(address(_provider) != address(0), "Benchmark: zero address");

        initializer = msg.sender;
        governance = _governance;
        treasury = _treasury;
        provider = _provider;
    }

    /**
     * @notice Initializes the BenchmarkFactory.
     * @dev Only called once.
     * @param _core The address of the Benchmark core contract.
     **/
    function initialize(address _core) external {
        require(msg.sender == initializer, "Benchmark: forbidden");
        require(_core != address(0), "Benchmark: zero address");
        initializer = address(0);
        core = _core;
    }

    function createForge(address _underlyingYieldToken) external override returns (address forge) {
        require(core != address(0), "Benchmark: not initialized");
        require(_underlyingYieldToken != address(0), "Benchmark: zero address");
        require(getForge[_underlyingYieldToken] == address(0), "Benchmark: forge exists");
        // TODO: Have a test environment for Aave before uncommenting below
        // require(
        //     provider.getReserveATokenAddress(underlyingYieldToken) != address(0),
        //     "Benchmark: underlying token doesn't exist"
        // );

        bytes memory bytecode = type(BenchmarkForge).creationCode;
        bytes32 salt = keccak256(abi.encodePacked(_underlyingYieldToken));

        bytecode = abi.encodePacked(
            bytecode,
            abi.encode(_underlyingYieldToken, treasury, provider)
        );

        assembly {
            forge := create2(0, add(bytecode, 32), mload(bytecode), salt)
        }

        getForge[_underlyingYieldToken] = forge;
        allForges.push(forge);

        emit ForgeCreated(_underlyingYieldToken, forge);
    }

    function createMarket(address _xyt, address _token)
        external
        override
        returns (address market)
    {
        require(core != address(0), "Benchmark: not initialized");
        require(_xyt != _token, "Benchmark: similar tokens");
        require(_xyt != address(0) && _token != address(0), "Benchmark: zero address");
        require(getMarket[_xyt][_token] == address(0), "Benchmark: market already exists");
        // TODO: Verify that xyt really exists on Benchmark
        // require(, "Benchmark: not xyt token");

        // TODO: Get the underlyingYieldToken of xyt
        address underlyingYieldToken;

        bytes memory bytecode = type(BenchmarkMarket).creationCode;
        bytes32 salt = keccak256(abi.encodePacked(_xyt, _token));

        bytecode = abi.encodePacked(bytecode, abi.encode(underlyingYieldToken, provider));

        assembly {
            market := create2(0, add(bytecode, 32), mload(bytecode), salt)
        }

        getMarket[_xyt][_token] = market;
        allMarkets.push(market);

        emit MarketCreated(_xyt, _token, treasury, market);
    }

    /* function setTreasury(address _treasury) external override onlyGovernance {
        require(_treasury != address(0), "Benchmark: zero address");
        treasury = _treasury;
    } */

    function allForgesLength() external view override returns (uint256) {
        return allForges.length;
    }

    function allMarketsLength() external view override returns (uint256) {
        return allMarkets.length;
    }

    function getAllForges() public view override returns (address[] memory) {
        return allForges;
    }

    function getAllMarkets() public view override returns (address[] memory) {
        return allMarkets;
    }
}
