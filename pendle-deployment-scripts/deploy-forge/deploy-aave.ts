import { DeployOrFetch } from '..';
import { deployOrFetchContract } from '../helpers/contract-helpers';
import { PendleEnv } from '../type/pendle-env';
import { sendAndWaitForTransaction } from '../helpers';

export async function deployAaveForgeAndMarketFactory(env: PendleEnv, runMode: DeployOrFetch) {
  env.a2RewardManager = await deployOrFetchContract(env, runMode, 'PendleRewardManagerAaveV2', 'PendleRewardManager', [
    env.governanceManagerMain.address,
    env.consts.aave!.FORGE_ID,
  ]);

  env.a2YieldContractDeployer = await deployOrFetchContract(
    env,
    runMode,
    'PendleAaveV2YieldContractDeployer',
    'PendleAaveV2YieldContractDeployer',
    [env.governanceManagerMain.address, env.consts.aave!.FORGE_ID]
  );

  env.pendleAaveV2Forge = await deployOrFetchContract(env, runMode, 'PendleAaveV2Forge', 'PendleAaveV2Forge', [
    env.governanceManagerMain.address,
    env.pendleRouter.address,
    env.consts.aave!.LENDING_POOL,
    env.consts.aave!.FORGE_ID,
    env.tokens!.STKAAVE!.address,
    env.a2RewardManager.address,
    env.a2YieldContractDeployer.address,
    env.consts.aave!.INCENTIVES_CONTROLLER,
  ]);

  env.pendleAaveMarketFactory = await deployOrFetchContract(
    env,
    runMode,
    'PendleAaveMarketFactory',
    'PendleAaveMarketFactory',
    [env.pendleRouter.address, env.consts.aave!.MARKET_FACTORY_ID]
  );
}

export async function initAaveForge(env: PendleEnv) {
  await sendAndWaitForTransaction(env.a2RewardManager.initialize, 'initialize a2RewardManager', [
    env.pendleAaveV2Forge.address,
  ]);

  await sendAndWaitForTransaction(env.a2YieldContractDeployer.initialize, 'initialize a2YieldContractDeployer', [
    env.pendleAaveV2Forge.address,
  ]);
}

export async function addAaveForgeAndFactoryToPendleData(env: PendleEnv) {
  await sendAndWaitForTransaction(env.pendleData.addForge, 'add aaveV2 forge', [
    env.consts.aave!.FORGE_ID,
    env.pendleAaveV2Forge.address,
  ]);
  await sendAndWaitForTransaction(env.pendleData.addMarketFactory, 'add aave market factory', [
    env.consts.aave!.MARKET_FACTORY_ID,
    env.pendleAaveMarketFactory.address,
  ]);
  await sendAndWaitForTransaction(env.pendleData.setForgeFactoryValidity, 'set forge-factory validity for aave', [
    env.consts.aave!.FORGE_ID,
    env.consts.aave!.MARKET_FACTORY_ID,
    true,
  ]);
}
