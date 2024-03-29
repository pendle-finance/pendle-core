import { DeployOrFetch, getContract, isAvax, isEth, isLocalEnv } from '..';
import { deployOrFetchContract } from '../helpers/contract-helpers';
import { Network, PendleEnv } from '../type/pendle-env';
import { sendAndWaitForTransaction } from '../helpers';
import {
  MultipleBalanceQuery,
  PendleData,
  PendleIncentiveData,
  PendleMerkleDistributor,
  PendleRedeemProxyETHDep1,
  PendleRedeemProxyMulti,
  PendleRetroactiveDistribution,
  PendleRouter,
} from '../../typechain-types';

export async function getPENDLEcontract(env: PendleEnv) {
  if (isLocalEnv(env)) {
    env.PENDLE = await deployOrFetchContract(env, DeployOrFetch.DEPLOY, 'PENDLE', 'PENDLE', [
      env.deployer.address,
      env.deployer.address,
      env.deployer.address,
      env.deployer.address,
      env.deployer.address,
    ]);
    env.tokens.PENDLE.address = env.PENDLE.address;
    return;
  }
  if (isAvax(env)) {
    env.PENDLE = await getPENDLEonAvax(env);
  } else {
    env.PENDLE = await getPENDLEonEth(env);
  }
}

export async function deployPendleData(env: PendleEnv, runMode: DeployOrFetch) {
  env.pendleData = (await deployOrFetchContract(env, runMode, 'PendleData', 'PendleData', [
    env.governanceManagerMain.address,
    env.consts.common.TREASURY_MULTISIG,
    env.pausingManagerMain.address,
  ])) as PendleData;
}

export async function initializeConfigPendleData(env: PendleEnv) {
  await sendAndWaitForTransaction(env.pendleData.initialize, 'set router for PendleData', [env.pendleRouter.address]);

  await sendAndWaitForTransaction(env.pendleData.setLockParams, 'set lock params', [
    env.consts.common.LOCK_NUMERATOR,
    env.consts.common.LOCK_DENOMINATOR,
  ]);

  await sendAndWaitForTransaction(env.pendleData.setInterestUpdateRateDeltaForMarket, 'set i/r update delta', [
    env.consts.common.INTEREST_UPDATE_RATE_DELTA_FOR_MARKET,
  ]);

  await sendAndWaitForTransaction(env.pendleData.setForgeFee, 'set forge fee', [env.consts.common.FORGE_FEE]);

  await sendAndWaitForTransaction(env.pendleData.setMarketFees, 'set market fees', [
    env.consts.common.SWAP_FEE,
    env.consts.common.PROTOCOL_SWAP_FEE,
  ]);

  await sendAndWaitForTransaction(env.pendleData.setExpiryDivisor, 'set expiry divisor', [
    env.consts.common.EXPIRY_DIVISOR,
  ]);

  await sendAndWaitForTransaction(env.pendleData.setCurveShiftBlockDelta, 'set curve shift Delta', [
    env.consts.common.CURVE_SHIFT_DELTA,
  ]);
}

export async function deployPendleMarketReader(env: PendleEnv, runMode: DeployOrFetch) {
  env.pendleMarketReader = await deployOrFetchContract(env, runMode, 'PendleMarketReader', 'PendleMarketReader', [
    env.pendleData.address,
  ]);
}

export async function deployPendleRouter(env: PendleEnv, runMode: DeployOrFetch) {
  env.pendleRouter = (await deployOrFetchContract(env, runMode, 'PendleRouter', 'PendleRouter', [
    env.governanceManagerMain.address,
    env.tokens.WNATIVE.address,
    env.pendleData.address,
  ])) as PendleRouter;
}

export async function deployRedeemProxy(env: PendleEnv, runMode: DeployOrFetch) {
  if (isAvax(env)) {
    env.redeemProxyAvax = (await deployOrFetchContract(
      env,
      runMode,
      'PendleRedeemProxyMulti',
      'PendleRedeemProxyMulti',
      [env.pendleRouter.address, env.retroDist.address]
    )) as PendleRedeemProxyMulti;
  } else {
    env.redeemProxyEth = (await deployOrFetchContract(env, runMode, 'PendleRedeemProxy', 'PendleRedeemProxyETHDep1', [
      env.pendleRouter.address,
    ])) as PendleRedeemProxyETHDep1;
  }
}

export async function deployRetroactiveDist(env: PendleEnv, runMode: DeployOrFetch) {
  env.retroDist = (await deployOrFetchContract(
    env,
    runMode,
    'PendleRetroactiveDistribution',
    'PendleRetroactiveDistribution',
    []
  )) as PendleRetroactiveDistribution;
}

export async function deployMerkleDistributor(env: PendleEnv, runMode: DeployOrFetch) {
  env.merkleDistributor = (await deployOrFetchContract(
    env,
    runMode,
    'PendleMerkleDistributor',
    'PendleMerkleDistributor',
    [env.tokens.PENDLE.address]
  )) as PendleMerkleDistributor;
}

export async function deployIncentiveData(env: PendleEnv, runMode: DeployOrFetch) {
  env.incentiveData = (await deployOrFetchContract(
    env,
    runMode,
    'PendleIncentiveData',
    'PendleIncentiveData',
    []
  )) as PendleIncentiveData;
}

export async function deployPendleWhitelist(env: PendleEnv, runMode: DeployOrFetch) {
  env.pendleWhitelist = await deployOrFetchContract(env, runMode, 'PendleWhitelist', 'PendleWhitelist', [
    env.governanceManagerLiqMining.address,
  ]);
}

export async function deployMultipleBalanceQuery(env: PendleEnv, runMode: DeployOrFetch) {
  env.multipleBalanceQuery = (await deployOrFetchContract(
    env,
    runMode,
    'MultipleBalanceQuery',
    'MultipleBalanceQuery',
    []
  )) as MultipleBalanceQuery;
}

export async function getPENDLEonEth(env: PendleEnv) {
  return await getContract('IERC20', env.tokens.PENDLE);
}

export async function getPENDLEonAvax(env: PendleEnv) {
  return await getContract('IERC20', env.tokens.PENDLE);
}
