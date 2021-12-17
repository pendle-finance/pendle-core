import { DeployOrFetch, deployOrFetchContract, saveNewForge } from '..';
import { PendleEnv } from '../type/pendle-env';
import { sendAndWaitForTransaction } from '../helpers';

export async function deployWonderlandForge(env: PendleEnv, runMode: DeployOrFetch) {
  env.wonderlandRewardManager = await deployOrFetchContract(
    env,
    runMode,
    'PendleWonderlandRewardManager',
    'PendleRewardManager',
    [env.governanceManagerMain.address, env.consts.wonderland?.FORGE_ID!]
  );

  env.wonderlandYieldContractDeployer = await deployOrFetchContract(
    env,
    runMode,
    'PendleWonderlandYieldContractDeployer',
    'PendleYieldContractDeployerBaseV2',
    [env.governanceManagerMain.address, env.consts.wonderland?.FORGE_ID!]
  );

  env.pendleWonderlandForge = await deployOrFetchContract(
    env,
    runMode,
    'PendleWonderlandForge',
    'PendleWonderlandForge',
    [
      env.governanceManagerMain.address,
      env.pendleRouter.address,
      env.consts.wonderland?.FORGE_ID!,
      env.tokens.TIME!.address, // theres no OT reward but it needs a token T_T
      env.wonderlandRewardManager.address,
      env.wonderlandYieldContractDeployer.address,
      env.tokens.wMEMO!.address,
    ]
  );

  if (runMode == DeployOrFetch.DEPLOY) {
    await saveNewForge(
      env,
      env.consts.wonderland?.FORGE_ID!,
      env.pendleWonderlandForge.address,
      env.wonderlandRewardManager.address
    );
  }
}

export async function initWonderlandForge(env: PendleEnv) {
  await sendAndWaitForTransaction(env.wonderlandRewardManager.initialize, 'initialize wonderland forge', [
    env.pendleWonderlandForge.address,
  ]);
  await sendAndWaitForTransaction(
    env.wonderlandYieldContractDeployer.initialize,
    'initialize Wonderland Money YieldContractDeployer',
    [env.pendleWonderlandForge.address]
  );
}

export async function addWonderlandForgeToPendleData(env: PendleEnv) {
  await sendAndWaitForTransaction(env.pendleData.connect(env.deployer).addForge, 'add Wonderland Money Forge', [
    env.consts.wonderland?.FORGE_ID!,
    env.pendleWonderlandForge.address,
  ]);
  await sendAndWaitForTransaction(
    env.pendleData.connect(env.deployer).setForgeFactoryValidity,
    'set forge-factory validity for Wonderland Money',
    [env.consts.wonderland?.FORGE_ID!, env.consts.common.GENERIC_MARKET_FACTORY_ID, true]
  );
}
