import { DeployOrFetch } from '..';
import { deployOrFetchContract } from '../helpers/contract-helpers';
import { PendleEnv } from '../type/pendle-env';
import { sendAndWaitForTransaction } from '../helpers';

export async function deployCompoundForgeAndMarketFactory(env: PendleEnv, runMode: DeployOrFetch) {
  env.compoundRewardManager = await deployOrFetchContract(
    env,
    runMode,
    'PendleRewardManagerCompound',
    'PendleRewardManager',
    [env.governanceManagerMain.address, env.consts.compound!.FORGE_ID_V1]
  );

  env.compoundYieldContractDeployer = await deployOrFetchContract(
    env,
    runMode,
    'PendleCompoundYieldContractDeployer',
    'PendleCompoundYieldContractDeployer',
    [env.governanceManagerMain.address, env.consts.compound!.FORGE_ID_V1]
  );

  env.pendleCompoundForge = await deployOrFetchContract(env, runMode, 'PendleCompoundForge', 'PendleCompoundForge', [
    env.governanceManagerMain.address,
    env.pendleRouter.address,
    env.consts.compound!.COMPTROLLER,
    env.consts.compound!.FORGE_ID_V1,
    env.tokens.COMP!.address,
    env.compoundRewardManager.address,
    env.compoundYieldContractDeployer.address,
    env.tokens.NATIVE.compound,
  ]);

  env.pendleCompoundMarketFactory = await deployOrFetchContract(
    env,
    runMode,
    'PendleCompoundMarketFactory',
    'PendleCompoundMarketFactory',
    [env.pendleRouter.address, env.consts.compound!.MARKET_FACTORY_ID]
  );
}

async function initCompoundForge(env: PendleEnv) {
  await sendAndWaitForTransaction(env.compoundRewardManager.initialize, 'initialise cRewardManager', [
    env.pendleCompoundForge.address,
  ]);

  await sendAndWaitForTransaction(env.compoundYieldContractDeployer.initialize, 'initialize cYieldContractDeployer', [
    env.pendleCompoundForge.address,
  ]);
}

async function addCompoundForgeAndFactoryToPendleData(env: PendleEnv) {
  await sendAndWaitForTransaction(env.pendleData.addForge, 'add compound forge', [
    env.consts.compound!.FORGE_ID_V1,
    env.pendleCompoundForge.address,
  ]);
  await sendAndWaitForTransaction(env.pendleData.addMarketFactory, 'add compound market factory', [
    env.consts.compound!.FORGE_ID_V1,
    env.pendleCompoundMarketFactory.address,
  ]);
  await sendAndWaitForTransaction(env.pendleData.setForgeFactoryValidity, 'set forge-factory validity for Compound', [
    env.consts.compound!.FORGE_ID_V1,
    env.consts.compound!.MARKET_FACTORY_ID,
    true,
  ]);
}
