import { DeployOrFetch, saveNewForge } from '..';
import { deployOrFetchContract } from '../helpers/contract-helpers';
import { PendleEnv } from '../type/pendle-env';
import { sendAndWaitForTransaction } from '../helpers';

export async function deployJoeSimpleForge(env: PendleEnv, runMode: DeployOrFetch) {
  env.joeSimpleRewardManager = await deployOrFetchContract(
    env,
    runMode,
    'PendleRewardManagerJoeSimple',
    'PendleRewardManager',
    [env.governanceManagerMain.address, env.consts.joe!.FORGE_ID_SIMPLE]
  );

  env.joeSimpleYieldContractDeployer = await deployOrFetchContract(
    env,
    runMode,
    'PendleJoeSimpleContractDeployer',
    'PendleYieldContractDeployerBaseV2',
    [env.governanceManagerMain.address, env.consts.joe!.FORGE_ID_SIMPLE]
  );

  env.pendleTraderJoeSimpleForge = await deployOrFetchContract(
    env,
    runMode,
    'pendleTraderJoeSimpleForge',
    'PendleUniswapV2Forge',
    [
      env.governanceManagerMain.address,
      env.pendleRouter.address,
      env.consts.joe!.FORGE_ID_SIMPLE,
      env.tokens.JOE!.address,
      env.joeSimpleRewardManager.address,
      env.joeSimpleYieldContractDeployer.address,
      env.consts.joe!.CODE_HASH,
      env.consts.joe!.PAIR_FACTORY,
    ]
  );

  if (runMode == DeployOrFetch.DEPLOY) {
    await saveNewForge(
      env,
      env.consts.joe!.FORGE_ID_SIMPLE,
      env.pendleTraderJoeSimpleForge.address,
      env.joeSimpleRewardManager.address
    );
  }
}

export async function initJoeSimpleForge(env: PendleEnv) {
  await sendAndWaitForTransaction(env.joeSimpleRewardManager.initialize, 'initialise joeSimpleRewardManager', [
    env.pendleTraderJoeSimpleForge.address,
  ]);

  await sendAndWaitForTransaction(
    env.joeSimpleYieldContractDeployer.initialize,
    'initialize joeSimpleYieldContractDeployer',
    [env.pendleTraderJoeSimpleForge.address]
  );
}

export async function addJoeSimpleForgeToPendleData(env: PendleEnv) {
  await sendAndWaitForTransaction(env.pendleData.addForge, 'add TraderJoe Simple forge', [
    env.consts.joe!.FORGE_ID_SIMPLE,
    env.pendleTraderJoeSimpleForge.address,
  ]);
  await sendAndWaitForTransaction(
    env.pendleData.setForgeFactoryValidity,
    'set forge-factory validity for TraderJoe Simple',
    [env.consts.joe!.FORGE_ID_SIMPLE, env.consts.common.GENERIC_MARKET_FACTORY_ID, true]
  );
}
