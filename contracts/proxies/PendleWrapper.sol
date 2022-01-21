// solhint-disable var-name-mixedcase
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
pragma abicoder v2;
import "../libraries/PendleStructs.sol";
import "../libraries/TokenUtilsLib.sol";
import "../interfaces/IWETH.sol";
import "../interfaces/IPendleMarket.sol";
import "../periphery/WithdrawableV2.sol";
import "../interfaces/IPendleForge.sol";
import "../interfaces/IUniswapV2Router02.sol";
import "../interfaces/IPendleYieldToken.sol";
import "../interfaces/IDMMLiquidityRouter.sol";
import "../interfaces/IPendleLiquidityMining.sol";
import "../interfaces/IPendleLiquidityMiningV2.sol";
import "../interfaces/ICToken.sol";
import "../interfaces/IJoeBar.sol";
import "../interfaces/IWMEMO.sol";
import "../interfaces/ITimeStaking.sol";
import "./ICEther.sol";
import "../libraries/UniswapV2Lib.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/proxy/ProxyAdmin.sol"; // added for hardhat to generate typechains
import "@openzeppelin/contracts/proxy/TransparentUpgradeableProxy.sol"; // added for hardhat to generate typechains

enum Mode {
    BENQI,
    JOE,
    xJOE,
    WONDERLAND
}

struct Approval {
    address token;
    address to;
}

struct DataTknzSingle {
    address token;
    uint256 amount;
}

struct PairTokenAmount {
    address token;
    uint256 amount;
}

struct DataTknz {
    DataTknzSingle single;
    DataAddLiqJoe double;
    address forge;
    uint256 expiryYT;
}

struct DataYO {
    address OT;
    address YT;
    uint256 amountYO;
}

struct DataAddLiqOT {
    address baseToken;
    uint256 amountTokenDesired;
    uint256 amountTokenMin;
    uint256 deadline;
    address liqMiningAddr;
}

struct DataAddLiqYT {
    address baseToken;
    uint256 amountTokenDesired;
    uint256 amountTokenMin;
    bytes32 marketFactoryId;
    address liqMiningAddr;
}

struct DataAddLiqJoe {
    address tokenA;
    address tokenB;
    uint256 amountADesired;
    uint256 amountBDesired;
    uint256 amountAMin;
    uint256 amountBMin;
    uint256 deadline;
}

struct ConstructorData {
    IPendleRouter pendleRouter;
    IUniswapV2Router02 joeRouter;
    IJoeBar joeBar;
    IWETH weth;
    IWMEMO wMEMO;
    ITimeStaking timeStaking;
    bytes32 codeHashJoe;
}

struct DataSwap {
    uint256 amountInMax;
    uint256 amountOut;
    address[] path;
}

struct DataPull {
    DataSwap[] swaps;
    PairTokenAmount[] pulls;
    uint256 deadline;
}

library SmartArrayUtils {
    function add(address[12] memory arr, address token) internal pure {
        if (token == address(0)) return;
        for (uint256 i = 0; i < arr.length; i++) {
            if (arr[i] == token || arr[i] == address(0)) {
                arr[i] = token;
                return;
            }
        }
        revert("TOKENS_LIMIT_EXCEEDED");
    }

    function add(address[12] memory arr, DataPull calldata data) internal pure {
        for (uint256 i = 0; i < data.pulls.length; i++) {
            add(arr, data.pulls[i].token);
        }
        for (uint256 i = 0; i < data.swaps.length; i++) {
            DataSwap memory swap = data.swaps[i];
            add(arr, swap.path[0]);
            add(arr, swap.path[swap.path.length - 1]);
        }
    }

    function add(address[12] memory arr, DataYO memory data) internal pure {
        add(arr, data.OT);
        add(arr, data.YT);
    }
}

library SwapHelper {
    using TokenUtils for IERC20;
    using SafeMath for uint256;
    address internal constant ETH_ADDRESS = address(0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE);

    modifier validateSingleSwap(DataSwap memory data) {
        uint256 len = data.path.length;
        require(len >= 2 && data.path[0] != data.path[len - 1], "INVALID_SWAP_PATH");
        require(data.amountInMax != 0, "ZERO_MAX_IN_AMOUNT");
        require(data.amountOut != 0, "ZERO_MAX_IN_AMOUNT");
        _;
    }

    function swapMultiPaths(
        IUniswapV2Router02 router,
        DataSwap[] calldata data,
        uint256 deadline,
        IWETH weth
    ) internal {
        for (uint256 i = 0; i < data.length; i++) {
            swapSinglePath(router, data[i], weth, deadline);
        }
    }

    function wethConversion(DataSwap calldata data, IWETH weth) internal returns (bool) {
        address[] calldata path = data.path;
        if (path.length == 2 && path[0] == ETH_ADDRESS && path[1] == address(weth)) {
            require(data.amountInMax == data.amountOut, "DIFF_AMOUNT_IN_OUT");
            weth.deposit{value: data.amountInMax}();
            return true;
        }
        if (path.length == 2 && path[0] == address(weth) && path[1] == ETH_ADDRESS) {
            require(data.amountInMax == data.amountOut, "DIFF_AMOUNT_IN_OUT");
            weth.withdraw(data.amountInMax);
            return true;
        }
        return false;
    }

    function swapSinglePath(
        IUniswapV2Router02 router,
        DataSwap calldata data,
        IWETH weth,
        uint256 deadline
    ) internal validateSingleSwap(data) {
        address[] memory path = data.path;
        if (wethConversion(data, weth)) {
            return;
        }
        if (!_isETH(data.path[0])) {
            IERC20(data.path[0]).infinityApprove(address(router));
        }
        if (_isETH(data.path[0])) {
            path[0] = address(weth);
            router.swapAVAXForExactTokens{value: data.amountInMax}(
                data.amountOut,
                path,
                address(this),
                deadline
            );
        } else if (_isETH(data.path[data.path.length - 1])) {
            path[path.length - 1] = address(weth);
            router.swapTokensForExactAVAX(
                data.amountOut,
                data.amountInMax,
                path,
                address(this),
                deadline
            );
        } else {
            // no ETH
            router.swapTokensForExactTokens(
                data.amountOut,
                data.amountInMax,
                path,
                address(this),
                deadline
            );
        }
    }

    function _isETH(address token) internal pure returns (bool) {
        return (token == ETH_ADDRESS);
    }
}

/**
- baseTokenForceZapThreshold: if the amount of baseToken left-over after Zapping is smaller
or equal to this threshold, all of them will be force-zap in. Else, if they are greater than the
threshold, they will be returned & nothing will happen
- force zapping in will work as follows:
    - if the zap action involves adding liquidity to YT pools, the left-over baseToken will be
    used to addMarketLiquiditySingle to the YT pools
    - if the zap action involves adding liquidity to OT pools (means YT is returned),
    the left-over baseToken will be used to swapExactIn to YT pool to buy YT
*/
contract PendleWrapper is ReentrancyGuard {
    using TokenUtils for IERC20;
    using SmartArrayUtils for address[12];
    using SwapHelper for IUniswapV2Router02;

    address public constant ETH_ADDRESS = address(0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE);

    bytes32 public immutable codeHashJoe;

    IUniswapV2Router02 public immutable joeRouter;
    IJoeBar public immutable joeBar;
    IWETH public immutable weth;
    IWMEMO public immutable wMEMO;
    IERC20 public immutable MEMO;
    ITimeStaking public immutable timeStaking;

    IPendleRouter public immutable pendleRouter;
    IPendleData public immutable pendleData;

    event SwapEventYT(
        address user,
        address inToken,
        address outToken,
        uint256 inAmount,
        uint256 outAmount
    );
    event MintYieldTokens(
        bytes32 forgeId,
        address indexed underlyingAsset,
        uint256 indexed expiry,
        uint256 amountToTokenize,
        uint256 amountTokenMinted,
        address indexed user
    );
    event AddLiquidityYT(
        address indexed sender,
        bytes32 marketFactoryId,
        address token0,
        address token1,
        uint256 token0Amount,
        uint256 token1Amount,
        uint256 exactOutLp
    );
    event AddLiquidityOT(
        address indexed sender,
        address token0,
        address token1,
        uint256 token0Amount,
        uint256 token1Amount,
        uint256 exactOutLp
    );
    event RawTokenToYTokenSingle(
        address indexed user,
        address rawAsset,
        address yieldBearingToken,
        uint256 amountIn,
        uint256 amountOut
    );
    event RawTokenToYTokenDouble(
        address indexed user,
        address token0,
        address token1,
        address lpToken,
        uint256 amountIn0,
        uint256 amountIn1,
        uint256 lpOut
    );

    constructor(ConstructorData memory _data) {
        pendleRouter = _data.pendleRouter;
        pendleData = _data.pendleRouter.data();
        joeRouter = _data.joeRouter;
        joeBar = _data.joeBar;
        weth = _data.weth;
        wMEMO = _data.wMEMO;
        MEMO = IERC20(_data.wMEMO.MEMO());
        timeStaking = _data.timeStaking;
        codeHashJoe = _data.codeHashJoe;
    }

    receive() external payable {}

    // start of Level 1 functions
    function insAddDualLiqForYT(
        Mode mode,
        DataPull calldata dataPull,
        DataTknz calldata dataTknz,
        DataAddLiqYT calldata dataAddYT,
        uint256 baseTokenForceZapThreshold
    )
        external
        payable
        nonReentrant
        returns (
            DataYO memory dataYO,
            uint256 lpOut,
            uint256 amountBaseTokenUsed
        )
    {
        address[12] memory arr;
        _pullAndSwap(arr, dataPull);

        dataYO = _insTokenize(mode, arr, address(this), dataTknz);

        (amountBaseTokenUsed, lpOut) = _addDualLiqYT(arr, dataYO, dataAddYT);

        _forceAddSingleLiqBaseTokenYT(dataYO, dataAddYT, baseTokenForceZapThreshold);

        _pushAll(arr);
    }

    function insAddSingleLiq(
        Mode mode,
        DataPull calldata dataPull,
        DataTknz calldata dataTknz,
        bytes32 marketFactoryId,
        address baseToken,
        uint256 minOutLp,
        address liqMiningAddr
    ) external payable nonReentrant returns (DataYO memory dataYO, uint256 lpOut) {
        address[12] memory arr;
        _pullAndSwap(arr, dataPull);

        dataYO = _insTokenize(mode, arr, address(this), dataTknz);

        lpOut = _addSingleLiqYT(arr, dataYO, marketFactoryId, baseToken, minOutLp, liqMiningAddr);

        _pushAll(arr);
    }

    /**
    @param marketToForceZap can be zero address if force zap is not necessary
     */
    function insAddDualLiqForOT(
        Mode mode,
        DataPull calldata dataPull,
        DataTknz calldata dataTknz,
        DataAddLiqOT calldata dataAddOT,
        uint256 baseTokenForceZapThreshold,
        IPendleMarket marketToForceZap
    )
        external
        payable
        nonReentrant
        returns (
            DataYO memory dataYO,
            uint256 lpOutOT,
            uint256 amountBaseTokenUsedOT
        )
    {
        address[12] memory arr;
        _pullAndSwap(arr, dataPull);

        dataYO = _insTokenize(mode, arr, address(this), dataTknz);

        (amountBaseTokenUsedOT, lpOutOT) = _addDualLiqOT(arr, dataYO, dataAddOT);

        if (address(marketToForceZap) != address(0)) {
            _forceBuyYT(marketToForceZap, baseTokenForceZapThreshold);
        }

        _pushAll(arr);
    }

    function insAddDualLiqForOTandYT(
        Mode mode,
        DataPull calldata dataPull,
        DataTknz calldata dataTknz,
        DataAddLiqOT calldata dataAddOT,
        DataAddLiqYT calldata dataAddYT,
        uint256 baseTokenForceZapThreshold
    )
        external
        payable
        nonReentrant
        returns (
            DataYO memory dataYO,
            uint256 lpOutOT,
            uint256 amountBaseTokenUsedOT,
            uint256 lpOutYT,
            uint256 amountBaseTokenUsedYT
        )
    {
        address[12] memory arr;
        _pullAndSwap(arr, dataPull);

        dataYO = _insTokenize(mode, arr, address(this), dataTknz);

        (amountBaseTokenUsedOT, lpOutOT) = _addDualLiqOT(arr, dataYO, dataAddOT);

        (amountBaseTokenUsedYT, lpOutYT) = _addDualLiqYT(arr, dataYO, dataAddYT);

        _forceAddSingleLiqBaseTokenYT(dataYO, dataAddYT, baseTokenForceZapThreshold);

        _pushAll(arr);
    }

    function insRealizeFutureYield(
        Mode mode,
        DataPull calldata dataPull,
        DataTknz calldata dataTknz,
        bytes32 marketFactoryId,
        address baseToken,
        uint256 minOutBaseTokenAmount
    ) external payable nonReentrant returns (DataYO memory dataYO, uint256 amountBaseTokenOut) {
        address[12] memory arr;
        _pullAndSwap(arr, dataPull);

        dataYO = _insTokenize(mode, arr, address(this), dataTknz);

        amountBaseTokenOut = _sellAllYT(
            dataYO,
            arr,
            marketFactoryId,
            baseToken,
            minOutBaseTokenAmount
        );

        _pushAll(arr);
    }

    function insTokenize(
        Mode mode,
        DataPull calldata dataPull,
        DataTknz calldata dataTknz
    ) external payable nonReentrant returns (DataYO memory dataYO) {
        address[12] memory arr;
        _pullAndSwap(arr, dataPull);

        dataYO = _insTokenize(mode, arr, msg.sender, dataTknz);

        _pushAll(arr);
    }

    function insSwap(DataPull calldata dataPull) external payable nonReentrant {
        address[12] memory arr;
        _pullAndSwap(arr, dataPull);
        _pushAll(arr);
    }

    // end of Level-1 functions

    function infinityApprove(Approval[] calldata approvals) public {
        for (uint256 i = 0; i < approvals.length; i++)
            IERC20(approvals[i].token).infinityApprove(approvals[i].to);
    }

    // start of Level-2 functions
    function _pullAndSwap(address[12] memory arr, DataPull calldata dataPull) internal {
        _pullToken(dataPull, arr);
        joeRouter.swapMultiPaths(dataPull.swaps, dataPull.deadline, weth);
    }

    function _insTokenize(
        Mode mode,
        address[12] memory arr,
        address to,
        DataTknz calldata data
    ) internal returns (DataYO memory dataYO) {
        uint256 amountToTokenize = _rawTokenToYToken(mode, data);
        bytes32 forgeId = IPendleForge(data.forge).forgeId();
        address underlyingAsset = _getUnderlyingAsset(mode, data);
        if (_isETH(underlyingAsset)) {
            underlyingAsset = address(weth);
        }

        (dataYO.OT, dataYO.YT, dataYO.amountYO) = pendleRouter.tokenizeYield(
            forgeId,
            underlyingAsset,
            data.expiryYT,
            amountToTokenize,
            to
        );

        arr.add(dataYO);

        emit MintYieldTokens(
            forgeId,
            underlyingAsset,
            data.expiryYT,
            amountToTokenize,
            dataYO.amountYO,
            msg.sender
        );
    }

    function _addDualLiqOT(
        address[12] memory,
        DataYO memory dataYO,
        DataAddLiqOT calldata data
    ) internal returns (uint256 lpOut, uint256 amountBaseTokenUsed) {
        bool addToLiqMining = data.liqMiningAddr != address(0);
        address lpReceiver = addToLiqMining ? address(this) : msg.sender;

        (, amountBaseTokenUsed, lpOut) = _addDualLiqJoe(
            lpReceiver,
            DataAddLiqJoe(
                dataYO.OT,
                data.baseToken,
                dataYO.amountYO,
                data.amountTokenDesired,
                dataYO.amountYO,
                data.amountTokenMin,
                data.deadline
            )
        );

        if (addToLiqMining) _addToOTLiqMiningContract(data.liqMiningAddr, lpOut);
        // the LP is either sent directly to the user or add to liqMining

        emit AddLiquidityOT(
            msg.sender,
            dataYO.OT,
            data.baseToken,
            dataYO.amountYO,
            amountBaseTokenUsed,
            lpOut
        );
    }

    function _addDualLiqYT(
        address[12] memory arr,
        DataYO memory dataYO,
        DataAddLiqYT calldata data
    ) internal returns (uint256 amountBaseTokenUsed, uint256 lpOut) {
        bool addToLiqMining = data.liqMiningAddr != address(0);

        (, amountBaseTokenUsed, lpOut) = pendleRouter.addMarketLiquidityDual{
            value: (_isETH(data.baseToken) ? data.amountTokenDesired : 0)
        }(
            data.marketFactoryId,
            dataYO.YT,
            data.baseToken,
            dataYO.amountYO,
            data.amountTokenDesired,
            dataYO.amountYO,
            data.amountTokenMin
        );

        if (addToLiqMining) {
            _addToYTLiqMiningContract(
                data.liqMiningAddr,
                IPendleYieldToken(dataYO.YT).expiry(),
                lpOut
            );
        } else {
            arr.add(_getPendleLp(data.marketFactoryId, data.baseToken, dataYO.YT));
        }

        emit AddLiquidityYT(
            msg.sender,
            data.marketFactoryId,
            dataYO.YT,
            data.baseToken,
            dataYO.amountYO,
            data.amountTokenDesired,
            lpOut
        );
    }

    function _addSingleLiqYT(
        address[12] memory arr,
        DataYO memory dataYO,
        bytes32 marketFactoryId,
        address baseToken,
        uint256 minOutLp,
        address liqMiningAddr
    ) internal returns (uint256 lpOut) {
        // no need to pull anything

        bool addToLiqMining = liqMiningAddr != address(0);

        lpOut = pendleRouter.addMarketLiquiditySingle(
            marketFactoryId,
            dataYO.YT,
            baseToken,
            true,
            dataYO.amountYO,
            minOutLp
        );

        if (addToLiqMining) {
            _addToYTLiqMiningContract(liqMiningAddr, IPendleYieldToken(dataYO.YT).expiry(), lpOut);
        } else {
            arr.add(_getPendleLp(marketFactoryId, baseToken, dataYO.YT));
        }

        emit AddLiquidityYT(
            msg.sender,
            marketFactoryId,
            dataYO.YT,
            baseToken,
            dataYO.amountYO,
            0,
            lpOut
        );
    }

    function _sellAllYT(
        DataYO memory dataYO,
        address[12] memory arr,
        bytes32 marketFactoryId,
        address baseToken,
        uint256 minOutBaseTokenAmount
    ) internal returns (uint256 amountBaseTokenOut) {
        amountBaseTokenOut = pendleRouter.swapExactIn(
            dataYO.YT,
            baseToken,
            dataYO.amountYO,
            minOutBaseTokenAmount,
            marketFactoryId
        );

        arr.add(baseToken);

        emit SwapEventYT(msg.sender, dataYO.YT, baseToken, dataYO.amountYO, amountBaseTokenOut);
    }

    function _forceAddSingleLiqBaseTokenYT(
        DataYO memory dataYO,
        DataAddLiqYT calldata dataAddYT,
        uint256 baseTokenForceZapThreshold
    ) internal returns (uint256 lpOut) {
        uint256 amountToAdd = _selfBalanceOf(dataAddYT.baseToken);
        if (amountToAdd > baseTokenForceZapThreshold || amountToAdd == 0) {
            return 0;
        }

        bool addToLiqMining = dataAddYT.liqMiningAddr != address(0);

        lpOut = pendleRouter.addMarketLiquiditySingle(
            dataAddYT.marketFactoryId,
            dataYO.YT,
            dataAddYT.baseToken,
            false,
            amountToAdd,
            0
        );

        if (addToLiqMining) {
            _addToYTLiqMiningContract(
                dataAddYT.liqMiningAddr,
                IPendleYieldToken(dataYO.YT).expiry(),
                lpOut
            );
        }

        // the LP must have already been included in the arr of tokens

        emit AddLiquidityYT(
            msg.sender,
            dataAddYT.marketFactoryId,
            dataYO.YT,
            dataAddYT.baseToken,
            0,
            amountToAdd,
            lpOut
        );
    }

    function _forceBuyYT(IPendleMarket market, uint256 baseTokenForceZapThreshold)
        internal
        returns (uint256 outAmount)
    {
        uint256 amountTokenToSwap = _selfBalanceOf(market.token());

        if (amountTokenToSwap > baseTokenForceZapThreshold || amountTokenToSwap == 0) {
            return 0;
        }
        outAmount = pendleRouter.swapExactIn(
            market.token(),
            market.xyt(),
            amountTokenToSwap,
            0,
            market.factoryId()
        );
        emit SwapEventYT(msg.sender, market.token(), market.xyt(), amountTokenToSwap, outAmount);
    }

    // end of Level-2 functions

    function _rawTokenToYToken(Mode mode, DataTknz calldata data)
        internal
        returns (uint256 amountYTokenReceived)
    {
        if (mode == Mode.BENQI) amountYTokenReceived = _rawTokenToYTokenBenQi(data);
        else if (mode == Mode.xJOE) amountYTokenReceived = _rawTokenToYTokenXJoe(data);
        else if (mode == Mode.WONDERLAND) amountYTokenReceived = _rawTokenToYTokenWonderland(data);
        else (, , amountYTokenReceived) = _rawTokenToYTokenJoe(address(this), data.double);
    }

    function _rawTokenToYTokenBenQi(DataTknz calldata data)
        internal
        returns (uint256 amountYTokenReceived)
    {
        (address token, uint256 amount) = (data.single.token, data.single.amount);
        address cToken;
        if (_isETH(token)) {
            cToken = IPendleForge(data.forge).getYieldBearingToken(address(weth));
            ICEther(cToken).mint{value: amount}();
        } else {
            cToken = IPendleForge(data.forge).getYieldBearingToken(token);
            ICToken(cToken).mint(amount);
        }
        amountYTokenReceived = _selfBalanceOf(cToken);
        emit RawTokenToYTokenSingle(msg.sender, token, cToken, amount, amountYTokenReceived);
    }

    function _rawTokenToYTokenXJoe(DataTknz calldata data)
        internal
        returns (uint256 amountYTokenReceived)
    {
        joeBar.enter(data.single.amount);
        amountYTokenReceived = _selfBalanceOf(address(joeBar));
        emit RawTokenToYTokenSingle(
            msg.sender,
            data.single.token,
            address(joeBar),
            data.single.amount,
            amountYTokenReceived
        );
    }

    function _rawTokenToYTokenWonderland(DataTknz calldata data)
        internal
        returns (uint256 amountYTokenReceived)
    {
        if (data.single.token != address(MEMO)) {
            // if it's not MEMO, for sure it's TIME
            require(timeStaking.warmupPeriod() == 0, "WARMUP_PERIOD_NOT_ZERO");
            timeStaking.stake(data.single.amount, address(this));
            timeStaking.claim(address(this));
        }

        // MEMO is only used in this function, so we can use the entire balance of MEMO
        wMEMO.wrap(_selfBalanceOf(address(MEMO)));

        amountYTokenReceived = _selfBalanceOf(address(wMEMO));
        emit RawTokenToYTokenSingle(
            msg.sender,
            data.single.token,
            address(wMEMO),
            data.single.amount,
            amountYTokenReceived
        );
    }

    function _rawTokenToYTokenJoe(address to, DataAddLiqJoe memory data)
        internal
        returns (
            uint256 amountA,
            uint256 amountB,
            uint256 lpOut
        )
    {
        address pool = _getJoePool(data);
        (amountA, amountB, lpOut) = _addDualLiqJoe(to, data);
        emit RawTokenToYTokenDouble(
            msg.sender,
            data.tokenA,
            data.tokenB,
            pool,
            amountA,
            amountB,
            lpOut
        );
    }

    function _addDualLiqJoe(address to, DataAddLiqJoe memory data)
        internal
        returns (
            uint256 amountA,
            uint256 amountB,
            uint256 lpOut
        )
    {
        bool swapped = false;
        if (_isETH(data.tokenB)) {
            swapped = true;
            _swapTokenABData(data);
        }

        // if one of the two tokens is ETH, it will always be tokenA
        if (_isETH(data.tokenA)) {
            // amountToken, amountETH, liquidity
            (amountB, amountA, lpOut) = joeRouter.addLiquidityAVAX{value: data.amountADesired}(
                data.tokenB,
                data.amountBDesired,
                data.amountBMin,
                data.amountAMin,
                to,
                data.deadline
            );
        } else {
            (amountA, amountB, lpOut) = joeRouter.addLiquidity(
                data.tokenA,
                data.tokenB,
                data.amountADesired,
                data.amountBDesired,
                data.amountAMin,
                data.amountBMin,
                to,
                data.deadline
            );
        }

        if (swapped) {
            (amountA, amountB) = (amountB, amountA);
            _swapTokenABData(data);
        }
    }

    function _addToYTLiqMiningContract(
        address liqAddr,
        uint256 expiry,
        uint256 lpAmount
    ) internal {
        IPendleLiquidityMining(liqAddr).stakeFor(msg.sender, expiry, lpAmount);
    }

    function _addToOTLiqMiningContract(address liqAddr, uint256 lpAmount) internal {
        IPendleLiquidityMiningV2(liqAddr).stake(msg.sender, lpAmount);
    }

    function _pullToken(DataPull calldata data, address[12] memory arr) internal {
        arr.add(data);

        uint256 totalEthAmount = 0;
        for (uint256 i = 0; i < data.pulls.length; i++) {
            PairTokenAmount memory pair = data.pulls[i];
            if (_isETH(pair.token)) {
                totalEthAmount += pair.amount;
            } else {
                IERC20(pair.token).safeTransferFrom(msg.sender, address(this), pair.amount);
            }
        }
        for (uint256 i = 0; i < data.swaps.length; i++) {
            DataSwap memory swap = data.swaps[i];
            if (_isETH(swap.path[0])) {
                totalEthAmount += swap.amountInMax;
            } else {
                IERC20(swap.path[0]).safeTransferFrom(msg.sender, address(this), swap.amountInMax);
            }
        }
        require(totalEthAmount <= _selfBalanceOf(ETH_ADDRESS), "INSUFFICIENT_ETH_AMOUNT");
    }

    function _pushAll(address[12] memory arr) internal {
        for (uint256 i = 0; i < arr.length; i++) {
            if (arr[i] == address(0)) break;
            if (_isETH(arr[i])) {
                (bool success, ) = msg.sender.call{value: _selfBalanceOf(arr[i])}("");
                require(success, "TRANSFER_FAILED");
            } else {
                IERC20(arr[i]).safeTransfer(msg.sender, _selfBalanceOf(arr[i]));
            }
        }
    }

    function _getPendleLp(
        bytes32 marketFactoryId,
        address baseToken,
        address YT
    ) internal view returns (address) {
        return
            pendleData.getMarket(
                marketFactoryId,
                YT,
                _isETH(baseToken) ? address(weth) : baseToken
            );
    }

    function _selfBalanceOf(address token) internal view returns (uint256) {
        if (_isETH(token)) return address(this).balance;
        return IERC20(token).balanceOf(address(this));
    }

    function _getUnderlyingAsset(Mode mode, DataTknz memory data) internal view returns (address) {
        if (mode == Mode.JOE) {
            return _getJoePool(data.double);
        }
        if (mode == Mode.WONDERLAND) {
            return address(MEMO);
        }
        return data.single.token;
    }

    function _getJoePool(DataAddLiqJoe memory data) internal view returns (address) {
        (address tokenA, address tokenB) = (data.tokenA, data.tokenB);
        return
            UniswapV2Library.pairFor(
                joeRouter.factory(),
                (_isETH(tokenA) ? address(weth) : tokenA),
                (_isETH(tokenB) ? address(weth) : tokenB),
                codeHashJoe
            );
    }

    function _swapTokenABData(DataAddLiqJoe memory data) internal pure {
        (data.tokenA, data.tokenB) = (data.tokenB, data.tokenA);
        (data.amountADesired, data.amountBDesired) = (data.amountBDesired, data.amountADesired);
        (data.amountAMin, data.amountBMin) = (data.amountBMin, data.amountAMin);
    }

    function _isETH(address token) internal pure returns (bool) {
        return (token == ETH_ADDRESS);
    }
}
