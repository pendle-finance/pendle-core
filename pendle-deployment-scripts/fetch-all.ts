import {
  deployBenQiForge,
  deployGenericMarketFactory,
  deployJoeSimpleForge,
  deployOnePause,
  DeployOrFetch,
  deployXJoeForge,
  FlatEnv,
  FlattenedData,
  getContract,
  getPathDeploymentFlat,
  isAvax,
  SavedData,
  setUpEnv,
} from '.';
import {
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
import fs from 'fs';
import { IJoeRouter01 } from '../typechain-types';

export async function fetchAll(env: PendleEnv, network: Network) {
  await setUpEnv(env, network);
  await getPENDLEcontract(env);
  await deployGovernanceAndPausingManagers(env, DeployOrFetch.FETCH);
  await deployPendleData(env, DeployOrFetch.FETCH);
  await deployPendleRouter(env, DeployOrFetch.FETCH);

  await deployRetroactiveDist(env, DeployOrFetch.FETCH);
  await deployRedeemProxy(env, DeployOrFetch.FETCH);

  await deployPendleWrapper(env, DeployOrFetch.FETCH);
  await deployPendleWhitelist(env, DeployOrFetch.FETCH);

  await deployGenericMarketFactory(env, DeployOrFetch.FETCH);
  await deployBenQiForge(env, DeployOrFetch.FETCH);
  await deployJoeSimpleForge(env, DeployOrFetch.FETCH);
  await deployXJoeForge(env, DeployOrFetch.FETCH);
  await deployOnePause(env, DeployOrFetch.FETCH);
  await fetchMiscContracts(env);
  await deployWonderlandForge(env, DeployOrFetch.FETCH);
  await fetchFlattenedEnv(env);
}

async function fetchMiscContracts(env: PendleEnv) {
  if (isAvax(env.network)) {
    env.joeFactory = await getContract('contracts/misc/JoePair.sol:IJoeFactory', env.consts.joe!.PAIR_FACTORY);
    env.joeRouter = (await getContract('IJoeRouter01', env.consts.joe!.ROUTER)) as IJoeRouter01;
  }
}

async function fetchFlattenedEnv(env: PendleEnv) {
  env.flat = JSON.parse(fs.readFileSync(getPathDeploymentFlat(env), 'utf8')) as FlatEnv;
}
