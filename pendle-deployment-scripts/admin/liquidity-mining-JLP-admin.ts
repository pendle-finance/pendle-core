import { LpToken } from '@pendle/constants';
import { BigNumber as BN, Contract } from 'ethers';
import { deployOrFetchContract, getNameLiqJLP } from '../helpers';
import { DeployOrFetch, saveNewLiqJLP } from '../index';
import { PendleEnv } from '../type';

export async function newLiqMiningJLP(env: PendleEnv, lpToken: LpToken, yieldTokens: string[], startTime: BN) {
  let liq: Contract = await deployOrFetchContract(
    env,
    DeployOrFetch.DEPLOY,
    getNameLiqJLP(lpToken.address),
    'PendleJoeLPLiquidityMining',
    [
      [
        env.governanceManagerLiqMining.address,
        env.pausingManagerLiqMining.address,
        env.pendleWhitelist.address,
        [env.PENDLE.address, env.tokens.WNATIVE.address],
        lpToken.address,
        yieldTokens,
        startTime,
        env.consts.common.LIQ_MINING_EPOCH_DURATION,
        env.consts.common.LIQ_MINING_VESTING_EPOCHS,
        env.tokens.WNATIVE.address,
      ],
      lpToken.stakeContractAddr!,
      lpToken.pid,
    ]
  );

  await saveNewLiqJLP(env, liq.address);

  return liq.address;
}
