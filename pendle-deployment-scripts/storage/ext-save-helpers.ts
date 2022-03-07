import { BigNumber as BN } from 'ethers';
import fs from 'fs';
import path from 'path';
import {
  getFlattenedInfo,
  getInfoLiqOT,
  getInfoLiqYT,
  getInfoMarket,
  getInfoSimpleToken,
  getInfoYO,
  SavedData,
  SingleForge,
  SingleYieldContract,
} from '.';
import { DeployedContractData, FlatEnv, hexToString, isLocalEnv, Network, PendleEnv } from '..';

export function getPathDeployment(env: PendleEnv) {
  return path.resolve(__dirname, `../../deployments/${Network[env.network]}.json`);
}

export function getPathDeploymentFlat(env: PendleEnv) {
  return path.resolve(__dirname, `../../deployments/${Network[env.network]}-flat.json`);
}

export async function saveContract(env: PendleEnv, name: string, deployed: DeployedContractData) {
  env.contractMap[name] = deployed;
  await writeToDeploymentFile(env);
}

export async function writeToDeploymentFile(env: PendleEnv) {
  if (isLocalEnv(env)) return;
  let savedData: SavedData = {
    contractMap: env.contractMap,
    forgeMap: env.forgeMap,
  };
  let flattendData = await getFlattenedInfo(env);
  fs.writeFileSync(getPathDeployment(env), JSON.stringify(savedData, JSONReplacerBigNum), 'utf8');
  fs.writeFileSync(getPathDeploymentFlat(env), JSON.stringify(flattendData), 'utf8');
}

export function JSONReplacerBigNum(key: string, value: any): string {
  if (typeof value == 'object' && 'type' in value && value['type'] === 'BigNumber') {
    return BN.from(value['hex']).toString();
  }
  return value;
}

export function JSONReviverBigNum(key: string, value: any): BN {
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

export async function saveNewYieldContract(env: PendleEnv, forgeIdHex: string, OT: string, YT: string) {
  let forgeId = hexToString(forgeIdHex);
  if (!(forgeId in env.forgeMap)) throw new Error("forgeId doesn't exist");

  let infoYO = await getInfoYO(OT);
  let data: SingleYieldContract = {
    OT: await getInfoSimpleToken(OT),
    YT: await getInfoSimpleToken(YT),
    underlyingAsset: infoYO.underlyingAsset,
    start: infoYO.start,
    expiry: infoYO.expiry,
    yieldTokenHolder: infoYO.yieldTokenHolder,
  };

  for (let i = 0; i < env.forgeMap[forgeId].yieldContracts.length; i++) {
    let it = env.forgeMap[forgeId].yieldContracts[i];
    if (it.OT.address == OT) {
      env.forgeMap[forgeId].yieldContracts[i] = data;
      return;
    }
  }
  env.forgeMap[forgeId].yieldContracts.push(data);
  await writeToDeploymentFile(env);
}

export async function saveNewMarket(env: PendleEnv, forgeIdHex: string, marketAddr: string) {
  let forgeId = hexToString(forgeIdHex);
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

export async function saveNewLiqYT(env: PendleEnv, forgeIdHex: string, liqAddr: string) {
  let forgeId = hexToString(forgeIdHex);
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
  let data = await getInfoLiqOT(env, liqAddr);

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

export function readFlattenedEnv(env: PendleEnv) {
  if (fs.existsSync(getPathDeploymentFlat(env))) {
    env.flat = JSON.parse(fs.readFileSync(getPathDeploymentFlat(env), 'utf8')) as FlatEnv;
  } else {
    env.flat = {} as FlatEnv;
    console.log(`\tNo existing deployment flat file`);
  }
}
