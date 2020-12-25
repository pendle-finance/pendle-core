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
import "../interfaces/IBenchmarkForge.sol";
import "../interfaces/IBenchmarkMarketFactory.sol";
import "../periphery/Permissions.sol";
import "hardhat/console.sol";


contract Benchmark is IBenchmark, Permissions {
    using SafeMath for uint256;

    IBenchmarkData public override data;
    IBenchmarkMarketFactory public override factory;

    address public immutable override weth;
    address public override treasury;

    constructor(address _governance, address _weth, address _initializer) Permissions(_governance, _initializer) {
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
        IBenchmarkMarketFactory _factory,
        address _treasury /* bytes32 _forgeId,
        address _forgeAddress */
    ) external {
        require(msg.sender == initializer, "Benchmark: forbidden");
        require(address(_data) != address(0), "Benchmark: zero address");
        require(address(_factory) != address(0), "Benchmark: zero address");
        require(_treasury != address(0), "Benchmark: zero address");

        initializer = address(0);
        data = _data;
        factory = _factory;
        treasury = _treasury;

        /* data.addForge(_forgeId, _forgeAddress); */
    }

    function addForge(bytes32 _forgeId, address _forgeAddress)
        external
        override
        initialized
        onlyGovernance
    {
        require(_forgeId != 0, "Benchmark: empty bytes");
        require(_forgeAddress != address(0), "Benchmark: zero address");
        require(_forgeId == IBenchmarkForge(_forgeAddress).forgeId(), "Benchmark: wrong id");
        require(data.getForgeAddress(_forgeId) == address(0), "Benchmark: existing id");
        data.addForge(_forgeId, _forgeAddress);
    }

    function removeForge(bytes32 _forgeId) external override initialized onlyGovernance {
        require(data.getForgeAddress(_forgeId) != address(0), "Benchmark: forge doesn't exist");
        data.removeForge(_forgeId);
    }

    function setContracts(
        IBenchmarkData _data,
        IBenchmarkMarketFactory _factory,
        address _treasury
    ) external override initialized onlyGovernance {
        require(address(_data) != address(0), "Benchmark: zero address");
        require(address(_factory) != address(0), "Benchmark: zero address");
        require(_treasury != address(0), "Benchmark: zero address");

        data = _data;
        factory = _factory;
        treasury = _treasury;
        emit ContractsSet(address(_data), address(_factory), _treasury);
    }

    /***********
     *  FORGE  *
     ***********/

    function newYieldContracts(
        bytes32 _forgeId,
        address _underlyingAsset,
        uint256 _expiry
    ) public override returns (address ot, address xyt) {
        IBenchmarkForge forge = IBenchmarkForge(data.getForgeAddress(_forgeId));
        (ot, xyt) = forge.newYieldContracts(_underlyingAsset, _expiry);
    }

    function redeemDueInterests(
        bytes32 _forgeId,
        address _underlyingAsset,
        uint256 _expiry
    ) public override returns (uint256 interests) {
        IBenchmarkForge forge = IBenchmarkForge(data.getForgeAddress(_forgeId));
        interests = forge.redeemDueInterests(msg.sender, _underlyingAsset, _expiry);
    }

    function redeemAfterExpiry(
        bytes32 _forgeId,
        address _underlyingAsset,
        uint256 _expiry,
        address _to
    ) public override returns (uint256 redeemedAmount) {
        IBenchmarkForge forge = IBenchmarkForge(data.getForgeAddress(_forgeId));
        redeemedAmount = forge.redeemAfterExpiry(msg.sender, _underlyingAsset, _expiry, _to);
    }

    function redeemUnderlying(
        bytes32 _forgeId,
        address _underlyingAsset,
        uint256 _expiry,
        uint256 _amountToRedeem,
        address _to
    ) public override returns (uint256 redeemedAmount) {
        IBenchmarkForge forge = IBenchmarkForge(data.getForgeAddress(_forgeId));
        redeemedAmount = forge.redeemUnderlying(
            msg.sender,
            _underlyingAsset,
            _expiry,
            _amountToRedeem,
            _to
        );
    }

    // function renew(
    //     Utils.Protocols _protocol,
    //     address underlyingToken,
    //     uint256 oldExpiry,
    //     uint256 newExpiry,
    //     address to
    // ) public override returns (uint256 redeemedAmount) {}

    function tokenizeYield(
        bytes32 _forgeId,
        address _underlyingAsset,
        uint256 _expiry,
        uint256 _amountToTokenize,
        address _to
    ) public override returns (address ot, address xyt) {
        IBenchmarkForge forge = IBenchmarkForge(data.getForgeAddress(_forgeId));
        (ot, xyt) = forge.tokenizeYield(
            msg.sender,
            _underlyingAsset,
            _expiry,
            _amountToTokenize,
            _to
        );
    }

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
