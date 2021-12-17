import { assert } from 'chai';
import { BigNumber as BN, BigNumberish, Contract } from 'ethers';
import {
  approveInfinityIfNeed,
  deployOrFetchContract,
  getContract,
  getNameLiqYT,
  sendAndWaitForTransaction,
} from '../helpers';
import { DeployOrFetch, getForgeIdFromYO, getInfoMarket, getInfoYO, saveNewLiqYT } from '../index';
import { PendleEnv } from '../type';

export async function setLiqMiningAllocationYT(
  env: PendleEnv,
  liqAddr: string,
  expiries: BigNumberish[],
  allocations: BigNumberish[]
) {
  assert(expiries.length == allocations.length, 'LENGTH_MISMATCH');

  let liqMiningContract = await getContract('PendleLiquidityMiningBaseMulti', liqAddr);

  await sendAndWaitForTransaction(
    liqMiningContract.connect(env.deployer).setAllocationSetting,
    'set liqMiningYT allocation',
    [expiries, allocations]
  );
}

export async function newLiqMiningYT(env: PendleEnv, marketAddr: string, startTime: BigNumberish) {
  let marketInfo = await getInfoMarket(env, marketAddr);
  let YTInfo = await getInfoYO(marketInfo.YT.address);
  let liq: Contract = await deployOrFetchContract(
    env,
    DeployOrFetch.DEPLOY,
    getNameLiqYT(marketAddr),
    'PendleGenericLiquidityMiningMulti',
    [
      [
        env.governanceManagerLiqMining.address,
        env.pausingManagerLiqMining.address,
        env.pendleWhitelist.address,
        [env.PENDLE.address, env.tokens.WNATIVE.address],
        env.pendleRouter.address,
        env.consts.common.GENERIC_MARKET_FACTORY_ID,
        await getForgeIdFromYO(YTInfo.address),
        YTInfo.underlyingAsset.address,
        marketInfo.baseToken.address,
        startTime,
        env.consts.common.LIQ_MINING_EPOCH_DURATION,
        env.consts.common.LIQ_MINING_VESTING_EPOCHS,
      ],
    ]
  );

  saveNewLiqYT(env, await getForgeIdFromYO(YTInfo.address), liq.address);

  return liq.address;
}

export async function fundLiqMiningYT(env: PendleEnv, liqAddr: string, rewards: BigNumberish[][]) {
  await approveInfinityIfNeed(env, env.tokens.PENDLE.address, liqAddr);
  await approveInfinityIfNeed(env, env.tokens.WNATIVE.address, liqAddr);
  let liqMiningContract = await getContract('PendleLiquidityMiningBaseMulti', liqAddr);
  await sendAndWaitForTransaction(liqMiningContract.connect(env.deployer).fund, `fund liqMiningYT ${liqAddr}`, [
    rewards,
  ]);
}

export async function fundLiqMiningOT(env: PendleEnv, liqAddr: string, rewards: BigNumberish[][]) {
  await approveInfinityIfNeed(env, env.tokens.PENDLE.address, liqAddr);
  await approveInfinityIfNeed(env, env.tokens.WNATIVE.address, liqAddr);
  let liqMiningContract = await getContract('PendleLiquidityMiningBaseV2Multi', liqAddr);
  await sendAndWaitForTransaction(liqMiningContract.connect(env.deployer).fund, `fund liqMiningOT ${liqAddr}`, [
    rewards,
  ]);
}
