import { DeployOrFetch, saveNewForge } from '..';
import { deployOrFetchContract } from '../helpers/contract-helpers';
import { PendleEnv } from '../type/pendle-env';
import { sendAndWaitForTransaction } from '../helpers';

export async function deployXJoeForge(env: PendleEnv, runMode: DeployOrFetch) {
  env.xJoeRewardManager = await deployOrFetchContract(
    env,
    runMode,
    'PendleRewardManagerXJoe',
    'PendleRewardManagerMulti',
    [
      env.governanceManagerMain.address,
      env.consts.joe!.FORGE_ID_XJOE,
      [env.consts.joe!.PAIR_FACTORY, env.consts.joe!.CODE_HASH, env.consts.kyber!.PAIR_FACTORY],
    ]
  );

  env.xJoeYieldContractDeployer = await deployOrFetchContract(
    env,
    runMode,
    'PendleXJoeYieldContractDeployer',
    'PendleTraderJoeYieldContractDeployer',
    [env.governanceManagerMain.address, env.consts.joe!.FORGE_ID_XJOE]
  );

  env.pendleXJoeForge = await deployOrFetchContract(env, runMode, 'PendleXJoeForge', 'PendleXJoeForge', [
    env.governanceManagerMain.address,
    env.pendleRouter.address,
    env.consts.joe!.FORGE_ID_XJOE,
    env.tokens.JOE!.address,
    env.tokens.XJOE!.address,
    env.xJoeRewardManager.address,
    env.xJoeYieldContractDeployer.address,
  ]);

  if (runMode == DeployOrFetch.DEPLOY) {
    await saveNewForge(env, env.consts.joe!.FORGE_ID_XJOE, env.pendleXJoeForge.address, env.xJoeRewardManager.address);
  }
}

export async function initXJoeForge(env: PendleEnv) {
  await sendAndWaitForTransaction(env.xJoeRewardManager.initialize, 'initialise XJoeRewardManager', [
    env.pendleXJoeForge.address,
  ]);

  await sendAndWaitForTransaction(env.xJoeYieldContractDeployer.initialize, 'initialize XJoeYieldContractDeployer', [
    env.pendleXJoeForge.address,
  ]);
}

export async function addXJoeForgeToPendleData(env: PendleEnv) {
  await sendAndWaitForTransaction(env.pendleData.addForge, 'add XJoe forge', [
    env.consts.joe!.FORGE_ID_XJOE,
    env.pendleXJoeForge.address,
  ]);
  await sendAndWaitForTransaction(env.pendleData.setForgeFactoryValidity, 'set forge-factory validity for XJoe', [
    env.consts.joe!.FORGE_ID_XJOE,
    env.consts.common.GENERIC_MARKET_FACTORY_ID,
    true,
  ]);
}

export async function registerTokenXJoe(env: PendleEnv) {
  await sendAndWaitForTransaction(env.pendleXJoeForge.registerTokens, 'register new token for XJoe', [
    [env.tokens.JOE!.address],
    [
      [
        env.tokens.XJOE!.stakeContractAddr!,
        env.tokens.XJOE!.pid,
        env.tokens.JOE!.address,
        env.consts.misc.ZERO_ADDRESS,
        env.consts.misc.ZERO_ADDRESS,
      ],
    ],
  ]);
}
