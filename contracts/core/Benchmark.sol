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

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../interfaces/IBenchmark.sol";
import "../periphery/Permissions.sol";


contract Benchmark is IBenchmark, Permissions {
    using SafeMath for uint256;

    IBenchmarkData public override data;
    IBenchmarkFactory public override factory;
    IBenchmarkProvider public override provider;
    address public immutable override weth;
    address public override treasury;

    constructor(address _governance, address _weth) Permissions(_governance) {
        weth = _weth;
    }

    /**
     * @dev Accepts ETH via fallback from the WETH contract.
     **/
    receive() external payable {
        assert(msg.sender == weth);
    }

    function initialize(
        IBenchmarkData _data,
        IBenchmarkFactory _factory,
        IBenchmarkProvider _provider,
        address _treasury
    ) external {
        require(msg.sender == initializer, "Benchmark: forbidden");
        require(address(_data) != address(0), "Benchmark: zero address");
        require(address(_factory) != address(0), "Benchmark: zero address");
        require(address(_provider) != address(0), "Benchmark: zero address");
        require(_treasury != address(0), "Benchmark: zero address");

        initializer = address(0);
        data = _data;
        factory = _factory;
        provider = _provider;
        treasury = _treasury;
    }

    /**
     * @notice Sets the BenchmarkTreasury contract address where fees will be sent to.
     * @param _treasury Address of new treasury contract.
     **/
    function setContracts(
        IBenchmarkData _data,
        IBenchmarkFactory _factory,
        IBenchmarkProvider _provider,
        address _treasury
    ) external override initialized  onlyGovernance {
        require(address(_data) != address(0), "Benchmark: zero address");
        require(address(_factory) != address(0), "Benchmark: zero address");
        require(address(_provider) != address(0), "Benchmark: zero address");
        require(_treasury != address(0), "Benchmark: zero address");

        data = _data;
        factory = _factory;
        provider = _provider;
        treasury = _treasury;
        emit ContractsSet(address(_data), address(_factory), address(_provider), _treasury);
    }

    /***********
     *  FORGE  *
     ***********/

    /**
     * @notice Redeems Ownership Tokens for the underlying yield token
     * @dev Can only redeem all of the OTs.
     **/
    function redeemAfterExpiry(
        address underlyingToken,
        uint256 expiry,
        address to
    ) public override returns (uint256 redeemedAmount) {}

    function redeemUnderlying(
        address underlyingToken,
        uint256 expiry,
        uint256 amountToRedeem,
        address to
    ) public override returns (uint256 redeemedAmount) {}

    // TODO: the user has existing OTs for an expired expiry, and wants to
    // mint new OTs+XYTs for a new expiry
    function renew(
        address underlyingToken,
        uint256 oldExpiry,
        uint256 newExpiry,
        address to
    ) public override returns (uint256 redeemedAmount) {}

    function tokenizeYield(
        address underlyingToken,
        uint256 expiry,
        uint256 amountToTokenize,
        address to
    ) public override returns (address ot, address xyt) {}

    /***********
     *  MARKET *
     ***********/

    function addMarketLiquidity(
        address xyt,
        address token,
        uint256 xytAmountDesired,
        uint256 tokenAmountDesired,
        uint256 xytAmountMin,
        uint256 tokenAmountMin,
        address to
    )
        public
        override
        returns (
            uint256 xytAmount,
            uint256 tokenAmount,
            uint256 liquidity
        )
    {}

    function addMarketLiquidityETH(
        address xyt,
        uint256 xytAmountDesired,
        uint256 xytAmountMin,
        uint256 ethAmountMin,
        address to
    )
        public
        payable
        override
        returns (
            uint256 amountToken,
            uint256 amountETH,
            uint256 liquidity
        )
    {}

    function removeMarketLiquidity(
        address xyt,
        address token,
        uint256 liquidity,
        uint256 xytAmountMin,
        uint256 tokenAmountMin,
        address to
    ) public override returns (uint256 xytAmount, uint256 tokenAmount) {}

    function removeMarketLiquidityETH(
        address token,
        uint256 liquidity,
        uint256 tokenAmountMin,
        uint256 ethAmountMin,
        address to
    ) public override returns (uint256 tokenAmount, uint256 ethAmount) {}

    function swapTokenToToken(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) public override returns (uint256[] memory amounts) {}

    function swapEthToToken(
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) public payable override returns (uint256[] memory amounts) {}

    function swapTokenToEth(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) public override returns (uint256[] memory amounts) {}

    function getDestAmount(
        uint256 srcAmount,
        uint256 srcMarket,
        uint256 destMarket
    ) public pure override returns (uint256 destAmount) {}

    function getSrcAmount(
        uint256 destAmount,
        uint256 srcMarket,
        uint256 destMarket
    ) public pure override returns (uint256 srcAmount) {}

    function getDestAmounts(uint256 srcAmount, address[] calldata path)
        public
        view
        override
        returns (uint256[] memory destAmounts)
    {}

    function getSrcAmounts(uint256 destAmount, address[] calldata path)
        public
        view
        override
        returns (uint256[] memory srcAmounts)
    {}

    function getMarketRate(
        uint256 srcAmount,
        uint256 marketA,
        uint256 marketB
    ) public pure override returns (uint256 destAmount) {}
}
