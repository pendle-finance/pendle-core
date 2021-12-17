// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.7.6;
pragma abicoder v2;

import "../../interfaces/IPendleRewardManagerMulti.sol";
import "../../interfaces/IPendleMasterChef.sol";
import "./PendleTraderJoeForge.sol";

contract PendleXJoeForge is PendleTraderJoeForge {
    using SafeMath for uint256;
    using Math for uint256;
    using TrioTokensLib for TrioTokens;

    // solhint-disable var-name-mixedcase
    IERC20 public immutable JOE;
    IERC20 public immutable xJOE;

    constructor(
        address _governanceManager,
        IPendleRouter _router,
        bytes32 _forgeId,
        IERC20 _JOE,
        IERC20 _xJOE,
        address _rewardManager,
        address _yieldContractDeployer
    )
        PendleTraderJoeForge(
            _governanceManager,
            _router,
            _forgeId,
            address(_JOE),
            _rewardManager,
            _yieldContractDeployer,
            0x0,
            address(0)
        )
    {
        JOE = _JOE;
        xJOE = _xJOE;
    }

    function verifyToken(address _underlyingAsset, uint256[] calldata _tokenInfo)
        public
        virtual
        override
    {
        require(_underlyingAsset == address(JOE), "NOT_JOE");
        require(_tokenInfo.length == 5, "INVALID_TOKEN_INFO");
        IPendleMasterChef masterChef = IPendleMasterChef(address(_tokenInfo[0]));
        uint256 pid = _tokenInfo[1];
        require(address(masterChef.poolInfo(pid).lpToken) == address(xJOE), "INVALID_TOKEN_INFO");
        TrioTokens(address(_tokenInfo[2]), address(_tokenInfo[3]), address(_tokenInfo[4])).verify();
    }

    function getExchangeRate(address _underlyingAsset)
        public
        virtual
        override
        returns (uint256 rate)
    {
        uint256 totalSupplyXJoe = xJOE.totalSupply();
        uint256 joeBalance = JOE.balanceOf(address(xJOE));
        rate = Math.max(
            joeBalance.rdiv(totalSupplyXJoe),
            lastRateForUnderlyingAsset[_underlyingAsset]
        );
        lastRateForUnderlyingAsset[_underlyingAsset] = rate;
    }

    /// @notice overriden because underlyingAsset of xJOE is not xJOE itself but is JOE
    function getYieldBearingToken(address)
        public
        view
        virtual
        override
        returns (address yieldBearingToken)
    {
        yieldBearingToken = address(xJOE);
    }
}
