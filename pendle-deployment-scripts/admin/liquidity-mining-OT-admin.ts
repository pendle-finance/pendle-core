import { MiscConsts } from '@pendle/constants';
import { BigNumber as BN, BigNumberish, Contract } from 'ethers';
import { deployOrFetchContract, getNameLiqOT, getOTAddrFromJoePool } from '../helpers';
import { DeployOrFetch, getForgeIdFromYO, saveNewLiqOT } from '../index';
import { PendleEnv } from '../type/pendle-env';

export async function newLiqMiningOTBase(env: PendleEnv, stakeToken: string, startTime: BigNumberish) {
  let OTAddr = await getOTAddrFromJoePool(env, stakeToken);
  let forgeId = await getForgeIdFromYO(OTAddr);

  let liq: Contract = await deployOrFetchContract(
    env,
    DeployOrFetch.DEPLOY,
    getNameLiqOT(stakeToken),
    'PendleLiquidityMiningBaseV2Multi',
    [
      [
        env.governanceManagerLiqMining.address,
        env.pausingManagerLiqMining.address,
        env.pendleWhitelist.address,
        [env.PENDLE.address, env.tokens.WNATIVE.address],
        stakeToken,
        [MiscConsts.ZERO_ADDRESS, MiscConsts.ZERO_ADDRESS],
        startTime,
        env.consts.common.LIQ_MINING_EPOCH_DURATION,
        env.consts.common.LIQ_MINING_VESTING_EPOCHS,
        env.tokens.WNATIVE.address,
      ],
    ]
  );

  await saveNewLiqOT(env, forgeId, liq.address);
  return liq.address;
}
