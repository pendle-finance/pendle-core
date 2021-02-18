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
import "../interfaces/ICERC20.sol";
import "../interfaces/IPendleBaseToken.sol";
import "../interfaces/IPendleData.sol";
import "../interfaces/IPendleForge.sol";
import "../periphery/Permissions.sol";
import "../tokens/PendleFutureYieldToken.sol";
import "../tokens/PendleOwnershipToken.sol";
import "hardhat/console.sol";

contract PendleCompoundForge is IPendleForge, ReentrancyGuard, Permissions {
    using SafeMath for uint256;
    using Utils for string;

    struct PendleTokens {
        IPendleYieldToken xyt;
        IPendleYieldToken ot;
    }

    IPendle public immutable override core;
    bytes32 public immutable override forgeId;
    ICompound public immutable compound;

    mapping(address => ICERC20) public underlyingToCToken;
    mapping(address => mapping(uint256 => uint256)) public lastUnderlyingBeforeExpiry;
    mapping(address => mapping(uint256 => uint256)) public lastIncomeBeforeExpiry;
    mapping(address => mapping(uint256 => mapping(address => uint256))) public lastUnderlying //lastUnderlying[underlyingAsset][expiry][account]
    mapping(address => mapping(uint256 => mapping(address => uint256))) public lastIncome; //lastIncome[underlyingAsset][expiry][account]

    string private constant OT = "OT-Compound";
    string private constant XYT = "XYT-Compound";

    constructor(
        address _governance,
        IPendle _core,
        bytes32 _forgeId
    ) Permissions(_governance) {
        require(address(_core) != address(0), "Pendle: zero address");
        require(_forgeId != 0x0, "Pendle: zero bytes");

        core = _core;
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

    function registerToken(address _underlyingAsset, address _cToken) external onlyGovernance {
        underlyingToCToken[_underlyingAsset] = ICERC20(_cToken);
    }

    function newYieldContracts(address _underlyingAsset, uint256 _expiry)
        public
        override
        returns (address ot, address xyt)
    {
        address cToken = address(underlyingToCToken[_underlyingAsset]);
        uint8 cTokenDecimals = IPendleBaseToken(cToken).decimals();

        string memory otName = OT.concat(IPendleBaseToken(cToken).name(), " ");
        string memory otSymbol = OT.concat(IPendleBaseToken(cToken).symbol(), "-");
        string memory xytName = XYT.concat(IPendleBaseToken(cToken).name(), " ");
        string memory xytSymbol = XYT.concat(IPendleBaseToken(cToken).symbol(), "-");

        ot = _forgeOwnershipToken(
            _underlyingAsset,
            otName.concat(_expiry, " "),
            otSymbol.concat(_expiry, "-"),
            cTokenDecimals,
            _expiry
        );
        xyt = _forgeFutureYieldToken(
            _underlyingAsset,
            ot,
            xytName.concat(_expiry, " "),
            xytSymbol.concat(_expiry, "-"),
            cTokenDecimals,
            _expiry
        );

        IPendleData data = core.data();
        data.storeTokens(forgeId, ot, xyt, _underlyingAsset, _expiry);

        emit NewYieldContracts(ot, xyt, _expiry);
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
        return 0;
    }

    function redeemAfterExpiry(
        address _msgSender,
        address _underlyingAsset,
        uint256 _expiry,
        address _to
    ) public override returns (uint256 redeemedAmount) {
        require(block.timestamp > _expiry, "Pendle: must be after expiry");

        ICERC20 cToken = underlyingToCToken[_underlyingAsset];
        PendleTokens memory tokens = _getTokens(_underlyingAsset, _expiry);
        redeemedAmount = tokens.ot.balanceOf(_msgSender);

        cToken.transfer(_to, redeemedAmount);
        uint256 currentIncome =
            cToken.UnderlyingCurrent().sub(
                lastUnderlyingBeforeExpiry[_underlyingAsset][_expiry]
            );

        // interests from the timestamp of the last XYT transfer (before expiry) to now is entitled to the OT holders
        // this means that the OT holders are getting some extra interests, at the expense of XYT holders
        uint256 interestsAfterExpiry =
            currentIncome
                .mul(redeemedAmount)
                .div(lastIncomeBeforeExpiry[_underlyingAsset][_expiry])
                .sub(redeemedAmount);
        cToken.transfer(_to, interestsAfterExpiry);

        //_settleDueInterests(tokens, _underlyingAsset, _expiry, _msgSender);
        tokens.ot.burn(_msgSender, redeemedAmount);

        emit RedeemYieldToken(_underlyingAsset, redeemedAmount, _expiry);
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

        ICERC20 cToken = underlyingToCToken[_underlyingAsset];
        cToken.transfer(_to, _amountToRedeem);

        //_settleDueInterests(tokens, _underlyingAsset, _expiry, _msgSender);

        tokens.ot.burn(_msgSender, _amountToRedeem);
        tokens.xyt.burn(_msgSender, _amountToRedeem);

        emit RedeemYieldToken(_underlyingAsset, _amountToRedeem, _expiry);
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
        lastIncome[_underlyingAsset][_expiry][_to] = cToken.balanceOfUnderlying(address(this)).sub(lastUnderlying[_underlyingAsset][_expiry][_to]);

        ICERC20 cToken = underlyingToCToken[_underlyingAsset];
        cToken.transferFrom(_msgSender, address(this), _amountToTokenize);

        tokens.ot.mint(_to, _amountToTokenize);
        tokens.xyt.mint(_to, _amountToTokenize);
        lastUnderlying[_underlyingAsset][_expiry][_to] = cToken.balanceOfUnderlying(address(this));

        emit MintYieldToken(_underlyingAsset, _amountToTokenize, _expiry);
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
        ICERC20 cToken = underlyingToCToken[_underlyingAsset];

        xyt = Factory.createContract(
            type(PendleFutureYieldToken).creationCode,
            abi.encodePacked(cToken, _underlyingAsset),
            abi.encode(
                _ot,
                _underlyingAsset,
                cToken,
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
        ICERC20 cToken = underlyingToCToken[_underlyingAsset];

        ot = Factory.createContract(
            type(PendleOwnershipToken).creationCode,
            abi.encodePacked(cToken, _underlyingAsset),
            abi.encode(
                cToken,
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
        uint256 ix = lastIncome[_underlyingAsset][_expiry][_account];
        uint256 trx = lastUnderlying[_underlyingAsset][_expiry][_account];
        ICERC20 cToken = underlyingToCToken[_underlyingAsset];
        uint256 income;
        uint256 underlying;

        if (block.timestamp >= _expiry) {
            underlying = lastUnderlyingBeforeExpiry[_underlyingAsset][_expiry];
            income = lastIncomeBeforeExpiry[_underlyingAsset][_expiry];
        } else {
            underlying = cToken.balanceOfUnderlying(address(this));
            income = underlying.sub(lastUnderlyingBeforeExpiry[_underlyingAsset][_expiry]);
            lastIncomeBeforeExpiry[_underlyingAsset][_expiry] = income;
            lastUnderlyingBeforeExpiry[_underlyingAsset][_expiry] = underlying;
        }

        lastUnderlying[_underlyingAsset][_expiry][_account] = underlying;
        lastIncome[_underlyingAsset][_expiry][_account] = income;
        // first time getting XYT
        if (ix == 0) {
            return 0;
        }

        uint256 dueInterests = principal.mul(income).div(ix).sub(principal);

        if (dueInterests > 0) {
            cToken.transfer(_account, dueInterests);

            emit DueInterestSettled(_underlyingAsset, _account, dueInterests, _expiry);
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
