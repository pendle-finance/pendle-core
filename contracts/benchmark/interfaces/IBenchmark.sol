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

import "./IBenchmarkCommon.sol";
import "../interfaces/IBenchmarkFactory.sol";
import "../interfaces/IBenchmarkProvider.sol";


interface IBenchmark is IBenchmarkCommon {
    /**
     * @notice Gets a reference to the BenchmarkFactory.
     * @return Returns the factory reference.
     **/
    function factory() external view returns (IBenchmarkFactory);

    /**
     * @notice Gets a reference to the BenchmarkProvider.
     * @return Returns the provider reference.
     **/
    function provider() external view returns (IBenchmarkProvider);

    /**
     * @notice Gets the treasury contract address where fees are being sent to.
     * @return Address of the treasury contract.
     **/
    function treasury() external view returns (address);

    /**
     * @notice Gets the address of the WETH9 token contract address.
     * @return WETH token address.
     **/
    function weth() external view returns (address);

    /**
     * @notice Sets the BenchmarkFactory reference where new forges and markets
     *         will be created.
     * @param _factory Address of new factory contract.
     **/
    function setFactory(IBenchmarkFactory _factory) external;

    /**
     * @notice Sets the BenchmarkProvider reference where connections to external
     *         protocols is done.
     * @param _provider Address of new factory contract.
     **/
    function setProvider(IBenchmarkProvider _provider) external;

    /**
     * @notice Sets the BenchmarkTreasury contract address where fees will be sent to.
     * @param _treasury Address of new treasury contract.
     **/
    function setTreasury(address _treasury) external;

    /***********
     *  FORGE  *
     ***********/

    function redeemAfterExpiry(
        address underlyingToken,
        ContractDurations contractDuration,
        uint256 expiry,
        address to
    ) external returns (uint256 redeemedAmount);

    function redeemUnderlying(
        address underlyingToken,
        ContractDurations contractDuration,
        uint256 expiry,
        uint256 amountToRedeem,
        address to
    ) external returns (uint256 redeemedAmount);

    function renew(
        address underlyingToken,
        ContractDurations oldContractDuration,
        uint256 oldExpiry,
        ContractDurations newContractDuration,
        uint256 newExpiry,
        address to
    ) external returns (uint256 redeemedAmount);

    function tokenizeYield(
        address underlyingToken,
        ContractDurations contractDuration,
        uint256 expiry,
        uint256 amountToTokenize,
        address to
    ) external returns (address ot, address xyt);

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
        external
        returns (
            uint256 xytAmount,
            uint256 tokenAmount,
            uint256 liquidity
        );

    function addMarketLiquidityETH(
        address xyt,
        uint256 xytAmountDesired,
        uint256 xytAmountMin,
        uint256 ethAmountMin,
        address to
    )
        external
        payable
        returns (
            uint256 amountToken,
            uint256 amountETH,
            uint256 liquidity
        );

    function removeMarketLiquidity(
        address xyt,
        address token,
        uint256 liquidity,
        uint256 xytAmountMin,
        uint256 tokenAmountMin,
        address to
    ) external returns (uint256 xytAmount, uint256 tokenAmount);

    function removeMarketLiquidityETH(
        address token,
        uint256 liquidity,
        uint256 tokenAmountMin,
        uint256 ethAmountMin,
        address to
    ) external returns (uint256 tokenAmount, uint256 ethAmount);

    function swapTokenToToken(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);

    function swapEthToToken(
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external payable returns (uint256[] memory amounts);

    function swapTokenToEth(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);

    function getDestAmount(
        uint256 srcAmount,
        uint256 srcMarket,
        uint256 destMarket
    ) external pure returns (uint256 destAmount);

    function getSrcAmount(
        uint256 destAmount,
        uint256 srcMarket,
        uint256 destMarket
    ) external pure returns (uint256 srcAmount);

    function getDestAmounts(uint256 srcAmount, address[] calldata path)
        external
        view
        returns (uint256[] memory destAmounts);

    function getSrcAmounts(uint256 destAmount, address[] calldata path)
        external
        view
        returns (uint256[] memory srcAmounts);

    function getMarketRate(
        uint256 srcAmount,
        uint256 marketA,
        uint256 marketB
    ) external pure returns (uint256 destAmount);
}
