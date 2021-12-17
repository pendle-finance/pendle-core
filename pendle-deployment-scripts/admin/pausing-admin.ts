import { getContract, sendAndWaitForTransaction } from '../helpers';
import { PendleEnv } from '../type';
import { PopulatedTransaction } from 'ethers';
import {
  getInfoLiqOT,
  getInfoLiqYT,
  getInfoMarket,
  getInfoSingleForge,
  SingleForge,
  SingleLiqOT,
  SingleLiqYT,
  SingleMarket,
} from '../storage';
import { MiscConsts } from '@pendle/constants';

export async function setPausingAdminForAll(env: PendleEnv, user: string) {
  await sendAndWaitForTransaction(
    env.pausingManagerMain.connect(env.deployer).setPausingAdmin,
    `setPausingAdmin for ${user} in PausingManagerMain`,
    [user, true]
  );
  await sendAndWaitForTransaction(
    env.pausingManagerLiqMining.connect(env.deployer).setPausingAdmin,
    `setPausingAdmin for ${user} in PausingManagerLiqMining`,
    [user, true]
  );
  await sendAndWaitForTransaction(
    env.pausingManagerLiqMiningV2.connect(env.deployer).setPausingAdmin,
    `setPausingAdmin for ${user} in pausingManagerLiqMiningV2`,
    [user, true]
  );
}

/**
 * Generate pausing transactions for all Forges, Markets, Liquidity Mining OTs and Liquidity Mining YTs
 * Forges & Markets will be paused through pausingManagerMain
 * Liquidity Minings will be paused through pausingManagerLiqMining
 * @param env
 */
export async function genPauseAllTx(env: PendleEnv) {
  let res: PopulatedTransaction[] = [];
  for (let forge in env.forgeMap) {
    let value = env.forgeMap[forge];
    if (typeof value === undefined) continue;

    let tx = await env.pausingManagerMain.populateTransaction.setForgePaused(value.forgeInfo.forgeId, true);

    res.push(tx);

    for (let market of value.markets) {
      let tx = await env.pausingManagerMain.populateTransaction.setMarketPaused(market.factoryId, market.address, true);
      res.push(tx);
    }

    for (let liqYT of value.liqYTs) {
      let tx = await env.pausingManagerLiqMining.populateTransaction.setLiqMiningPaused(liqYT.address, true);
      res.push(tx);
    }

    for (let liqOT of value.liqOTs) {
      let tx = await env.pausingManagerLiqMining.populateTransaction.setLiqMiningPaused(liqOT.address, true);
      res.push(tx);
    }
  }
  return res;
}

async function checkPauseForge(env: PendleEnv, forge: SingleForge) {
  forge = await getInfoSingleForge(forge.address);
  let pausingManager = await getContract('PendlePausingManager', forge.pausingManager!);
  let { _paused }: { _paused: boolean } = await pausingManager.callStatic.checkYieldContractStatus(
    forge.forgeId,
    MiscConsts.ZERO_ADDRESS,
    0
  );
  return _paused;
}

async function checkPauseMarket(env: PendleEnv, market: SingleMarket) {
  market = await getInfoMarket(env, market.address);
  let pausingManager = await getContract('PendlePausingManager', market.pausingManager!);
  let { _paused }: { _paused: boolean } = await env.pausingManagerMain.callStatic.checkMarketStatus(
    market.factoryId,
    market.address
  );
  return _paused;
}

async function checkPauseLiqMiningYT(env: PendleEnv, liq: SingleLiqYT) {
  let { _paused }: { _paused: boolean } = await env.pausingManagerLiqMining.callStatic.checkLiqMiningStatus(
    liq.address
  );
  return _paused;
}

async function checkPauseLiqMiningOT(env: PendleEnv, liq: SingleLiqOT) {
  let { _paused }: { _paused: boolean } = await env.pausingManagerLiqMining.callStatic.checkLiqMiningStatus(
    liq.address
  );
  return _paused;
}

export async function checkPauseStatusOfAll(env: PendleEnv) {
  let res: { contract: string; paused: boolean }[] = [];
  for (let forge in env.forgeMap) {
    let value = env.forgeMap[forge];
    if (typeof value === undefined) continue;

    res.push({ contract: value.forgeInfo.address, paused: await checkPauseForge(env, value.forgeInfo) });

    for (let market of value.markets) {
      res.push({ contract: market.address, paused: await checkPauseMarket(env, market) });
    }

    for (let liqYT of value.liqYTs) {
      res.push({ contract: liqYT.address, paused: await checkPauseLiqMiningYT(env, liqYT) });
    }

    for (let liqOT of value.liqOTs) {
      res.push({ contract: liqOT.address, paused: await checkPauseLiqMiningOT(env, liqOT) });
    }
  }
  return res;
}
