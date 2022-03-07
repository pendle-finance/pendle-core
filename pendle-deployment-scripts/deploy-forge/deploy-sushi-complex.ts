import { DeployOrFetch } from '..';
import { deployOrFetchContract } from '../helpers/contract-helpers';
import { PendleEnv } from '../type/pendle-env';
import { sendAndWaitForTransaction } from '../helpers';

export async function deploySushiComplexForge(env: PendleEnv, runMode: DeployOrFetch) {
  env.sushiComplexRewardManager = await deployOrFetchContract(
    env,
    runMode,
    'PendleRewardManagerSushiswapComplex',
    'PendleRewardManager',
    [env.governanceManagerMain.address, env.consts.sushi!.FORGE_ID_COMPLEX]
  );

  env.sushiComplexYieldContractDeployer = await deployOrFetchContract(
    env,
    runMode,
    'PendleSushiswapComplexYieldContractDeployer',
    'PendleSushiswapComplexYieldContractDeployer',
    [env.governanceManagerMain.address, env.consts.sushi!.FORGE_ID_COMPLEX, env.consts.sushi!.MASTERCHEF_V1]
  );

  env.pendleSushiswapComplexForge = await deployOrFetchContract(
    env,
    runMode,
    'PendleSushiswapComplexForge',
    'PendleSushiswapComplexForge',
    [
      env.governanceManagerMain.address,
      env.pendleRouter.address,
      env.consts.sushi!.FORGE_ID_COMPLEX,
      env.tokens.SUSHI!.address,
      env.sushiComplexRewardManager.address,
      env.sushiComplexYieldContractDeployer.address,
      env.consts.sushi!.CODE_HASH,
      env.consts.sushi!.PAIR_FACTORY,
      env.consts.sushi!.MASTERCHEF_V1,
    ]
  );
}

async function initSushiComplexForge(env: PendleEnv) {
  await sendAndWaitForTransaction(
    env.sushiComplexRewardManager.initialize,
    'initialise sushiswapComplexRewardManager',
    [env.pendleSushiswapComplexForge.address]
  );

  await sendAndWaitForTransaction(
    env.sushiComplexYieldContractDeployer.initialize,
    'initialize sushiswapComplexYieldContractDeployer',
    [env.pendleSushiswapComplexForge.address]
  );
}

async function addSushiComplexForgeToPendleData(env: PendleEnv) {
  await sendAndWaitForTransaction(env.pendleData.addForge, 'add Sushiswap Complex forge', [
    env.consts.sushi!.FORGE_ID_COMPLEX,
    env.pendleSushiswapComplexForge.address,
  ]);
  await sendAndWaitForTransaction(
    env.pendleData.setForgeFactoryValidity,
    'set forge-factory validity for Sushiswap Complex',
    [env.consts.sushi!.FORGE_ID_COMPLEX, env.consts.common.GENERIC_MARKET_FACTORY_ID, true]
  );
}
