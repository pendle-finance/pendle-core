import { DeployOrFetch } from '..';
import { deployOrFetchContract } from '../helpers/contract-helpers';
import { PendleEnv } from '../type/pendle-env';
import { sendAndWaitForTransaction } from '../helpers';

export async function deployCompoundV2Forge(env: PendleEnv, runMode: DeployOrFetch) {
  env.compoundV2RewardManager = await deployOrFetchContract(
    env,
    runMode,
    'PendleRewardManagerCompoundV2',
    'PendleRewardManager',
    [env.governanceManagerMain.address, env.consts.compound!.FORGE_ID_V2]
  );

  env.compoundV2YieldContractDeployer = await deployOrFetchContract(
    env,
    runMode,
    'PendleCompoundV2YieldContractDeployer',
    'PendleCompoundV2YieldContractDeployer',
    [env.governanceManagerMain.address, env.consts.compound!.FORGE_ID_V2]
  );

  env.pendleCompoundV2Forge = await deployOrFetchContract(
    env,
    runMode,
    'PendleCompoundV2Forge',
    'PendleCompoundV2Forge',
    [
      env.governanceManagerMain.address,
      env.pendleRouter.address,
      env.consts.compound!.COMPTROLLER,
      env.consts.compound!.FORGE_ID_V2,
      env.tokens.COMP!.address,
      env.compoundV2RewardManager.address,
      env.compoundV2YieldContractDeployer.address,
      env.tokens.NATIVE.compound!,
    ]
  );
}

export async function initCompoundV2Forge(env: PendleEnv) {
  await sendAndWaitForTransaction(env.compoundV2RewardManager.initialize, 'initialise compoundV2RewardManager', [
    env.pendleCompoundV2Forge.address,
  ]);

  await sendAndWaitForTransaction(
    env.compoundV2YieldContractDeployer.initialize,
    'initialize compoundV2YieldContractDeployer',
    [env.pendleCompoundV2Forge.address]
  );
}

export async function addCompoundV2ForgeToPendleData(env: PendleEnv) {
  // Setup for CompoundV2
  await sendAndWaitForTransaction(env.pendleData.addForge, 'add CompoundV2 forge', [
    env.consts.compound!.FORGE_ID_V2,
    env.pendleCompoundV2Forge.address,
  ]);
  await sendAndWaitForTransaction(env.pendleData.setForgeFactoryValidity, 'set forge-factory validity for compoundV2', [
    env.consts.compound!.FORGE_ID_V2,
    env.consts.common.GENERIC_MARKET_FACTORY_ID,
    true,
  ]);
}
