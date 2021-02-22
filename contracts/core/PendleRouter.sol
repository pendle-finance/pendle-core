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
import {Math} from "../libraries/PendleLibrary.sol";
import "../interfaces/IPendleRouter.sol";
import "../interfaces/IPendleData.sol";
import "../interfaces/IPendleForge.sol";
import "../interfaces/IPendleMarketFactory.sol";
import "../interfaces/IPendleMarket.sol";
import "../periphery/Permissions.sol";

contract PendleRouter is IPendleRouter, Permissions {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    IWETH public immutable override weth;
    IPendleData public override data;
    address private constant ETH_ADDRESS = address(0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE);

    constructor(address _governance, IWETH _weth) Permissions(_governance) {
        weth = _weth;
    }

    /**
     * @dev Accepts ETH via fallback from the WETH contract.
     **/
    receive() external payable {}

    function initialize(IPendleData _data) external {
        require(msg.sender == initializer, "Pendle: forbidden");
        require(address(_data) != address(0), "Pendle: zero address");

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
    {
        require(_forgeId != bytes32(0), "Pendle: zero bytes");
        require(_forgeAddress != address(0), "Pendle: zero address");
        require(_forgeId == IPendleForge(_forgeAddress).forgeId(), "Pendle: wrong id");
        require(data.getForgeAddress(_forgeId) == address(0), "Pendle: existing id");

        data.addForge(_forgeId, _forgeAddress);
    }

    function newYieldContracts(
        bytes32 _forgeId,
        address _underlyingAsset,
        uint256 _expiry
    ) public override returns (address ot, address xyt) {
        require(_forgeId != bytes32(0), "Pendle: zero bytes");
        require(_underlyingAsset != address(0), "Pendle: zero address");

        IPendleForge forge = IPendleForge(data.getForgeAddress(_forgeId));
        require(address(forge) != address(0), "Pendle: forge does not exist");

        ot = address(data.otTokens(_forgeId, _underlyingAsset, _expiry));
        xyt = address(data.xytTokens(_forgeId, _underlyingAsset, _expiry));
        require(ot == address(0) && xyt == address(0), "Pendle: duplicate yield contracts");

        (ot, xyt) = forge.newYieldContracts(_underlyingAsset, _expiry);
    }

    function redeemAfterExpiry(
        bytes32 _forgeId,
        address _underlyingAsset,
        uint256 _expiry,
        address _to
    ) public override returns (uint256 redeemedAmount) {
        require(_forgeId != bytes32(0), "Pendle: zero bytes");
        require(_underlyingAsset != address(0), "Pendle: zero address");
        require(_to != address(0), "Pendle: zero address");

        IPendleForge forge = IPendleForge(data.getForgeAddress(_forgeId));
        require(address(forge) != address(0), "Pendle: forge does not exist");

        redeemedAmount = forge.redeemAfterExpiry(msg.sender, _underlyingAsset, _expiry, _to);
    }

    function redeemDueInterests(
        bytes32 _forgeId,
        address _underlyingAsset,
        uint256 _expiry
    ) public override returns (uint256 interests) {
        require(_forgeId != bytes32(0), "Pendle: zero bytes");
        require(_underlyingAsset != address(0), "Pendle: zero address");

        IPendleForge forge = IPendleForge(data.getForgeAddress(_forgeId));
        require(address(forge) != address(0), "Pendle: forge does not exist");

        interests = forge.redeemDueInterests(msg.sender, _underlyingAsset, _expiry);
    }

    function redeemUnderlying(
        bytes32 _forgeId,
        address _underlyingAsset,
        uint256 _expiry,
        uint256 _amountToRedeem,
        address _to
    ) public override returns (uint256 redeemedAmount) {
        require(_forgeId != bytes32(0), "Pendle: zero bytes");
        require(_underlyingAsset != address(0), "Pendle: zero address");

        IPendleForge forge = IPendleForge(data.getForgeAddress(_forgeId));
        require(address(forge) != address(0), "Pendle: forge does not exist");

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
        returns (
            uint256 redeemedAmount,
            address ot,
            address xyt
        )
    {
        require(_forgeId != bytes32(0), "Pendle: zero bytes");
        require(_underlyingAsset != address(0), "Pendle: zero address");
        require(_newExpiry > _oldExpiry, "Pendle: new expiry > old expiry");
        require(_yieldTo != address(0), "Pendle: zero address");

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
    ) public override returns (address ot, address xyt) {
        require(_forgeId != bytes32(0), "Pendle: zero bytes");
        require(_underlyingAsset != address(0), "Pendle: zero address");

        IPendleForge forge = IPendleForge(data.getForgeAddress(_forgeId));
        require(address(forge) != address(0), "Pendle: forge does not exist");

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
    {
        require(_marketFactoryId != bytes32(0), "Pendle: zero bytes");
        require(_marketFactoryAddress != address(0), "Pendle: zero address");
        require(
            _marketFactoryId == IPendleMarketFactory(_marketFactoryAddress).marketFactoryId(),
            "Pendle: wrong id"
        );
        require(
            data.getMarketFactoryAddress(_marketFactoryId) == address(0),
            "Pendle: existing id"
        );
        data.addMarketFactory(_marketFactoryId, _marketFactoryAddress);
    }

    function addMarketLiquidityAll(
        bytes32 _marketFactoryId,
        address _xyt,
        address _token,
        uint256 _maxInXyt,
        uint256 _maxInToken,
        uint256 _exactOutLp
    ) public payable override {
        IPendleMarket market =
            IPendleMarket(
                data.getMarket(_marketFactoryId, _xyt, _isETH(_token) ? address(weth) : _token)
            );
        require(address(market) != address(0), "Pendle: market not found");
        // require(!_isMarketLocked(_xyt), "MARKET_LOCKED");

        _transferIn(_xyt, _maxInXyt);
        _transferIn(_token, _maxInToken);

        (uint256 amountXytUsed, uint256 amountTokenUsed) =
            market.addMarketLiquidityAll(_exactOutLp, _maxInXyt, _maxInToken);

        _transferOut(address(market), _exactOutLp);
        _transferOut(_xyt, _maxInXyt - amountXytUsed); // transfer unused XYT back to user
        _transferOut(_token, _maxInToken - amountTokenUsed); // transfer unused Token back to user
    }

    function addMarketLiquiditySingle(
        bytes32 _marketFactoryId,
        address _xyt,
        address _token,
        bool _forXyt,
        uint256 _exactInAsset,
        uint256 _minOutLp
    ) public payable override {
        IPendleMarket market =
            IPendleMarket(
                data.getMarket(_marketFactoryId, _xyt, _isETH(_token) ? address(weth) : _token)
            );
        require(address(market) != address(0), "Pendle: market not found");
        // require(!_isMarketLocked(_xyt),"MARKET_LOCKED");

        address asset = _forXyt ? _xyt : _token;
        _transferIn(asset, _exactInAsset);

        asset = _isETH(_token) ? address(weth) : asset;
        uint256 exactOutLp = market.addMarketLiquiditySingle(asset, _exactInAsset, _minOutLp);

        _transferOut(address(market), exactOutLp);
    }

    function removeMarketLiquidityAll(
        bytes32 _marketFactoryId,
        address _xyt,
        address _token,
        uint256 _exactInLp,
        uint256 _minOutXyt,
        uint256 _minOutToken
    ) public override {
        IPendleMarket market =
            IPendleMarket(
                data.getMarket(_marketFactoryId, _xyt, _isETH(_token) ? address(weth) : _token)
            );
        require(address(market) != address(0), "Pendle: market not found");
        // require(!_isMarketLocked(_xyt),"MARKET_LOCKED"); // this operation will never be locked

        _transferIn(address(market), _exactInLp);

        (uint256 xytAmount, uint256 tokenAmount) =
            market.removeMarketLiquidityAll(_exactInLp, _minOutXyt, _minOutToken);

        _transferOut(_xyt, xytAmount);
        _transferOut(_token, tokenAmount);
    }

    function removeMarketLiquiditySingle(
        bytes32 _marketFactoryId,
        address _xyt,
        address _token,
        bool _forXyt,
        uint256 _exactInLp,
        uint256 _minOutAsset
    ) public override {
        IPendleMarket market =
            IPendleMarket(
                data.getMarket(_marketFactoryId, _xyt, _isETH(_token) ? address(weth) : _token)
            );
        require(address(market) != address(0), "Pendle: market not found");
        // require(!_isMarketLocked(_xyt),"MARKET_LOCKED");

        _transferIn(address(market), _exactInLp);

        address asset = _forXyt ? _xyt : _token;
        asset = _isETH(_token) ? address(weth) : asset;

        uint256 assetOut = market.removeMarketLiquiditySingle(asset, _exactInLp, _minOutAsset);

        asset = _forXyt ? _xyt : _token;
        _transferOut(asset, assetOut);
    }

    function createMarket(
        bytes32 _marketFactoryId,
        address _xyt,
        address _token
    ) public override returns (address market) {
        require(_xyt != address(0), "Pendle: zero address");
        require(_token != address(0), "Pendle: zero address");

        IPendleMarketFactory factory =
            IPendleMarketFactory(data.getMarketFactoryAddress(_marketFactoryId));
        require(address(factory) != address(0), "Pendle: zero address");

        market = factory.createMarket(_xyt, _token);
        IERC20(_xyt).safeApprove(market, Math.UINT_MAX_VALUE);
        IERC20(_token).safeApprove(market, Math.UINT_MAX_VALUE);
        IERC20(market).safeApprove(market, Math.UINT_MAX_VALUE);
    }

    function bootstrapMarket(
        bytes32 _marketFactoryId,
        address _xyt,
        address _token,
        uint256 _initialXytLiquidity,
        uint256 _initialTokenLiquidity
    ) public payable override {
        require(_initialXytLiquidity > 0, "Pendle: initial XYT <= 0");
        require(_initialTokenLiquidity > 0, "Pendle: initial tokens <= 0");

        _token = _isETH(_token) ? address(weth) : _token;

        IPendleMarket market = IPendleMarket(data.getMarket(_marketFactoryId, _xyt, _token));
        require(address(market) != address(0), "Pendle: market not found");

        _transferIn(_xyt, _initialXytLiquidity);
        _transferIn(_token, _initialTokenLiquidity);

        uint256 lpAmount = market.bootstrap(_initialXytLiquidity, _initialTokenLiquidity);

        _transferOut(address(market), lpAmount);

        address[] memory xyts = new address[](1);
        address[] memory tokens = new address[](1);
        xyts[0] = _xyt;
        tokens[0] = _token;
        data.updateMarketInfo(_xyt, _token, _marketFactoryId);
    }

    function swapExactIn(
        address _tokenIn,
        address _tokenOut,
        uint256 _inTotalAmount,
        uint256 _minOutTotalAmount,
        uint256 _maxPrice,
        bytes32 _marketFactoryId
    ) public payable override returns (uint256 outSwapAmount) {
        _tokenIn = _isETH(_tokenIn) ? address(weth) : _tokenIn;
        _tokenOut = _isETH(_tokenOut) ? address(weth) : _tokenOut;

        _transferIn(_tokenIn, _inTotalAmount);

        IPendleMarket market =
            IPendleMarket(data.getMarketFromKey(_tokenIn, _tokenOut, _marketFactoryId));
        (outSwapAmount, ) = market.swapExactIn(
            _tokenIn,
            _inTotalAmount,
            _tokenOut,
            _minOutTotalAmount,
            _maxPrice
        );

        require(outSwapAmount >= _minOutTotalAmount, "Pendle: limit out error");

        _transferOut(_tokenOut, outSwapAmount);
    }

    function swapExactOut(
        address _tokenIn,
        address _tokenOut,
        uint256 _outTotalAmount,
        uint256 _maxInTotalAmount,
        uint256 _maxPrice,
        bytes32 _marketFactoryId
    ) public payable override returns (uint256 inSwapAmount) {
        _tokenIn = _isETH(_tokenIn) ? address(weth) : _tokenIn;
        _tokenOut = _isETH(_tokenOut) ? address(weth) : _tokenOut;
        uint256 change = _maxInTotalAmount;

        _transferIn(_tokenIn, _maxInTotalAmount);

        IPendleMarket market =
            IPendleMarket(data.getMarketFromKey(_tokenIn, _tokenOut, _marketFactoryId));
        (inSwapAmount, ) = market.swapExactOut(
            _tokenIn,
            _maxInTotalAmount,
            _tokenOut,
            _outTotalAmount,
            _maxPrice
        );

        require(inSwapAmount <= _maxInTotalAmount, "Pendle: limit in error");
        change = change.sub(inSwapAmount);

        _transferOut(_tokenOut, _outTotalAmount);
        _transferOut(_tokenIn, change);
    }

    /// @dev Needed for multi-path off-chain routing
    function swapPathExactIn(
        Swap[][] memory _swapPath,
        address _tokenIn,
        address _tokenOut,
        uint256 _inTotalAmount,
        uint256 _minOutTotalAmount
    ) public payable override returns (uint256 outTotalAmount) {
        _transferIn(_tokenIn, _inTotalAmount);

        for (uint256 i = 0; i < _swapPath.length; i++) {
            uint256 tokenAmountOut;
            for (uint256 j = 0; j < _swapPath[i].length; j++) {
                Swap memory swap = _swapPath[i][j];

                if (j >= 1) {
                    swap.swapAmount = tokenAmountOut;
                }

                IPendleMarket market = IPendleMarket(swap.market);

                (tokenAmountOut, ) = market.swapExactIn(
                    swap.tokenIn,
                    swap.swapAmount,
                    swap.tokenOut,
                    swap.limitReturnAmount,
                    swap.maxPrice
                );
            }

            outTotalAmount = tokenAmountOut.add(outTotalAmount);
        }

        require(outTotalAmount >= _minOutTotalAmount, "Pendle: limit out error");

        _transferOut(_tokenOut, outTotalAmount);
    }

    /// @dev Needed for multi-path off-chain routing
    function swapPathExactOut(
        Swap[][] memory _swapPath,
        address _tokenIn,
        address _tokenOut,
        uint256 _maxInTotalAmount
    ) public payable override returns (uint256 inTotalAmount) {
        uint256 outTotalAmount;
        uint256 change = _maxInTotalAmount;

        _transferIn(_tokenIn, _maxInTotalAmount);

        for (uint256 i = 0; i < _swapPath.length; i++) {
            uint256 firstSwapTokenIn;
            // Specific code for a simple swap and a multihop (2 swaps in sequence)
            if (_swapPath[i].length == 1) {
                Swap memory swap = _swapPath[i][0];

                IPendleMarket market = IPendleMarket(swap.market);

                (firstSwapTokenIn, ) = market.swapExactOut(
                    swap.tokenIn,
                    swap.limitReturnAmount,
                    swap.tokenOut,
                    swap.swapAmount,
                    swap.maxPrice
                );
                outTotalAmount = outTotalAmount.add(swap.swapAmount);
            } else {
                // Consider we are swapping A -> B and B -> C. The goal is to buy a given amount
                // of token C. But first we need to buy B with A so we can then buy C with B
                // To get the exact amount of C we then first need to calculate how much B
                // we'll need:
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

                (firstSwapTokenIn, ) = firstMarket.swapExactOut(
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

        require(inTotalAmount <= _maxInTotalAmount, "Pendle: limit in error");
        change = change.sub(inTotalAmount);

        _transferOut(_tokenOut, outTotalAmount);
        _transferOut(_tokenIn, change);
    }

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
            maxPrice: Math.UINT_MAX_VALUE
        });

        return (swap, outSwapAmount);
    }

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
            limitReturnAmount: Math.UINT_MAX_VALUE,
            maxPrice: Math.UINT_MAX_VALUE
        });

        return (swap, inSwapAmount);
    }

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
        require(address(market) != address(0), "Pendle: market not found");
        (xytAmount, tokenAmount, currentTime) = market.getReserves();
    }

    function getMarketTokenAddresses(address _market)
        public
        view
        override
        returns (address token, address xyt)
    {
        require(address(_market) != address(0), "Pendle: market not found");

        IPendleMarket benmarkMarket = IPendleMarket(_market);
        token = benmarkMarket.token();
        xyt = benmarkMarket.xyt();
    }

    // function _isMarketLocked(address _xyt) internal pure returns (bool isLocked){
    //     // To implement
    //     isLocked = false; // never locked
    // }

    /// @dev Inbound transfer from msg.sender to router
    function _transferIn(address _token, uint256 _amount) internal {
        if (_amount == 0) return;
        if (_isETH(_token)) {
            require(msg.value == _amount, "Pendle: eth sent mismatch");
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
            require(success, "Pendle: transfer failed");
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
            .mul(Math.FORMULA_PRECISION)
            .div(tokenWeightOut.add(tokenWeightIn))
            .mul(tokenBalanceOut)
            .div(Math.FORMULA_PRECISION);

        return effectiveLiquidity;
    }

    function _isETH(address token) internal pure returns (bool) {
        return (token == ETH_ADDRESS);
    }
}
