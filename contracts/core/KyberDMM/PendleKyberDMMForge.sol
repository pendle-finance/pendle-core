// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.7.6;
pragma abicoder v2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../../interfaces/IDMMFactory.sol";
import "../../interfaces/IDMMPool.sol";
import "../UniswapV2/PendleUniswapV2Forge.sol";

contract PendleKyberDMMForge is PendleUniswapV2Forge {
    using SafeMath for uint256;
    using Math for uint256;

    IDMMFactory public immutable kyberDMMFactory;

    constructor(
        address _governanceManager,
        IPendleRouter _router,
        bytes32 _forgeId,
        address _rewardToken,
        address _rewardManager,
        address _yieldContractDeployer,
        address _kyberDMMFactory
    )
        PendleUniswapV2Forge(
            _governanceManager,
            _router,
            _forgeId,
            _rewardToken,
            _rewardManager,
            _yieldContractDeployer,
            0x0,
            address(0)
        )
    {
        kyberDMMFactory = IDMMFactory(_kyberDMMFactory);
    }

    function verifyToken(address _underlyingAsset, uint256[] calldata _tokenInfo)
        public
        virtual
        override
    {
        require(
            _tokenInfo.length == 1 && address(_tokenInfo[0]) == _underlyingAsset,
            "INVALID_TOKEN_INFO"
        );

        IDMMPool pool = IDMMPool(_underlyingAsset);
        require(
            kyberDMMFactory.isPool(pool.token0(), pool.token1(), _underlyingAsset),
            "INVALID_TOKEN_ADDR"
        );
    }

    /**
     * @dev This function uses KyberDMM's vReserve01 instead of reserve01
     */
    function getExchangeRate(address _underlyingAsset)
        public
        virtual
        override
        returns (uint256 rate)
    {
        IDMMPool pool = IDMMPool(_underlyingAsset);
        (, , uint256 vReserve0, uint256 vReserve1, ) = pool.getTradeInfo();
        uint256 currentK = Math.sqrt(vReserve0.mul(vReserve1));
        uint256 totalSupply = pool.totalSupply();
        rate = Math.max(currentK.rdiv(totalSupply), lastRateForUnderlyingAsset[_underlyingAsset]);
        lastRateForUnderlyingAsset[_underlyingAsset] = rate;
    }
}
