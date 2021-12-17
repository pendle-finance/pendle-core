import { MiscConsts } from '@pendle/constants';
import { saveNewForge } from '..';
import { deployOrFetchContract } from '../helpers/contract-helpers';
import { PendleEnv } from '../type/pendle-env';
import { DeployOrFetch } from './../type/common-type';
import { sendAndWaitForTransaction } from '../helpers';

export async function deployBenQiForge(env: PendleEnv, runMode: DeployOrFetch) {
  env.benQiRewardManager = await deployOrFetchContract(
    env,
    runMode,
    'PendleRewardManagerBenQi',
    'PendleRewardManagerMulti',
    [
      env.governanceManagerMain.address,
      env.consts.benqi!.FORGE_ID,
      [env.consts.joe!.PAIR_FACTORY, env.consts.joe!.CODE_HASH, env.consts.kyber!.PAIR_FACTORY],
    ]
  );

  env.benQiYieldContractDeployer = await deployOrFetchContract(
    env,
    runMode,
    'PendleBenQiYieldContractDeployer',
    'PendleBenQiYieldContractDeployer',
    [env.governanceManagerMain.address, env.consts.benqi!.FORGE_ID, env.consts.benqi!.COMPTROLLER]
  );

  env.pendleBenQiForge = await deployOrFetchContract(env, runMode, 'PendleBenQiForge', 'PendleBenQiForge', [
    env.governanceManagerMain.address,
    env.pendleRouter.address,
    env.consts.benqi!.COMPTROLLER,
    env.consts.benqi!.FORGE_ID,
    env.tokens.QI!.address,
    env.benQiRewardManager.address,
    env.benQiYieldContractDeployer.address,
    [env.tokens.NATIVE.benqi!, env.tokens.QI!.address, env.tokens.WNATIVE.address, MiscConsts.ZERO_ADDRESS],
  ]);

  if (runMode == DeployOrFetch.DEPLOY) {
    await saveNewForge(env, env.consts.benqi!.FORGE_ID, env.pendleBenQiForge.address, env.benQiRewardManager.address);
  }
}

export async function initBenQiForge(env: PendleEnv) {
  await sendAndWaitForTransaction(env.benQiRewardManager.initialize, 'initialise benQiRewardManager', [
    env.pendleBenQiForge.address,
  ]);

  await sendAndWaitForTransaction(env.benQiYieldContractDeployer.initialize, 'initialize benQiYieldContractDeployer', [
    env.pendleBenQiForge.address,
  ]);
}

export async function addBenQiForgeToPendleData(env: PendleEnv) {
  await sendAndWaitForTransaction(env.pendleData.addForge, 'add BenQi forge', [
    env.consts.benqi!.FORGE_ID,
    env.pendleBenQiForge.address,
  ]);
  await sendAndWaitForTransaction(env.pendleData.setForgeFactoryValidity, 'set forge-factory validity for BenQi', [
    env.consts.benqi!.FORGE_ID,
    env.consts.common.GENERIC_MARKET_FACTORY_ID,
    true,
  ]);
}
