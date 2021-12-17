import { DeployOrFetch, saveNewForge } from '..';
import { deployOrFetchContract } from '../helpers/contract-helpers';
import { PendleEnv } from '../type/pendle-env';
import { sendAndWaitForTransaction } from '../helpers';

export async function deployJoeComplexForge(env: PendleEnv, runMode: DeployOrFetch) {
  env.joeComplexRewardManager = await deployOrFetchContract(
    env,
    runMode,
    'PendleRewardManagerTraderJoeComplex',
    'PendleRewardManagerMulti',
    [
      env.governanceManagerMain.address,
      env.consts.joe!.FORGE_ID_COMPLEX,
      [env.consts.joe!.PAIR_FACTORY, env.consts.joe!.CODE_HASH, env.consts.kyber!.PAIR_FACTORY],
    ]
  );

  env.joeComplexYieldContractDeployer = await deployOrFetchContract(
    env,
    runMode,
    'PendleTraderJoeComplexYieldContractDeployer',
    'PendleTraderJoeYieldContractDeployer',
    [env.governanceManagerMain.address, env.consts.joe!.FORGE_ID_COMPLEX]
  );

  env.pendleTraderJoeComplexForge = await deployOrFetchContract(
    env,
    runMode,
    'PendleTraderJoeComplexForge',
    'PendleTraderJoeForge',
    [
      env.governanceManagerMain.address,
      env.pendleRouter.address,
      env.consts.joe!.FORGE_ID_COMPLEX,
      env.tokens.JOE!.address,
      env.joeComplexRewardManager.address,
      env.joeComplexYieldContractDeployer.address,
      env.consts.joe!.CODE_HASH,
      env.consts.joe!.PAIR_FACTORY,
    ]
  );

  await saveNewForge(
    env,
    env.consts.joe!.FORGE_ID_COMPLEX,
    env.pendleTraderJoeComplexForge.address,
    env.joeComplexRewardManager.address
  );
}

export async function initJoeComplexForge(env: PendleEnv) {
  await sendAndWaitForTransaction(env.joeComplexRewardManager.initialize, 'initialise traderjoeComplexRewardManager', [
    env.pendleTraderJoeComplexForge.address,
  ]);

  await sendAndWaitForTransaction(
    env.joeComplexYieldContractDeployer.initialize,
    'initialize traderjoeComplexYieldContractDeployer',
    [env.pendleTraderJoeComplexForge.address]
  );
}

export async function addJoeComplexForgeToPendleData(env: PendleEnv) {
  await sendAndWaitForTransaction(env.pendleData.addForge, 'add TraderJoe Complex forge', [
    env.consts.joe!.FORGE_ID_COMPLEX,
    env.pendleTraderJoeComplexForge.address,
  ]);
  await sendAndWaitForTransaction(
    env.pendleData.setForgeFactoryValidity,
    'set forge-factory validity for TraderJoe Complex',
    [env.consts.joe!.FORGE_ID_COMPLEX, env.consts.common.GENERIC_MARKET_FACTORY_ID, true]
  );
}
