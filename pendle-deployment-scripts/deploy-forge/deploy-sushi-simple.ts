import { DeployOrFetch } from '..';
import { deployOrFetchContract } from '../helpers/contract-helpers';
import { PendleEnv } from '../type/pendle-env';
import { sendAndWaitForTransaction } from '../helpers';

export async function deploySushiSimpleForge(env: PendleEnv, runMode: DeployOrFetch) {
  env.sushiSimpleRewardManager = await deployOrFetchContract(
    env,
    runMode,
    'PendleRewardManagerSushiswapSimple',
    'PendleRewardManager',
    [env.governanceManagerMain.address, env.consts.sushi!.FORGE_ID_SIMPLE]
  );

  env.sushiSimpleYieldContractDeployer = await deployOrFetchContract(
    env,
    runMode,
    'PendleYieldContractDeployerBaseV2',
    'PendleSushiswapSimpleYieldContractDeployer',
    [env.governanceManagerMain.address, env.consts.sushi!.FORGE_ID_SIMPLE]
  );

  env.pendleSushiswapSimpleForge = await deployOrFetchContract(
    env,
    runMode,
    'PendleSushiswapSimpleForge',
    'PendleSushiswapSimpleForge',
    [
      env.governanceManagerMain.address,
      env.pendleRouter.address,
      env.consts.sushi!.FORGE_ID_SIMPLE,
      env.tokens.SUSHI!.address,
      env.sushiSimpleRewardManager.address,
      env.sushiSimpleYieldContractDeployer.address,
      env.consts.sushi!.CODE_HASH,
      env.consts.sushi!.PAIR_FACTORY,
    ]
  );
}

export async function initSushiSimpleForge(env: PendleEnv) {
  await sendAndWaitForTransaction(env.sushiSimpleRewardManager.initialize, 'initialise sushiswapSimpleRewardManager', [
    env.pendleSushiswapSimpleForge.address,
  ]);

  await sendAndWaitForTransaction(
    env.sushiSimpleYieldContractDeployer.initialize,
    'initialize sushiswapSimpleYieldContractDeployer',
    [env.pendleSushiswapSimpleForge.address]
  );
}

export async function addSushiSimpleForgeToPendleData(env: PendleEnv) {
  await sendAndWaitForTransaction(env.pendleData.addForge, 'add Sushiswap Simple forge', [
    env.consts.sushi!.FORGE_ID_SIMPLE,
    env.pendleSushiswapSimpleForge.address,
  ]);
  await sendAndWaitForTransaction(
    env.pendleData.setForgeFactoryValidity,
    'set forge-factory validity for Sushiswap Simple',
    [env.consts.sushi!.FORGE_ID_SIMPLE, env.consts.common.GENERIC_MARKET_FACTORY_ID, true]
  );
}
