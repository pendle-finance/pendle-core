import { BigNumber as BN } from 'ethers';
import fs from 'fs';
import path from 'path';
import {
  getFlattenedInfo,
  getInfoLiqOT,
  getInfoLiqYT,
  getInfoMarket,
  SavedData,
  SingleForge,
  SingleYieldContract,
} from '.';
import { DeployedContractData, hexToString, isLocalEnv, Network, PendleEnv } from '..';

export function getPathDeployment(env: PendleEnv) {
  return path.resolve(__dirname, `../../deployments/${Network[env.network]}.json`);
}

export function getPathDeploymentFlat(env: PendleEnv) {
  return path.resolve(__dirname, `../../deployments/${Network[env.network]}-flat.json`);
}

export async function saveContract(env: PendleEnv, name: string, deployed: DeployedContractData) {
  if (name in env.contractMap) throw new Error("contract already exists, can't overwrite");
  env.contractMap[name] = deployed;
  await writeToDeploymentFile(env);
}

export async function writeToDeploymentFile(env: PendleEnv) {
  if (isLocalEnv(env.network)) return;
  let savedData: SavedData = {
    contractMap: env.contractMap,
    forgeMap: env.forgeMap,
  };
  let flattendData = await getFlattenedInfo(env);
  fs.writeFileSync(getPathDeployment(env), JSON.stringify(savedData, JSONReplacerBigNum), 'utf8');
  fs.writeFileSync(getPathDeploymentFlat(env), JSON.stringify(flattendData), 'utf8');
}

function JSONReplacerBigNum(key: string, value: any): string {
  if (typeof value == 'object' && 'type' in value && value['type'] === 'BigNumber') {
    return BN.from(value['hex']).toString();
  }
  return value;
}

function JSONReviverBigNum(key: string, value: any): BN {
  if (typeof value == 'string' && /^\d+$/.test(value)) {
    return BN.from(value);
  }
  return value;
}

export async function saveNewForge(env: PendleEnv, rawForgeId: string, address: string, rewardManager: string) {
  let forgeId = hexToString(rawForgeId);
  if (forgeId in env.forgeMap) throw new Error("forgeId already exists, can't overwrite");
  let forgeInfo: SingleForge = {
    address,
    rewardManager,
    forgeId: rawForgeId,
  };
  env.forgeMap[forgeId] = { forgeInfo, yieldContracts: [], markets: [], liqYTs: [], liqOTs: [] };
  await writeToDeploymentFile(env);
}

export async function saveNewYieldContract(env: PendleEnv, _forgeId: string, data: SingleYieldContract) {
  let forgeId = hexToString(_forgeId);
  if (!(forgeId in env.forgeMap)) throw new Error("forgeId doesn't exist");

  for (let i = 0; i < env.forgeMap[forgeId].yieldContracts.length; i++) {
    let it = env.forgeMap[forgeId].yieldContracts[i];
    if (it.OT.address == data.OT.address) {
      env.forgeMap[forgeId].yieldContracts[i] = data;
      return;
    }
  }
  env.forgeMap[forgeId].yieldContracts.push(data);
  await writeToDeploymentFile(env);
}

export async function saveNewMarket(env: PendleEnv, _forgeId: string, marketAddr: string) {
  let forgeId = hexToString(_forgeId);
  if (!(forgeId in env.forgeMap)) throw new Error("forgeId doesn't exist");

  for (let it of env.forgeMap[forgeId].markets) {
    if (it.address == marketAddr) throw new Error('market already exists');
  }
  let data = await getInfoMarket(env, marketAddr);

  delete data.lockStartTime;
  delete data.balanceBaseToken;
  delete data.balanceYT;

  env.forgeMap[forgeId].markets.push(data);
  await writeToDeploymentFile(env);
}

export async function saveNewLiqYT(env: PendleEnv, _forgeId: string, liqAddr: string) {
  let forgeId = hexToString(_forgeId);
  if (!(forgeId in env.forgeMap)) throw new Error("forgeId doesn't exist");

  for (let it of env.forgeMap[forgeId].liqYTs) {
    if (it.address == liqAddr) throw new Error('liqYT already exists');
  }
  let data = await getInfoLiqYT(env, liqAddr);

  delete data.numberOfEpochs;
  delete data.currentEpoch;
  delete data.fundedFutureEpoch;

  env.forgeMap[forgeId].liqYTs.push(data);
  await writeToDeploymentFile(env);
}

export async function saveNewLiqOT(env: PendleEnv, _forgeId: string, liqAddr: string) {
  let forgeId = hexToString(_forgeId);
  if (!(forgeId in env.forgeMap)) throw new Error("forgeId doesn't exist");

  for (let it of env.forgeMap[forgeId].liqOTs) {
    if (it.address == liqAddr) throw new Error('liqOT already exists');
  }
  let data = await getInfoLiqOT(liqAddr);

  delete data.numberOfEpochs;
  delete data.currentEpoch;
  delete data.fundedFutureEpoch;

  env.forgeMap[forgeId].liqOTs.push(data);
  await writeToDeploymentFile(env);
}

export async function saveNewLiqJLP(env: PendleEnv, liqAddr: string) {
  await saveNewLiqOT(env, env.consts.joe!.FORGE_ID_COMPLEX, liqAddr);
}

export function readSavedData(env: PendleEnv) {
  const filePath = getPathDeployment(env);
  if (fs.existsSync(filePath)) {
    let savedData: SavedData = JSON.parse(fs.readFileSync(filePath, 'utf8'), JSONReviverBigNum) as SavedData;
    env.contractMap = savedData.contractMap;
    env.forgeMap = savedData.forgeMap;
    console.log(`\tThere is an existing deployment`);
  } else {
    env.contractMap = {};
    env.forgeMap = {};
    console.log(`\tNo existing deployment file`);
  }
}
