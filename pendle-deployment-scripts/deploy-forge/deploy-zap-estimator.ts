import { assert } from 'hardhat';
import { PendleZapEstimatorPAP, PendleZapEstimatorSingle } from '../../typechain-types';
import { deployOrFetchContract } from '../helpers';
import { DeployOrFetch, isEth, PendleEnv } from '../type';

export async function deployPendleZapEstimator(env: PendleEnv, runMode: DeployOrFetch) {
  if (isEth(env)) {
    assert(false, 'Cannot deploy Estimator on ETH');
  }
  env.pendleZapEstimatorPAP = (await deployOrFetchContract(
    env,
    runMode,
    'PendleZapEstimatorPAP',
    'PendleZapEstimatorPAP',
    [env.pendleData.address, env.consts.joe!.PAIR_FACTORY]
  )) as PendleZapEstimatorPAP;
  env.pendleZapEstimatorSingle = (await deployOrFetchContract(
    env,
    runMode,
    'PendleZapEstimatorSingle',
    'PendleZapEstimatorSingle',
    [env.pendleData.address, env.consts.joe!.PAIR_FACTORY]
  )) as PendleZapEstimatorSingle;
}
