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

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "../libraries/MathLib.sol";
import "../interfaces/IPendleRouter.sol";
import "../interfaces/IPendleData.sol";
import "../interfaces/IPendleForge.sol";
import "../interfaces/IPendleMarketFactory.sol";
import "../interfaces/IPendleMarket.sol";
import "../periphery/Permissions.sol";
import "../periphery/Withdrawable.sol";
import "hardhat/console.sol";

contract PendleRouter is IPendleRouter, Permissions, Withdrawable {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    // Protection against reentrance;
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;
    uint256 private _reentrancyStatus;

    IWETH public immutable override weth;
    IPendleData public override data;
    address private constant ETH_ADDRESS = address(0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE);
    address private constant DUMMY_ERC20 = address(0x123);

    modifier pendleNonReentrant() {
        _checkNonReentrancy(); // use functions to reduce bytecode size
        _;
        // By storing the original value once again, a refund is triggered (see
        // https://eips.ethereum.org/EIPS/eip-2200)
        _reentrancyStatus = _NOT_ENTERED;
    }

    constructor(address _governance, IWETH _weth) Permissions(_governance) {
        weth = _weth;
        _reentrancyStatus = _NOT_ENTERED;
    }

    /**
     * @dev Accepts ETH via fallback from the WETH contract.
     **/
    receive() external payable {}

    function initialize(IPendleData _data) external {
        require(msg.sender == initializer, "FORBIDDEN");
        require(address(_data) != address(0), "ZERO_ADDRESS");

        initializer = address(0);
        data = _data;
    }

    /***********
     *  FORGE  *
     ***********/

    function addForge(bytes32 _forgeId, address _forgeAddress)
        external
        override
        initialized
        onlyGovernance
        pendleNonReentrant
    {
        require(_forgeId != bytes32(0), "ZERO_BYTES");
        require(_forgeAddress != address(0), "ZERO_ADDRESS");
        require(_forgeId == IPendleForge(_forgeAddress).forgeId(), "INVALID_ID");
        require(data.getForgeAddress(_forgeId) == address(0), "EXISTED_ID");

        data.addForge(_forgeId, _forgeAddress);
    }

    function newYieldContracts(
        bytes32 _forgeId,
        address _underlyingAsset,
        uint256 _expiry
    ) public override pendleNonReentrant returns (address ot, address xyt) {
        require(_forgeId != bytes32(0), "ZERO_BYTES");
        require(_underlyingAsset != address(0), "ZERO_ADDRESS");
        require(_expiry > block.timestamp, "INVALID_EXPIRY");

        IPendleForge forge = IPendleForge(data.getForgeAddress(_forgeId));
        require(address(forge) != address(0), "FORGE_NOT_EXISTS");

        ot = address(data.otTokens(_forgeId, _underlyingAsset, _expiry));
        xyt = address(data.xytTokens(_forgeId, _underlyingAsset, _expiry));
        require(ot == address(0) && xyt == address(0), "DUPLICATE_YIELD_CONTRACT");

        (ot, xyt) = forge.newYieldContracts(_underlyingAsset, _expiry);
    }

    function redeemAfterExpiry(
        bytes32 _forgeId,
        address _underlyingAsset,
        uint256 _expiry,
        address _to
    ) public override pendleNonReentrant returns (uint256 redeemedAmount) {
        require(_forgeId != bytes32(0), "ZERO_BYTES");
        require(_underlyingAsset != address(0), "ZERO_ADDRESS");
        require(_to != address(0), "ZERO_ADDRESS");

        IPendleForge forge = IPendleForge(data.getForgeAddress(_forgeId));
        require(address(forge) != address(0), "FORGE_NOT_EXISTS");

        redeemedAmount = forge.redeemAfterExpiry(msg.sender, _underlyingAsset, _expiry, _to);
    }

    function redeemDueInterests(
        bytes32 _forgeId,
        address _underlyingAsset,
        uint256 _expiry
    ) public override pendleNonReentrant returns (uint256 interests) {
        interests = _redeemDueInterestsInternal(_forgeId, _underlyingAsset, _expiry);
    }

    function redeemDueInterestsMultiple(
        bytes32[] calldata _forgeIds,
        address[] calldata _underlyingAssets,
        uint256[] calldata _expiries
    ) public override pendleNonReentrant returns (uint256[] memory interests) {
        require(
            _forgeIds.length == _underlyingAssets.length && _forgeIds.length == _expiries.length,
            "INVALID_ARRAYS"
        );
        interests = new uint256[](_forgeIds.length);
        for (uint256 i = 0; i < _forgeIds.length; i++) {
            interests[i] = _redeemDueInterestsInternal(
                _forgeIds[i],
                _underlyingAssets[i],
                _expiries[i]
            );
        }
    }

    // this function is called to redeem OT+XYT to get back the underlying, before the expiry
    function redeemUnderlying(
        bytes32 _forgeId,
        address _underlyingAsset,
        uint256 _expiry,
        uint256 _amountToRedeem,
        address _to
    ) public override pendleNonReentrant returns (uint256 redeemedAmount) {
        require(_forgeId != bytes32(0), "ZERO_BYTES");
        require(_underlyingAsset != address(0), "ZERO_ADDRESS");
        require(block.timestamp < _expiry, "EXPIRY_IS_OVER");

        IPendleForge forge = IPendleForge(data.getForgeAddress(_forgeId));
        require(address(forge) != address(0), "FORGE_NOT_EXISTS");

        redeemedAmount = forge.redeemUnderlying(
            msg.sender,
            _underlyingAsset,
            _expiry,
            _amountToRedeem,
            _to
        );
    }

    function renewYield(
        bytes32 _forgeId,
        uint256 _oldExpiry,
        address _underlyingAsset,
        uint256 _newExpiry,
        uint256 _amountToTokenize,
        address _yieldTo
    )
        public
        override
        pendleNonReentrant
        returns (
            uint256 redeemedAmount,
            address ot,
            address xyt
        )
    {
        require(_forgeId != bytes32(0), "ZERO_BYTES");
        require(_underlyingAsset != address(0), "ZERO_ADDRESS");
        require(_newExpiry > _oldExpiry, "new expiry > old expiry");
        require(_yieldTo != address(0), "ZERO_ADDRESS");

        redeemedAmount = redeemAfterExpiry(_forgeId, _underlyingAsset, _oldExpiry, msg.sender);
        (ot, xyt) = tokenizeYield(
            _forgeId,
            _underlyingAsset,
            _newExpiry,
            _amountToTokenize,
            _yieldTo
        );
    }

    function tokenizeYield(
        bytes32 _forgeId,
        address _underlyingAsset,
        uint256 _expiry,
        uint256 _amountToTokenize,
        address _to
    ) public override pendleNonReentrant returns (address ot, address xyt) {
        require(_forgeId != bytes32(0), "ZERO_BYTES");
        require(_underlyingAsset != address(0), "ZERO_ADDRESS");

        IPendleForge forge = IPendleForge(data.getForgeAddress(_forgeId));
        require(address(forge) != address(0), "FORGE_NOT_EXISTS");

        IERC20 aToken = IERC20(forge.getYieldBearingToken(_underlyingAsset));
        aToken.transferFrom(msg.sender, address(forge), _amountToTokenize);

        (ot, xyt) = forge.tokenizeYield(_underlyingAsset, _expiry, _amountToTokenize, _to);
    }

    /***********
     *  MARKET *
     ***********/

    function addMarketFactory(bytes32 _marketFactoryId, address _marketFactoryAddress)
        external
        override
        initialized
        onlyGovernance
        pendleNonReentrant
    {
        require(_marketFactoryId != bytes32(0), "ZERO_BYTES");
        require(_marketFactoryAddress != address(0), "ZERO_ADDRESS");
        require(
            _marketFactoryId == IPendleMarketFactory(_marketFactoryAddress).marketFactoryId(),
            "INVALID_FACTORY_ID"
        );
        require(data.getMarketFactoryAddress(_marketFactoryId) == address(0), "EXISTED_ID");
        data.addMarketFactory(_marketFactoryId, _marketFactoryAddress);
    }

    // add market liquidity by xyt and base tokens
    function addMarketLiquidityAll(
        bytes32 _marketFactoryId,
        address _xyt,
        address _token,
        uint256 _maxInXyt,
        uint256 _maxInToken,
        uint256 _exactOutLp
    ) public payable override pendleNonReentrant {
        address originalToken = _token;
        _token = _isETH(_token) ? address(weth) : _token;

        IPendleMarket market = IPendleMarket(data.getMarket(_marketFactoryId, _xyt, _token));
        require(address(market) != address(0), "MARKET_NOT_FOUND");

        (PendingTransfer[3] memory transfers) =
            market.addMarketLiquidityAll(_exactOutLp, _maxInXyt, _maxInToken);
        emit Join(msg.sender, transfers[0].amount, transfers[1].amount, address(market));

        _settlePendingTransfers(transfers, _xyt, originalToken, address(market));
    }

    // add market liquidity by xyt or base token
    function addMarketLiquiditySingle(
        bytes32 _marketFactoryId,
        address _xyt,
        address _token,
        bool _forXyt,
        uint256 _exactInAsset,
        uint256 _minOutLp
    ) public payable override pendleNonReentrant {
        address originalToken = _token;
        _token = _isETH(_token) ? address(weth) : _token;

        IPendleMarket market = IPendleMarket(data.getMarket(_marketFactoryId, _xyt, _token));
        require(address(market) != address(0), "MARKET_NOT_FOUND");

        address assetToTransferIn = _forXyt ? _xyt : originalToken;

        address assetForMarket = _forXyt ? _xyt : _token;
        (PendingTransfer[3] memory transfers) =
            market.addMarketLiquiditySingle(assetForMarket, _exactInAsset, _minOutLp);

        _settlePendingTransfers(transfers, assetToTransferIn, DUMMY_ERC20, address(market));

        if (_forXyt) {
            emit Join(msg.sender, _exactInAsset, 0, address(market));
        } else {
            emit Join(msg.sender, 0, _exactInAsset, address(market));
        }
    }

    // remove market liquidity by xyt and base tokens
    function removeMarketLiquidityAll(
        bytes32 _marketFactoryId,
        address _xyt,
        address _token,
        uint256 _exactInLp,
        uint256 _minOutXyt,
        uint256 _minOutToken
    ) public override pendleNonReentrant {
        address originalToken = _token;
        _token = _isETH(_token) ? address(weth) : _token;

        IPendleMarket market = IPendleMarket(data.getMarket(_marketFactoryId, _xyt, _token));
        require(address(market) != address(0), "MARKET_NOT_FOUND");

        // since there is burning of LPs involved, we need to transfer in LP first
        // otherwise the market might not have enough LPs to burn
        PendingTransfer memory lpTransfer = PendingTransfer({
            amount: _exactInLp,
            isOut: false
        });
        _settleTokenTransfer(address(market), lpTransfer, address(market));

        PendingTransfer[3] memory transfers =
            market.removeMarketLiquidityAll(_exactInLp, _minOutXyt, _minOutToken);

        _settlePendingTransfers(transfers, _xyt, originalToken, address(market));
        emit Exit(msg.sender, transfers[0].amount, transfers[1].amount, address(market));
    }

    // remove market liquidity by xyt or base tokens
    function removeMarketLiquiditySingle(
        bytes32 _marketFactoryId,
        address _xyt,
        address _token,
        bool _forXyt,
        uint256 _exactInLp,
        uint256 _minOutAsset
    ) public override pendleNonReentrant {
        address originalToken = _token;
        _token = _isETH(_token) ? address(weth) : _token;

        IPendleMarket market = IPendleMarket(data.getMarket(_marketFactoryId, _xyt, _token));
        require(address(market) != address(0), "MARKET_NOT_FOUND");

        /* _transferIn(address(market), _exactInLp); */

        address assetForMarket = _forXyt ? _xyt : _token;

        // since there is burning of LPs involved, we need to transfer in LP first
        // otherwise the market might not have enough LPs to burn
        PendingTransfer memory lpTransfer = PendingTransfer({
            amount: _exactInLp,
            isOut: false
        });
        _settleTokenTransfer(address(market), lpTransfer, address(market));

        PendingTransfer[3] memory transfers =
            market.removeMarketLiquiditySingle(assetForMarket, _exactInLp, _minOutAsset);

        address assetToTransferOut = _forXyt ? _xyt : originalToken;
        _settleTokenTransfer(assetToTransferOut, transfers[0], address(market));

        if (_forXyt) {
            emit Exit(msg.sender, transfers[0].amount, 0, address(market));
        } else {
            emit Exit(msg.sender, 0, transfers[0].amount, address(market));
        }
    }

    function createMarket(
        bytes32 _marketFactoryId,
        address _xyt,
        address _token
    ) public override pendleNonReentrant returns (address market) {
        require(_xyt != address(0), "ZERO_ADDRESS");
        require(_token != address(0), "ZERO_ADDRESS");
        require(data.isXyt(_xyt), "INVALID_XYT");
        require(!data.isXyt(_token), "XYT_QUOTE_PAIR_FORBIDDEN");
        require(data.getMarket(_marketFactoryId, _xyt, _token) == address(0), "EXISTED_MARKET");

        IPendleMarketFactory factory =
            IPendleMarketFactory(data.getMarketFactoryAddress(_marketFactoryId));
        require(address(factory) != address(0), "ZERO_ADDRESS");
        bytes32 forgeId = IPendleForge(IPendleYieldToken(_xyt).forge()).forgeId();
        require(data.validForgeFactoryPair(forgeId, _marketFactoryId), "INVALID_FORGE_FACTORY");

        market = factory.createMarket(_xyt, _token);
        IERC20(_xyt).safeApprove(market, type(uint256).max);
        IERC20(_token).safeApprove(market, type(uint256).max);
        IERC20(market).safeApprove(market, type(uint256).max);
    }

    /**
     * @dev Users can either set _token as ETH or WETH to trade with XYT-WETH markets
     * If they put in ETH, they must send ETH along and _token will be auto wrapped to WETH
     * If they put in WETH, the function will run the same as other tokens
     */
    function bootstrapMarket(
        bytes32 _marketFactoryId,
        address _xyt,
        address _token,
        uint256 _initialXytLiquidity,
        uint256 _initialTokenLiquidity
    ) public payable override pendleNonReentrant {
        require(_initialXytLiquidity > 0, "INVALID_XYT_AMOUNT");
        require(_initialTokenLiquidity > 0, "INVALID_TOKEN_AMOUNT");

        address originalToken = _token;
        _token = _isETH(_token) ? address(weth) : _token;

        IPendleMarket market = IPendleMarket(data.getMarket(_marketFactoryId, _xyt, _token));
        require(address(market) != address(0), "MARKET_NOT_FOUND");

        (PendingTransfer[3] memory transfers) = market.bootstrap(_initialXytLiquidity, _initialTokenLiquidity);

        emit Join(msg.sender, _initialXytLiquidity, _initialTokenLiquidity, address(market));

        data.updateMarketInfo(_xyt, _token, _marketFactoryId);
        _settlePendingTransfers(transfers, _xyt, originalToken, address(market));
    }

    // trade by swap exact amount of token into market
    function swapExactIn(
        address _tokenIn,
        address _tokenOut,
        uint256 _inTotalAmount,
        uint256 _minOutTotalAmount,
        uint256 _maxPrice,
        bytes32 _marketFactoryId
    ) public payable override pendleNonReentrant returns (uint256 outSwapAmount) {
        address originalTokenIn = _tokenIn;
        address originalTokenOut = _tokenOut;
        _tokenIn = _isETH(_tokenIn) ? address(weth) : _tokenIn;
        _tokenOut = _isETH(_tokenOut) ? address(weth) : _tokenOut;

        IPendleMarket market =
            IPendleMarket(data.getMarketFromKey(_tokenIn, _tokenOut, _marketFactoryId));
        PendingTransfer[3] memory transfers;
        (outSwapAmount,,transfers) = market.swapExactIn(
            _tokenIn,
            _inTotalAmount,
            _tokenOut,
            _minOutTotalAmount,
            _maxPrice
        );

        _settlePendingTransfers(transfers, originalTokenIn, originalTokenOut, address(market));

        emit SwapEvent(
            msg.sender,
            _tokenIn,
            _tokenOut,
            _inTotalAmount,
            outSwapAmount,
            address(market)
        );
    }

    // trade by swap exact amount of token out of market
    function swapExactOut(
        address _tokenIn,
        address _tokenOut,
        uint256 _outTotalAmount,
        uint256 _maxInTotalAmount,
        uint256 _maxPrice,
        bytes32 _marketFactoryId
    ) public payable override pendleNonReentrant returns (uint256 inSwapAmount) {
        address originalTokenIn = _tokenIn;
        address originalTokenOut = _tokenOut;
        _tokenIn = _isETH(_tokenIn) ? address(weth) : _tokenIn;
        _tokenOut = _isETH(_tokenOut) ? address(weth) : _tokenOut;

        IPendleMarket market =
            IPendleMarket(data.getMarketFromKey(_tokenIn, _tokenOut, _marketFactoryId));

        PendingTransfer[3] memory transfers;
        (inSwapAmount,,transfers) = market.swapExactOut(
            _tokenIn,
            _maxInTotalAmount,
            _tokenOut,
            _outTotalAmount,
            _maxPrice
        );

        _settlePendingTransfers(transfers, originalTokenIn, originalTokenOut, address(market));

        emit SwapEvent(
            msg.sender,
            _tokenIn,
            _tokenOut,
            inSwapAmount,
            _outTotalAmount,
            address(market)
        );
    }

    /**
    * @dev Needed for multi-path off-chain routing
    * @dev No "original" variables in this function since both _tokenIn and _tokenOut
            will not be wrapped.
     */
    function swapPathExactIn(
        Swap[][] memory _swapPath,
        address _tokenIn,
        address _tokenOut,
        uint256 _inTotalAmount,
        uint256 _minOutTotalAmount
    ) public payable override pendleNonReentrant returns (uint256 outTotalAmount) {

        /* _transferIn(_tokenIn, _inTotalAmount); */
        uint256 sumInAmount;
        for (uint256 i = 0; i < _swapPath.length; i++) {
            uint256 swapRouteLength = _swapPath[i].length;
            require(
                _swapPath[i][0].tokenIn == _tokenIn &&
                    _swapPath[i][swapRouteLength - 1].tokenOut == _tokenOut,
                "INVALID_PATH"
            );
            sumInAmount = sumInAmount.add(_swapPath[i][0].swapAmount);
            uint256 tokenAmountOut;
            _settleTokenTransfer(_tokenIn, PendingTransfer({ amount: _inTotalAmount, isOut: false }), _swapPath[i][0].market);

            for (uint256 j = 0; j < _swapPath[i].length; j++) {
                Swap memory swap = _swapPath[i][j];
                swap.tokenIn = _getMarketToken(swap.tokenIn); // make it weth if its eth
                swap.tokenOut = _getMarketToken(swap.tokenOut); // make it weth if its eth
                if (j >= 1) {
                    swap.swapAmount = tokenAmountOut;
                    IERC20(swap.tokenIn).safeTransferFrom(_swapPath[i][j-1].market, swap.market, swap.swapAmount);
                }

                IPendleMarket market = IPendleMarket(swap.market);

                (tokenAmountOut,, ) = market.swapExactIn(
                    swap.tokenIn,
                    swap.swapAmount,
                    swap.tokenOut,
                    swap.limitReturnAmount,
                    swap.maxPrice
                );
            }

            _settleTokenTransfer(_tokenOut, PendingTransfer({ amount: tokenAmountOut, isOut: true }), _swapPath[i][swapRouteLength - 1].market);
            outTotalAmount = tokenAmountOut.add(outTotalAmount);
        }
        require(sumInAmount == _inTotalAmount, "INVALID_AMOUNTS");
        require(outTotalAmount >= _minOutTotalAmount, "LIMIT_OUT_ERROR");

        /* _transferOut(_tokenOut, outTotalAmount); */
    }

    /**
    * @dev Needed for multi-path off-chain routing
    * @dev No "original" variables in this function since both _tokenIn and _tokenOut
            will not be wrapped.
     */
    function swapPathExactOut(
        Swap[][] memory _swapPath,
        address _tokenIn,
        address _tokenOut,
        uint256 _maxInTotalAmount
    ) public payable override pendleNonReentrant returns (uint256 inTotalAmount) {
        uint256 outTotalAmount;
        uint256 change = _maxInTotalAmount;

        _transferIn(_tokenIn, _maxInTotalAmount);

        for (uint256 i = 0; i < _swapPath.length; i++) {
            require(
                _swapPath[i][0].tokenIn == _tokenIn &&
                    _swapPath[i][_swapPath[i].length - 1].tokenOut == _tokenOut,
                "INVALID_PATH"
            );
            uint256 firstSwapTokenIn;
            // Specific code for a simple swap and a multihop (2 swaps in sequence)
            if (_swapPath[i].length == 1) {
                Swap memory swap = _swapPath[i][0];

                IPendleMarket market = IPendleMarket(swap.market);

                (firstSwapTokenIn,, ) = market.swapExactOut(
                    swap.tokenIn,
                    swap.limitReturnAmount,
                    swap.tokenOut,
                    swap.swapAmount,
                    swap.maxPrice
                );
                outTotalAmount = outTotalAmount.add(swap.swapAmount);
            } else {
                /*
                Consider we are swapping A -> B and B -> C. The goal is to buy a given amount
                of token C. But first we need to buy B with A so we can then buy C with B
                To get the exact amount of C we then first need to calculate how much B we'll need:
                */
                uint256 intermediateTokenAmount; // This would be token B as described above
                Swap memory secondSwap = _swapPath[i][1];
                IPendleMarket secondMarket = IPendleMarket(secondSwap.market);
                IPendleMarket.TokenReserve memory inTokenReserve;
                IPendleMarket.TokenReserve memory outTokenReserve;

                inTokenReserve.balance = secondMarket.getBalance(secondSwap.tokenIn);
                inTokenReserve.weight = secondMarket.getWeight(secondSwap.tokenIn);
                outTokenReserve.balance = secondMarket.getBalance(secondSwap.tokenOut);
                outTokenReserve.weight = secondMarket.getWeight(secondSwap.tokenOut);

                intermediateTokenAmount = secondMarket.calcExactOut(
                    inTokenReserve,
                    outTokenReserve,
                    secondSwap.swapAmount,
                    data.swapFee()
                );

                // Buy intermediateTokenAmount of token B with A in the first pool
                Swap memory firstSwap = _swapPath[i][0];
                IPendleMarket firstMarket = IPendleMarket(firstSwap.market);

                (firstSwapTokenIn,, ) = firstMarket.swapExactOut(
                    firstSwap.tokenIn,
                    firstSwap.limitReturnAmount,
                    firstSwap.tokenOut,
                    intermediateTokenAmount, // This is the amount of token B we need
                    firstSwap.maxPrice
                );

                // Buy the final amount of token C desired
                secondMarket.swapExactOut(
                    secondSwap.tokenIn,
                    secondSwap.limitReturnAmount,
                    secondSwap.tokenOut,
                    secondSwap.swapAmount,
                    secondSwap.maxPrice
                );
                outTotalAmount = outTotalAmount.add(secondSwap.swapAmount);
            }

            inTotalAmount = firstSwapTokenIn.add(inTotalAmount);
        }

        require(inTotalAmount <= _maxInTotalAmount, "LIMIT_IN_ERROR");
        change = change.sub(inTotalAmount);

        _transferOut(_tokenOut, outTotalAmount);
        _transferOut(_tokenIn, change);
    }

    function claimLpInterests(address[] calldata markets)
        public
        override
        pendleNonReentrant
        returns (uint256[] memory interests)
    {
        interests = new uint256[](markets.length);
        for (uint256 i = 0; i < markets.length; i++) {
            require(data.isMarket(markets[i]), "INVALID_MARKET");
            interests[i] = IPendleMarket(markets[i]).claimLpInterests(msg.sender);
        }
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
    ) public view override returns (Swap memory swap, uint256 outSwapAmount) {
        address market = data.getMarketFromKey(_tokenIn, _tokenOut, _marketFactoryId);
        Market memory marketData = _getMarketData(_tokenIn, _tokenOut, market);

        outSwapAmount = _calcExactOut(_inSwapAmount, marketData);

        swap = Swap({
            market: market,
            tokenIn: _tokenIn,
            tokenOut: _tokenOut,
            swapAmount: _inSwapAmount,
            limitReturnAmount: 0,
            maxPrice: type(uint256).max
        });

        return (swap, outSwapAmount);
    }

    /**
     * @dev no wrapping here for the same reason as getMarketRateExactIn
     */
    function getMarketRateExactOut(
        address _tokenIn,
        address _tokenOut,
        uint256 _outSwapAmount,
        bytes32 _marketFactoryId
    ) public view override returns (Swap memory swap, uint256 inSwapAmount) {
        address market = data.getMarketFromKey(_tokenIn, _tokenOut, _marketFactoryId);
        Market memory marketData = _getMarketData(_tokenIn, _tokenOut, market);

        inSwapAmount = _calcExactIn(_outSwapAmount, marketData);

        swap = Swap({
            market: market,
            tokenIn: _tokenIn,
            tokenOut: _tokenOut,
            swapAmount: inSwapAmount,
            limitReturnAmount: type(uint256).max,
            maxPrice: type(uint256).max
        });

        return (swap, inSwapAmount);
    }

    /**
     * @dev no wrapping here for the same reason as getMarketRateExactIn
     */
    function getMarketReserves(
        bytes32 _marketFactoryId,
        address _xyt,
        address _token
    )
        public
        view
        override
        returns (
            uint256 xytAmount,
            uint256 tokenAmount,
            uint256 currentTime
        )
    {
        IPendleMarket market = IPendleMarket(data.getMarket(_marketFactoryId, _xyt, _token));
        require(address(market) != address(0), "MARKET_NOT_FOUND");
        (xytAmount, tokenAmount, currentTime) = market.getReserves();
    }

    function getMarketTokenAddresses(address _market)
        public
        view
        override
        returns (address token, address xyt)
    {
        require(address(_market) != address(0), "MARKET_NOT_FOUND");

        IPendleMarket benmarkMarket = IPendleMarket(_market);
        token = benmarkMarket.token();
        xyt = benmarkMarket.xyt();
    }

    // function _isMarketLocked(address _xyt) internal pure returns (bool isLocked){
    //     // To implement
    //     isLocked = false; // never locked
    // }

    function _checkNonReentrancy() internal {
        if (!data.reentrancyWhitelisted(msg.sender)) {
            // On the first call to pendleNonReentrant, _notEntered will be true
            require(_reentrancyStatus != _ENTERED, "REENTRANT_CALL");

            // Any calls to nonReentrant after this point will fail
            _reentrancyStatus = _ENTERED;
        }
    }

    /// @dev Inbound transfer from msg.sender to router
    function _transferIn(address _token, uint256 _amount) internal {
        if (_amount == 0) return;
        if (_isETH(_token)) {
            require(msg.value == _amount, "ETH_SENT_MISMATCH");
            weth.deposit{value: msg.value}();
        } else {
            IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);
        }
    }

    /// @dev Outbound transfer from router to msg.sender
    function _transferOut(address _token, uint256 _amount) internal {
        if (_amount == 0) return;

        if (_isETH(_token)) {
            weth.withdraw(_amount);
            (bool success, ) = msg.sender.call{value: _amount}("");
            require(success, "TRANSFER_FAILED");
        } else {
            IERC20(_token).safeTransfer(msg.sender, _amount);
        }
    }

    function _getMarketData(
        address _tokenIn,
        address _tokenOut,
        address marketAddress
    ) internal view returns (Market memory) {
        IPendleMarket market = IPendleMarket(marketAddress);
        uint256 tokenBalanceIn = market.getBalance(_tokenIn);
        uint256 tokenBalanceOut = market.getBalance(_tokenOut);
        uint256 tokenWeightIn = market.getWeight(_tokenIn);
        uint256 tokenWeightOut = market.getWeight(_tokenOut);

        uint256 effectiveLiquidity =
            _calcEffectiveLiquidity(tokenWeightIn, tokenBalanceOut, tokenWeightOut);
        Market memory returnMarket =
            Market({
                market: marketAddress,
                tokenBalanceIn: tokenBalanceIn,
                tokenWeightIn: tokenWeightIn,
                tokenBalanceOut: tokenBalanceOut,
                tokenWeightOut: tokenWeightOut,
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
        IPendleMarket.TokenReserve memory inTokenReserve;
        IPendleMarket.TokenReserve memory outTokenReserve;

        inTokenReserve.balance = market.tokenBalanceIn;
        inTokenReserve.weight = market.tokenWeightIn;
        outTokenReserve.balance = market.tokenBalanceOut;
        outTokenReserve.weight = market.tokenWeightOut;

        totalInput = IPendleMarket(market.market).calcExactIn(
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
        IPendleMarket.TokenReserve memory inTokenReserve;
        IPendleMarket.TokenReserve memory outTokenReserve;

        inTokenReserve.balance = market.tokenBalanceIn;
        inTokenReserve.weight = market.tokenWeightIn;
        outTokenReserve.balance = market.tokenBalanceOut;
        outTokenReserve.weight = market.tokenWeightOut;

        totalOutput = IPendleMarket(market.market).calcExactOut(
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

    function _isETH(address token) internal pure returns (bool) {
        return (token == ETH_ADDRESS);
    }

    function _redeemDueInterestsInternal(
        bytes32 _forgeId,
        address _underlyingAsset,
        uint256 _expiry
    ) internal returns (uint256 interests) {
        require(data.isValidXYT(_forgeId, _underlyingAsset, _expiry), "INVALID_XYT");
        IPendleForge forge = IPendleForge(data.getForgeAddress(_forgeId));

        interests = forge.redeemDueInterests(msg.sender, _underlyingAsset, _expiry);
    }


    function _settlePendingTransfers(PendingTransfer[3] memory transfers, address firstToken, address secondToken, address market) internal {
        _settleTokenTransfer(firstToken, transfers[0], market);
        _settleTokenTransfer(secondToken, transfers[1], market);
        _settleTokenTransfer(market, transfers[2], market);
    }

    function _settleTokenTransfer(address token, PendingTransfer memory transfer, address market) internal {
        console.log("\t _settleTokenTransfer, token = %s, amount= %s, isOut =%s", address(token), transfer.amount, transfer.isOut);
        if (transfer.amount == 0) {
            return;
        }
        if (transfer.isOut) {
            if (_isETH(token)) {
                console.log("\t transfering ETH out");
                weth.transferFrom(market, address(this), transfer.amount);
                weth.withdraw(transfer.amount);
                (bool success, ) = msg.sender.call{value: transfer.amount}("");
                require(success, "TRANSFER_FAILED");
            } else {
                IERC20(token).safeTransferFrom(market, msg.sender, transfer.amount);
            }
        } else {
            if (_isETH(token)) {
                console.log("\t transfering ETH in");
                require(msg.value == transfer.amount, "ETH_SENT_MISMATCH");
                weth.deposit{value: msg.value}();
                weth.transfer(market, transfer.amount);
            } else {
                IERC20(token).safeTransferFrom(msg.sender, market, transfer.amount);
            }
        }
    }

    function _getMarketToken(address token) internal view returns (address) {
        if (_isETH(token)) return address(weth);
        return token;
    }
}
