import { DeployOrFetch, deployOrFetchContract, saveNewForge } from '..';
import { PendleEnv } from '../type';
import { sendAndWaitForTransaction } from '../helpers';
import { PendleRedactedForge } from '../../typechain-types';

export async function deployRedactedForge(env: PendleEnv, runMode: DeployOrFetch) {
  env.redactedRewardManager = await deployOrFetchContract(
    env,
    runMode,
    'PendleRedactedRewardManager',
    'PendleRewardManager',
    [env.governanceManagerMain.address, env.consts.redacted?.FORGE_ID!]
  );

  env.redactedYieldContractDeployer = await deployOrFetchContract(
    env,
    runMode,
    'PendleRedactedYieldContractDeployer',
    'PendleYieldContractDeployerBaseV2',
    [env.governanceManagerMain.address, env.consts.redacted?.FORGE_ID!]
  );

  env.pendleRedactedForge = (await deployOrFetchContract(env, runMode, 'PendleRedactedForge', 'PendleRedactedForge', [
    env.governanceManagerMain.address,
    env.pendleRouter.address,
    env.consts.redacted?.FORGE_ID!,
    env.tokens.BTRFLY!.address, // theres no OT reward but it needs a token T_T
    env.redactedRewardManager.address,
    env.redactedYieldContractDeployer.address,
    env.tokens.wxBTRFLY!.address,
  ])) as PendleRedactedForge;

  if (runMode == DeployOrFetch.DEPLOY) {
    await saveNewForge(
      env,
      env.consts.redacted?.FORGE_ID!,
      env.pendleRedactedForge.address,
      env.redactedRewardManager.address
    );
  }
}

export async function initRedactedForge(env: PendleEnv) {
  await sendAndWaitForTransaction(env.redactedRewardManager.initialize, 'initialize Redacted forge', [
    env.pendleRedactedForge.address,
  ]);
  await sendAndWaitForTransaction(
    env.redactedYieldContractDeployer.initialize,
    'initialize Redacted YieldContractDeployer',
    [env.pendleRedactedForge.address]
  );
}

export async function addRedactedForgeToPendleData(env: PendleEnv) {
  await sendAndWaitForTransaction(env.pendleData.connect(env.deployer).addForge, 'add Redacted Forge', [
    env.consts.redacted?.FORGE_ID!,
    env.pendleRedactedForge.address,
  ]);
  await sendAndWaitForTransaction(
    env.pendleData.connect(env.deployer).setForgeFactoryValidity,
    'set forge-factory validity for Redacted',
    [env.consts.redacted?.FORGE_ID!, env.consts.common.GENERIC_MARKET_FACTORY_ID, true]
  );
}
