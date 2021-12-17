// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;
pragma abicoder v2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";


interface IERC20Ext is IERC20 {
    function decimals() external view returns (uint8);

    function symbol() external view returns (string memory);
}

interface PendleYieldToken is IERC20Ext {
    function expiry() external view returns (uint256);
}

interface PendleLiquidityRewardsProxy {
    function redeemLiquidityRewards(
        address liqMiningContract,
        uint256[] calldata expiries,
        address user
    )
        external
        returns (
            uint256 rewards,
            uint256[] memory pendingRewards,
            uint256 currentEpoch
        );
}

interface PendleMarket is IERC20Ext {
    function expiry() external view returns (uint256);

    function getReserves()
        external
        view
        returns (
            uint256 xytBalance,
            uint256 xytWeight,
            uint256 tokenBalance,
            uint256 tokenWeight,
            uint256 currentBlock
        );

    function token() external view returns (address);

    function xyt() external view returns (address);
}

interface SushiSwapPool is IERC20Ext {
    function getReserves()
        external
        view
        returns (
            uint112 _reserve0,
            uint112 _reserve1,
            uint32 _blockTimestampLast
        );

    function token0() external view returns (address);

    function token1() external view returns (address);
}

interface PendleLiquidityMining {
    function allocationSettings(uint256 epochId, uint256 expiry) external view returns (uint256);

    function balances(address user) external view returns (uint256);

    function epochDuration() external view returns (uint256);

    function getBalances(uint256 expiry, address user) external view returns (uint256);

    function numberOfEpochs() external view returns (uint256);

    function readEpochData(uint256 epochId, address user)
        external
        view
        returns (
            uint256 totalStakeUnits,
            uint256 totalRewards,
            uint256 lastUpdated,
            uint256 stakeUnitsForUser,
            uint256 availableRewardsForUser
        );

    function readExpiryData(uint256 expiry)
        external
        view
        returns (
            uint256 totalStakeLP,
            uint256 lastNYield,
            uint256 paramL,
            address lpHolder
        );

    function startTime() external view returns (uint256);

    function latestSetting() external view returns (uint256 id, uint256 firstEpochToApply);

    function totalRewardsForEpoch(uint256 epochId) external view returns (uint256 rewards);
}

interface PendleSingleStaking {
    function balances(address account) external view returns (uint256);

    function totalSupply() external view returns (uint256);
}

interface PendleSingleStakingManager {
    function rewardPerBlock() external view returns (uint256);
}

contract PendlePoolsReadWrapper {
    using SafeMath for uint256;

    enum Type {
        PendleMarket,
        SushiSwapPool
    }

    struct Reserves {
        uint256 ytotBalance;
        uint256 ytotWeight;
        uint256 tokenBalance;
        uint256 tokenWeight;
    }

    function tokenApprove(
        IERC20Ext _token,
        address _staking,
        uint256 _allowance
    ) public {
        _token.approve(_staking, _allowance);
    }

    function claim(
        PendleLiquidityRewardsProxy _rewardsProxy,
        address _liqMiningContract,
        uint256[] calldata _expiries,
        address _user
    )
        public
        returns (
            uint256 rewards,
            uint256[] memory pendingRewards,
            uint256 currentEpoch
        )
    {
        (rewards, pendingRewards, currentEpoch) = _rewardsProxy.redeemLiquidityRewards(
            _liqMiningContract,
            _expiries,
            _user
        );
    }

    function getLiquidityMiningInfo(
        address _poolOrMarket,
        PendleLiquidityMining _staking,
        Type _type
    )
        public
        view
        returns (
            uint256 expiry,
            string memory marketSymbol,
            string memory tokenSymbol,
            uint256 lpTotalSupply,
            uint256 totalStakeLP,
            uint256 totalRewards,
            uint8 tokenDecimals,
            uint8 xytDecimals,
            Reserves memory reserves
        )
    {
        if (_type == Type.PendleMarket) {
            (tokenSymbol, tokenDecimals, xytDecimals, expiry) = _getYTTokenInfo(_poolOrMarket);
            reserves = _getYTReserves(_poolOrMarket);
            marketSymbol = PendleMarket(_poolOrMarket).symbol();
            lpTotalSupply = PendleMarket(_poolOrMarket).totalSupply();

            (totalStakeLP, , , ) = _staking.readExpiryData(expiry);
            (uint256 latestSettingId, ) = _staking.latestSetting();
            uint256 allocationSettings = _staking.allocationSettings(latestSettingId, expiry);
            uint256 currentEpoch = _epochOfTimestamp(block.timestamp, _staking);
            totalRewards =
                allocationSettings.mul(_staking.totalRewardsForEpoch(currentEpoch)) /
                1e9;
        } else if (_type == Type.SushiSwapPool) {
            (tokenSymbol, tokenDecimals, xytDecimals, expiry) = _getOTTokenInfo(_poolOrMarket);
            reserves = _getOTReserves(_poolOrMarket);
            marketSymbol = SushiSwapPool(_poolOrMarket).symbol();
            lpTotalSupply = SushiSwapPool(_poolOrMarket).totalSupply();

            uint256 epoch = _epochOfTimestamp(block.timestamp, _staking);
            totalStakeLP = IERC20Ext(_poolOrMarket).balanceOf(address(_staking));
            (, totalRewards, , , ) = _staking.readEpochData(epoch, address(0));
        } else {
            revert("invalid type");
        }
    }

    function getStakingInfo(
        PendleYieldToken _pool,
        PendleLiquidityMining _staking,
        address _user,
        Type _type
    )
        public
        view
        returns (
            uint256 expiry,
            uint256 numberOfEpochs,
            uint256 epochDuration,
            uint256 userStaked,
            uint256 userAvailableToStake,
            uint256 userAllowance
        )
    {
        if (_type == Type.PendleMarket) {
            expiry = _pool.expiry();
        } else if (_type == Type.SushiSwapPool) {
            address token0 = SushiSwapPool(address(_pool)).token0();
            address token1 = SushiSwapPool(address(_pool)).token1();

            try PendleYieldToken(token0).expiry() returns (uint256 _expiry) {
                expiry = _expiry;
            } catch {
                expiry = PendleYieldToken(token1).expiry();
            }
        } else {
            revert("invalid type");
        }

        numberOfEpochs = _staking.numberOfEpochs();
        epochDuration = _staking.epochDuration();

        try _staking.getBalances(expiry, _user) returns (uint256 res) {
            userStaked = res;
        } catch {
            userStaked = _staking.balances(_user);
        }

        userAvailableToStake = _pool.balanceOf(_user);
        userAllowance = _pool.allowance(_user, address(_staking));
    }

    function getSingleStakingInfo(
        PendleSingleStaking _staking,
        PendleSingleStakingManager _manager,
        IERC20Ext _pendle,
        address _user
    )
        public
        view
        returns (
            uint256 totalSupply,
            uint256 rewardPerBlock,
            uint256 userAvailableToStake,
            uint256 userAllowance,
            uint256 userShare
        )
    {
        totalSupply = _staking.totalSupply();
        rewardPerBlock = _manager.rewardPerBlock();
        userAvailableToStake = _pendle.balanceOf(_user);
        userAllowance = _pendle.allowance(_user, address(_staking));
        userShare = _staking.balances(_user);
    }

    function _epochOfTimestamp(uint256 _t, PendleLiquidityMining _lm)
        internal
        view
        returns (uint256)
    {
        return (_t.sub(_lm.startTime())).div(_lm.epochDuration()).add(1);
    }

    function _getYTTokenInfo(address _market)
        internal
        view
        returns (
            string memory tokenSymbol,
            uint8 tokenDecimals,
            uint8 ytotDecimals,
            uint256 expiry
        )
    {
        IERC20Ext token = IERC20Ext(PendleMarket(_market).token());
        IERC20Ext xyt = IERC20Ext(PendleMarket(_market).xyt());

        tokenSymbol = token.symbol();
        tokenDecimals = token.decimals();
        ytotDecimals = xyt.decimals();
        expiry = PendleMarket(_market).expiry();
    }

    function _getOTTokenInfo(address _pool)
        internal
        view
        returns (
            string memory tokenSymbol,
            uint8 tokenDecimals,
            uint8 ytotDecimals,
            uint256 expiry
        )
    {
        address token0 = SushiSwapPool(address(_pool)).token0();
        address token1 = SushiSwapPool(address(_pool)).token1();
        PendleYieldToken ot;
        IERC20Ext token;

        try PendleYieldToken(token0).expiry() returns (uint256 _expiry) {
            expiry = _expiry;
            ot = PendleYieldToken(SushiSwapPool(_pool).token0());
            token = IERC20Ext(SushiSwapPool(_pool).token1());
        } catch {
            expiry = PendleYieldToken(token1).expiry();
            ot = PendleYieldToken(SushiSwapPool(_pool).token1());
            token = IERC20Ext(SushiSwapPool(_pool).token0());
        }

        tokenSymbol = token.symbol();
        tokenDecimals = token.decimals();
        ytotDecimals = ot.decimals();
    }

    function _getYTReserves(address _market) internal view returns (Reserves memory reserves) {
        (
            uint256 xytBalance,
            uint256 xytWeight,
            uint256 tokenBalance,
            uint256 tokenWeight,

        ) = PendleMarket(_market).getReserves();
        reserves.ytotBalance = xytBalance;
        reserves.ytotWeight = xytWeight;
        reserves.tokenBalance = tokenBalance;
        reserves.tokenWeight = tokenWeight;
    }

    function _getOTReserves(address _pool) internal view returns (Reserves memory reserves) {
        uint256 reserve0;
        uint256 reserve1;
        bool token0IsYT = false;
        address token0 = SushiSwapPool(_pool).token0();

        try PendleYieldToken(token0).expiry() {
            token0IsYT = true;
        } catch {}

        if (token0IsYT) {
            (reserve0, reserve1, ) = SushiSwapPool(_pool).getReserves();
        } else {
            (reserve1, reserve0, ) = SushiSwapPool(_pool).getReserves();
        }

        reserves.ytotBalance = reserve0;
        reserves.ytotWeight = (uint256(1) << 40) / 2;
        reserves.tokenBalance = reserve1;
        reserves.tokenWeight = reserves.ytotWeight;
    }
}
