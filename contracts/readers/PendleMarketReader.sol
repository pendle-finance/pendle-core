// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.7.6;
pragma abicoder v2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../libraries/MathLib.sol";
import "../libraries/MarketMath.sol";
import "../libraries/PendleStructs.sol";
import "../interfaces/IPendleRouter.sol";
import "../interfaces/IPendleData.sol";
import "../interfaces/IPendleMarket.sol";

contract PendleMarketReader {
    using SafeMath for uint256;

    struct Market {
        uint256 tokenBalanceIn;
        uint256 tokenWeightIn;
        uint256 tokenBalanceOut;
        uint256 tokenWeightOut;
        uint256 swapFee;
        uint256 effectiveLiquidity;
        address market;
    }

    IPendleData public data;

    constructor(IPendleData _data) {
        data = _data;
    }

    /**
    * @dev no wrapping here since users must be aware of the market they are querying against.
        For example, if they want to query market WETH/XYT, they must pass in WETH & XYT
        and not ETH & XYT
     */
    function getMarketRateExactIn(
        address _tokenIn,
        address _tokenOut,
        uint256 _inSwapAmount,
        bytes32 _marketFactoryId
    ) external view returns (address market, uint256 outSwapAmount) {
        market = data.getMarketFromKey(_tokenIn, _tokenOut, _marketFactoryId);
        require(address(market) != address(0), "MARKET_NOT_FOUND");
        Market memory marketData = _getMarketData(_tokenIn, _tokenOut, market);

        outSwapAmount = _calcExactOut(_inSwapAmount, marketData);
    }

    /**
     * @dev no wrapping here for the same reason as getMarketRateExactIn
     */
    function getMarketRateExactOut(
        address _tokenIn,
        address _tokenOut,
        uint256 _outSwapAmount,
        bytes32 _marketFactoryId
    ) external view returns (address market, uint256 inSwapAmount) {
        market = data.getMarketFromKey(_tokenIn, _tokenOut, _marketFactoryId);
        require(address(market) != address(0), "MARKET_NOT_FOUND");
        Market memory marketData = _getMarketData(_tokenIn, _tokenOut, market);

        inSwapAmount = _calcExactIn(_outSwapAmount, marketData);
    }

    /**
     * @dev no wrapping here for the same reason as getMarketRateExactIn
     */
    function getMarketReserves(
        bytes32 _marketFactoryId,
        address _xyt,
        address _token
    )
        external
        view
        returns (
            uint256 xytBalance,
            uint256 tokenBalance,
            uint256 lastUpdatedBlock
        )
    {
        IPendleMarket market = IPendleMarket(data.getMarket(_marketFactoryId, _xyt, _token));
        require(address(market) != address(0), "MARKET_NOT_FOUND");
        (xytBalance, , tokenBalance, , lastUpdatedBlock) = market.getReserves();
    }

    function getMarketTokenAddresses(address _market)
        external
        view
        returns (address token, address xyt)
    {
        require(address(_market) != address(0), "MARKET_NOT_FOUND");

        IPendleMarket pendleMarket = IPendleMarket(_market);
        token = pendleMarket.token();
        xyt = pendleMarket.xyt();
    }

    // _tokenIn & _tokenOut is guaranteed to be a pair of xyt/baseToken
    function _getMarketData(
        address _tokenIn,
        address, // address _tokenOut
        address marketAddress
    ) internal view returns (Market memory) {
        IPendleMarket market = IPendleMarket(marketAddress);
        (, address baseToken) = (market.xyt(), market.token());

        // assume _tokenIn is xyt, _tokenOut is baseToken
        (
            uint256 tokenInBalance,
            uint256 tokenInWeight,
            uint256 tokenOutBalance,
            uint256 tokenOutWeight,

        ) = market.getReserves();

        if (_tokenIn == baseToken) {
            // assumption is wrong, swap
            (tokenInBalance, tokenInWeight, tokenOutBalance, tokenOutWeight) = (
                tokenOutBalance,
                tokenOutWeight,
                tokenInBalance,
                tokenInWeight
            );
        }

        uint256 effectiveLiquidity =
            _calcEffectiveLiquidity(tokenInWeight, tokenOutBalance, tokenOutWeight);
        Market memory returnMarket =
            Market({
                market: marketAddress,
                tokenBalanceIn: tokenInBalance,
                tokenWeightIn: tokenInWeight,
                tokenBalanceOut: tokenOutBalance,
                tokenWeightOut: tokenOutWeight,
                swapFee: data.swapFee(),
                effectiveLiquidity: effectiveLiquidity
            });

        return returnMarket;
    }

    function _calcExactIn(uint256 outAmount, Market memory market)
        internal
        view
        returns (uint256 totalInput)
    {
        TokenReserve memory inTokenReserve;
        TokenReserve memory outTokenReserve;

        inTokenReserve.balance = market.tokenBalanceIn;
        inTokenReserve.weight = market.tokenWeightIn;
        outTokenReserve.balance = market.tokenBalanceOut;
        outTokenReserve.weight = market.tokenWeightOut;

        totalInput = MarketMath._calcExactIn(
            inTokenReserve,
            outTokenReserve,
            outAmount,
            data.swapFee()
        );
    }

    function _calcExactOut(uint256 inAmount, Market memory market)
        internal
        view
        returns (uint256 totalOutput)
    {
        TokenReserve memory inTokenReserve;
        TokenReserve memory outTokenReserve;

        inTokenReserve.balance = market.tokenBalanceIn;
        inTokenReserve.weight = market.tokenWeightIn;
        outTokenReserve.balance = market.tokenBalanceOut;
        outTokenReserve.weight = market.tokenWeightOut;

        totalOutput = MarketMath._calcExactOut(
            inTokenReserve,
            outTokenReserve,
            inAmount,
            data.swapFee()
        );
    }

    function _calcEffectiveLiquidity(
        uint256 tokenWeightIn,
        uint256 tokenBalanceOut,
        uint256 tokenWeightOut
    ) internal pure returns (uint256 effectiveLiquidity) {
        effectiveLiquidity = tokenWeightIn
            .mul(Math.RONE)
            .div(tokenWeightOut.add(tokenWeightIn))
            .mul(tokenBalanceOut)
            .div(Math.RONE);

        return effectiveLiquidity;
    }
}
