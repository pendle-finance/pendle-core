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
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import {Factory, Utils} from "../libraries/PendleLibrary.sol";
import "../interfaces/IAaveLendingPoolCore.sol";
import "../interfaces/IPendleBaseToken.sol";
import "../interfaces/IPendleData.sol";
import "../interfaces/IPendleForge.sol";
import "../tokens/PendleFutureYieldToken.sol";
import "../tokens/PendleOwnershipToken.sol";
import "hardhat/console.sol";

contract PendleAaveForge is IPendleForge, ReentrancyGuard {
    using SafeMath for uint256;
    using Utils for string;

    struct PendleTokens {
        IPendleYieldToken xyt;
        IPendleYieldToken ot;
    }

    IPendle public immutable override core;
    IAaveLendingPoolCore public immutable aaveLendingPoolCore;
    bytes32 public immutable override forgeId;

    mapping(address => mapping(uint256 => uint256)) public lastNormalisedIncomeBeforeExpiry;
    mapping(address => mapping(uint256 => mapping(address => uint256)))
        public lastNormalisedIncome; //lastNormalisedIncome[underlyingAsset][expiry][account]

    string private constant OT = "OT-Aave";
    string private constant XYT = "XYT-Aave";

    constructor(
        IPendle _core,
        IAaveLendingPoolCore _aaveLendingPoolCore,
        bytes32 _forgeId
    ) {
        require(address(_core) != address(0), "Pendle: zero address");
        require(address(_aaveLendingPoolCore) != address(0), "Pendle: zero address");
        require(_forgeId != 0x0, "Pendle: zero bytes");

        core = _core;
        aaveLendingPoolCore = _aaveLendingPoolCore;
        forgeId = _forgeId;
    }

    modifier onlyCore() {
        require(msg.sender == address(core), "Pendle: only core");
        _;
    }

    modifier onlyXYT(address _underlyingAsset, uint256 _expiry) {
        IPendleData data = core.data();
        require(
            msg.sender == address(data.xytTokens(forgeId, _underlyingAsset, _expiry)),
            "Pendle: only XYT"
        );
        _;
    }

    function newYieldContracts(address _underlyingAsset, uint256 _expiry)
        public
        override
        returns (address ot, address xyt)
    {
        address aToken = aaveLendingPoolCore.getReserveATokenAddress(_underlyingAsset);
        uint8 aTokenDecimals = IPendleBaseToken(aToken).decimals();

        string memory otName = OT.concat(IPendleBaseToken(aToken).name(), " ");
        string memory otSymbol = OT.concat(IPendleBaseToken(aToken).symbol(), "-");
        string memory xytName = XYT.concat(IPendleBaseToken(aToken).name(), " ");
        string memory xytSymbol = XYT.concat(IPendleBaseToken(aToken).symbol(), "-");

        ot = _forgeOwnershipToken(
            _underlyingAsset,
            otName.concat(_expiry, " "),
            otSymbol.concat(_expiry, "-"),
            aTokenDecimals,
            _expiry
        );
        xyt = _forgeFutureYieldToken(
            _underlyingAsset,
            ot,
            xytName.concat(_expiry, " "),
            xytSymbol.concat(_expiry, "-"),
            aTokenDecimals,
            _expiry
        );

        IPendleData data = core.data();
        data.storeTokens(forgeId, ot, xyt, _underlyingAsset, _expiry);

        emit NewYieldContracts(forgeId, _underlyingAsset, _expiry, ot, xyt);
    }

    function redeemDueInterests(
        address _msgSender,
        address _underlyingAsset,
        uint256 _expiry
    ) public override returns (uint256 interests) {
        PendleTokens memory tokens = _getTokens(_underlyingAsset, _expiry);
        return _settleDueInterests(tokens, _underlyingAsset, _expiry, _msgSender);
    }

    function redeemDueInterestsBeforeTransfer(
        address _underlyingAsset,
        uint256 _expiry,
        address _account
    ) public override onlyXYT(_underlyingAsset, _expiry) returns (uint256 interests) {
        // console.log("[contract] [Forge] Redeeming due interests for account ", _account);
        PendleTokens memory tokens = _getTokens(_underlyingAsset, _expiry);
        return _settleDueInterests(tokens, _underlyingAsset, _expiry, _account);
    }

    function redeemAfterExpiry(
        address _msgSender,
        address _underlyingAsset,
        uint256 _expiry,
        address _to
    ) public override returns (uint256 redeemedAmount) {
        require(block.timestamp > _expiry, "Pendle: must be after expiry");

        IERC20 aToken = IERC20(aaveLendingPoolCore.getReserveATokenAddress(_underlyingAsset));
        PendleTokens memory tokens = _getTokens(_underlyingAsset, _expiry);
        redeemedAmount = tokens.ot.balanceOf(_msgSender);

        aToken.transfer(_to, redeemedAmount);
        uint256 currentNormalizedIncome =
            aaveLendingPoolCore.getReserveNormalizedIncome(_underlyingAsset);

        // interests from the timestamp of the last XYT transfer (before expiry) to now is entitled to the OT holders
        // this means that the OT holders are getting some extra interests, at the expense of XYT holders
        uint256 interestsAfterExpiry =
            currentNormalizedIncome
                .mul(redeemedAmount)
                .div(lastNormalisedIncomeBeforeExpiry[_underlyingAsset][_expiry])
                .sub(redeemedAmount);
        aToken.transfer(_to, interestsAfterExpiry);

        _settleDueInterests(tokens, _underlyingAsset, _expiry, _msgSender);
        tokens.ot.burn(_msgSender, redeemedAmount);

        emit RedeemYieldToken(forgeId, _underlyingAsset, _expiry, redeemedAmount);
    }

    // msg.sender needs to have both OT and XYT tokens
    function redeemUnderlying(
        address _msgSender,
        address _underlyingAsset,
        uint256 _expiry,
        uint256 _amountToRedeem,
        address _to
    ) public override returns (uint256 redeemedAmount) {
        PendleTokens memory tokens = _getTokens(_underlyingAsset, _expiry);

        require(tokens.ot.balanceOf(_msgSender) >= _amountToRedeem, "Must have enough OT tokens");
        require(
            tokens.xyt.balanceOf(_msgSender) >= _amountToRedeem,
            "Must have enough XYT tokens"
        );

        IERC20 aToken = IERC20(aaveLendingPoolCore.getReserveATokenAddress(_underlyingAsset));

        aToken.transfer(_to, _amountToRedeem);

        _settleDueInterests(tokens, _underlyingAsset, _expiry, _msgSender);

        tokens.ot.burn(_msgSender, _amountToRedeem);
        tokens.xyt.burn(_msgSender, _amountToRedeem);

        emit RedeemYieldToken(forgeId, _underlyingAsset, _expiry, _amountToRedeem);
        return _amountToRedeem;
    }

    function tokenizeYield(
        address _msgSender,
        address _underlyingAsset,
        uint256 _expiry,
        uint256 _amountToTokenize,
        address _to
    ) public override onlyCore returns (address ot, address xyt) {
        PendleTokens memory tokens = _getTokens(_underlyingAsset, _expiry);

        IERC20 aToken = IERC20(aaveLendingPoolCore.getReserveATokenAddress(_underlyingAsset));
        aToken.transferFrom(_msgSender, address(this), _amountToTokenize);

        tokens.ot.mint(_to, _amountToTokenize);
        tokens.xyt.mint(_to, _amountToTokenize);
        lastNormalisedIncome[_underlyingAsset][_expiry][_to] = aaveLendingPoolCore
            .getReserveNormalizedIncome(address(_underlyingAsset));

        emit MintYieldToken(forgeId, _underlyingAsset, _expiry, _amountToTokenize);
        return (address(tokens.ot), address(tokens.xyt));
    }

    function _forgeFutureYieldToken(
        address _underlyingAsset,
        address _ot,
        string memory _name,
        string memory _symbol,
        uint8 _decimals,
        uint256 _expiry
    ) internal nonReentrant() returns (address xyt) {
        IERC20 aToken = IERC20(aaveLendingPoolCore.getReserveATokenAddress(_underlyingAsset));

        xyt = Factory.createContract(
            type(PendleFutureYieldToken).creationCode,
            abi.encodePacked(aToken, _underlyingAsset),
            abi.encode(
                _ot,
                _underlyingAsset,
                aToken,
                _name,
                _symbol,
                _decimals,
                block.timestamp,
                _expiry
            )
        );
    }

    function _forgeOwnershipToken(
        address _underlyingAsset,
        string memory _name,
        string memory _symbol,
        uint8 _decimals,
        uint256 _expiry
    ) internal nonReentrant() returns (address ot) {
        IERC20 aToken = IERC20(aaveLendingPoolCore.getReserveATokenAddress(_underlyingAsset));

        ot = Factory.createContract(
            type(PendleOwnershipToken).creationCode,
            abi.encodePacked(aToken, _underlyingAsset),
            abi.encode(
                aToken,
                _underlyingAsset,
                _name,
                _symbol,
                _decimals,
                block.timestamp,
                _expiry
            )
        );
    }

    function _settleDueInterests(
        PendleTokens memory _tokens,
        address _underlyingAsset,
        uint256 _expiry,
        address _account
    ) internal returns (uint256) {
        uint256 principal = _tokens.xyt.balanceOf(_account);
        uint256 ix = lastNormalisedIncome[_underlyingAsset][_expiry][_account];

        uint256 normalizedIncome;

        if (block.timestamp >= _expiry) {
            normalizedIncome = lastNormalisedIncomeBeforeExpiry[_underlyingAsset][_expiry];
        } else {
            normalizedIncome = aaveLendingPoolCore.getReserveNormalizedIncome(_underlyingAsset);
            lastNormalisedIncomeBeforeExpiry[_underlyingAsset][_expiry] = normalizedIncome;
        }
        // first time getting XYT
        if (ix == 0) {
            lastNormalisedIncome[_underlyingAsset][_expiry][_account] = normalizedIncome;
            return 0;
        }
        lastNormalisedIncome[_underlyingAsset][_expiry][_account] = normalizedIncome;

        uint256 dueInterests = principal.mul(normalizedIncome).div(ix).sub(principal);

        if (dueInterests > 0) {
            IERC20 aToken = IERC20(aaveLendingPoolCore.getReserveATokenAddress(_underlyingAsset));
            IERC20(aToken).transfer(_account, dueInterests);

            emit DueInterestSettled(forgeId, _underlyingAsset, _expiry, dueInterests, _account);
        }

        // console.log("[contract] [Forge] in _settleDueInterests, interests = ", dueInterests);
        return dueInterests;
    }

    function _getTokens(address _underlyingAsset, uint256 _expiry)
        internal
        view
        returns (PendleTokens memory _tokens)
    {
        IPendleData data = core.data();
        (_tokens.ot, _tokens.xyt) = data.getPendleYieldTokens(forgeId, _underlyingAsset, _expiry);
    }
}
