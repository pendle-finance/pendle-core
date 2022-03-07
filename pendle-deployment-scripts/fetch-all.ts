import {
  deployAaveForgeAndMarketFactory,
  deployBenQiForge,
  deployCompoundForgeAndMarketFactory,
  deployGenericMarketFactory,
  deployJoeSimpleForge,
  deployMerkleDistributor,
  deployMultipleBalanceQuery,
  deployOnePause,
  DeployOrFetch,
  deployPendleProxyAdmin,
  deployPendleZapEstimator,
  deployXJoeForge,
  getContract,
  isAvax,
  isEth,
  setUpEnv,
} from '.';
import {
  deployIncentiveData,
  deployPendleData,
  deployPendleRouter,
  deployPendleWhitelist,
  deployRedeemProxy,
  deployRetroactiveDist,
  getPENDLEcontract,
} from './deploy-forge/deploy-core';
import { deployGovernanceAndPausingManagers } from './deploy-forge/deploy-governance-pausing-manager';
import { deployWonderlandForge } from './deploy-forge/deploy-wonderland';
import { Network, PendleEnv } from './type/pendle-env';
import { deployPendleWrapper } from './deploy-forge/deploy-wrapper';
import { IJoeFactory, IJoeRouter01, IUniswapV2Router02 } from '../typechain-types';
import { deploySushiSimpleForge } from './deploy-forge/deploy-sushi-simple';
import { deploySushiComplexForge } from './deploy-forge/deploy-sushi-complex';

export async function fetchAll(env: PendleEnv, network: Network) {
  await setUpEnv(env, network);
  await fetchMiscContracts(env);
  await getPENDLEcontract(env);

  await deployGovernanceAndPausingManagers(env, DeployOrFetch.FETCH);
  await deployPendleData(env, DeployOrFetch.FETCH);
  await deployPendleRouter(env, DeployOrFetch.FETCH);

  if (isAvax(env)) {
    await deployRetroactiveDist(env, DeployOrFetch.FETCH);
    await deployPendleProxyAdmin(env, DeployOrFetch.FETCH);
    await deployPendleWrapper(env, DeployOrFetch.FETCH);
  }
  await deployRedeemProxy(env, DeployOrFetch.FETCH);

  await deployPendleWhitelist(env, DeployOrFetch.FETCH);
  await deployGenericMarketFactory(env, DeployOrFetch.FETCH);

  if (isEth(env)) {
    await deployCompoundForgeAndMarketFactory(env, DeployOrFetch.FETCH);
    await deployAaveForgeAndMarketFactory(env, DeployOrFetch.FETCH);
    await deploySushiSimpleForge(env, DeployOrFetch.FETCH);
    await deploySushiComplexForge(env, DeployOrFetch.FETCH);
    await deployMerkleDistributor(env, DeployOrFetch.FETCH);
    await deployIncentiveData(env, DeployOrFetch.FETCH);
    await deployMultipleBalanceQuery(env, DeployOrFetch.FETCH);
  } else {
    await deployOnePause(env, DeployOrFetch.FETCH);
    await deployBenQiForge(env, DeployOrFetch.FETCH);
    await deployJoeSimpleForge(env, DeployOrFetch.FETCH);
    await deployXJoeForge(env, DeployOrFetch.FETCH);
    await deployPendleZapEstimator(env, DeployOrFetch.FETCH);
    await deployWonderlandForge(env, DeployOrFetch.FETCH);
  }
}

async function fetchMiscContracts(env: PendleEnv) {
  if (isAvax(env)) {
    env.joeFactory = (await getContract(
      'contracts/misc/JoePair.sol:IJoeFactory',
      env.consts.joe!.PAIR_FACTORY
    )) as IJoeFactory;
    env.joeRouter = (await getContract('IJoeRouter01', env.consts.joe!.ROUTER)) as IJoeRouter01;
  } else {
    env.sushiFactory = (await getContract(
      'contracts/misc/JoePair.sol:IJoeFactory',
      env.consts.sushi!.PAIR_FACTORY
    )) as IJoeFactory;
    env.sushiRouter = (await getContract('IUniswapV2Router02', env.consts.sushi!.ROUTER)) as IUniswapV2Router02;
  }
}
