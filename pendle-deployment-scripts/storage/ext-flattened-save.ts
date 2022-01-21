import {
  CaseInsensitiveRecord,
  FlattenedData,
  getInfoDetailedToken,
  getInfoOTMarket,
  getInfoSimpleToken,
  getInfoYO,
  getUnderlyingYieldToken,
} from '.';
import { PendleEnv, SimpleTokenType } from '../type';
import { convertUnixToDate, Network } from '..';

const basicTokenList: string[] = [];
const yoTokenNames: CaseInsensitiveRecord<string> = new CaseInsensitiveRecord();

async function getTokenSymbol(underlying: SimpleTokenType): Promise<string> {
  if (underlying.symbol === 'USDC.e') return 'USDC';
  if (underlying.symbol.includes('JLP')) {
    const joePair = await getInfoOTMarket(underlying.address);
    return `JLP_${joePair.OT.symbol}_${joePair.baseToken.symbol}`.toUpperCase();
  } else {
    return underlying.symbol.toUpperCase();
  }
}

async function mapYOTokenNames(env: PendleEnv): Promise<void> {
  for (let forgeId in env.forgeMap) {
    const forge = env.forgeMap[forgeId];
    for (let yieldContract of forge.yieldContracts) {
      const yoInfo = await getInfoYO(yieldContract.YT.address);
      const date = convertUnixToDate(yoInfo.expiry.toNumber());
      const jlp = await getTokenSymbol(yoInfo.underlyingYieldToken!);
      const ot = yieldContract.OT;
      const yt = yieldContract.YT;
      yoTokenNames.set(ot.address, `${jlp}_${date}`);
      yoTokenNames.set(yt.address, `${jlp}_${date}`);
    }
  }
}

async function getFlattenedYieldContractsInfo(env: PendleEnv): Promise<FlattenedData> {
  const info = {} as FlattenedData;
  const dates = {} as FlattenedData;
  for (let forgeId in env.forgeMap) {
    const forge = env.forgeMap[forgeId];
    info[`FORGE_${forgeId.toUpperCase()}`] = forge.forgeInfo.address;
    info[`FORGEID_${forgeId.toUpperCase()}`] = forgeId;
    info[`REWARD_MANAGER_${forgeId.toUpperCase()}`] = forge.forgeInfo.rewardManager;
    for (let yieldContract of forge.yieldContracts) {
      const yoInfo = await getInfoYO(yieldContract.YT.address);
      basicTokenList.push(yoInfo.underlyingAsset.address);
      basicTokenList.push(yoInfo.underlyingYieldToken!.address);
      const date = convertUnixToDate(yoInfo.expiry.toNumber());
      const ot = yieldContract.OT;
      const yt = yieldContract.YT;
      info[`TOKEN_OT_${yoTokenNames.get(ot.address)}`] = ot.address;
      info[`TOKEN_YT_${yoTokenNames.get(yt.address)}`] = yt.address;
      dates[`TIME_${date}`] = yoInfo.expiry.toNumber();
    }
  }
  return {
    ...info,
    ...dates,
  } as FlattenedData;
}

async function getFlattenedYTPools(env: PendleEnv) {
  const marketInfo = {} as FlattenedData;
  const liqInfo = {} as FlattenedData;
  const dates = {} as FlattenedData;
  for (let forgeId in env.forgeMap) {
    const forge = env.forgeMap[forgeId];
    for (let market of forge.markets) {
      marketInfo[`POOL_YT_${yoTokenNames.get(market.YT.address)}_X_${await getTokenSymbol(market.baseToken)}`] =
        market.address;
      basicTokenList.push(market.baseToken.address);
    }
    for (let liqYT of forge.liqYTs) {
      const yieldBearing = await getUnderlyingYieldToken(forge.forgeInfo.address, liqYT.underlyingAsset.address);
      const baseToken = await getInfoSimpleToken(liqYT.baseToken.address);
      liqInfo[`LIQ_YT_${await getTokenSymbol(yieldBearing)}_X_${await getTokenSymbol(baseToken)}`] = liqYT.address;

      const date = convertUnixToDate(liqYT.startTime.toNumber());
      dates[`TIME_${date}`] = liqYT.startTime.toNumber();
    }
  }
  return {
    ...dates,
    ...marketInfo,
    ...liqInfo,
    ...dates,
  };
}

async function getFlattenedOTPools(env: PendleEnv) {
  const poolInfo = {} as FlattenedData;
  const liqInfo = {} as FlattenedData;
  const dates = {} as FlattenedData;

  for (let forgeId in env.forgeMap) {
    const forge = env.forgeMap[forgeId];
    for (let liqOT of forge.liqOTs) {
      const pool = await getInfoOTMarket(liqOT.stakeToken.address);
      const poolName = `OT_${yoTokenNames.get(pool.OT.address)}_X_${await getTokenSymbol(pool.baseToken)}`;
      poolInfo[`POOL_${poolName}`] = pool.address;
      liqInfo[`LIQ_${poolName}`] = liqOT.address;
      basicTokenList.push(pool.baseToken.address);

      const date = convertUnixToDate(liqOT.startTime.toNumber());
      dates[`TIME_${date}`] = liqOT.startTime.toNumber();
    }
  }
  return {
    ...poolInfo,
    ...liqInfo,
    ...dates,
  };
}

async function getFlattenedBasicTokens(env: PendleEnv) {
  // Insert reward tokens here
  basicTokenList.push(env.PENDLE.address);
  switch (env.network) {
    case Network.AVAX:
      basicTokenList.push(env.tokens.JOE!.address);
      basicTokenList.push(env.tokens.QI!.address);
      basicTokenList.push(env.tokens.WNATIVE.address);
      basicTokenList.push(env.tokens.TIME!.address);
      break;
    default:
      throw new Error('Unsupported Network');
  }
  const info = {} as FlattenedData;
  for (let tokenAddr of basicTokenList) {
    const token = await getInfoSimpleToken(tokenAddr);
    info[`TOKEN_${await getTokenSymbol(token)}`] = token.address;
  }
  return info;
}

async function getDetailedBasicTokens() {
  let info: Record<string, any> = {};
  for (let tokenAddr of basicTokenList) {
    const token = await getInfoDetailedToken(tokenAddr);
    info[`DETAILED_TOKEN_${await getTokenSymbol(token)}`] = {
      address: token.address,
      symbol: token.symbol,
      decimal: token.decimal,
      name: token.name,
    };
  }
  return info;
}

function replaceSpecialForgeName(env: PendleEnv, name: string): string {
  switch (env.network) {
    case Network.AVAX:
      return name.replace('XJoe', 'Xjoe').replace('BenQi', 'Benqi');
    default:
      throw new Error('Unsupported Network');
  }
}

function applySpecialRuleForNames(name: string) {
  if (name === 'PENDLE_ZAP_ESTIMATOR_P_A_P') {
    return 'PENDLE_ZAP_ESTIMATOR_PAP';
  }
  return name;
}

function getFlattenedGeneralContracts(env: PendleEnv): FlattenedData {
  const contracts: FlattenedData = {};
  for (let contract in env.contractMap) {
    if (contract.startsWith('Liq') || contract.includes('RewardManager') || contract.includes('Forge')) continue;
    let name = replaceSpecialForgeName(env, contract)
      .split(/(?=[A-Z])/)
      .join('_')
      .toUpperCase();
    name = applySpecialRuleForNames(name);
    contracts[name] = env.contractMap[contract].address;
  }
  return contracts;
}

async function mapFlattenedNamesToId(env: PendleEnv): Promise<void> {
  await mapYOTokenNames(env);
}

export async function getFlattenedInfo(env: PendleEnv) {
  await mapFlattenedNamesToId(env);
  let data: FlattenedData = {
    ...(await getFlattenedYieldContractsInfo(env)),
    ...(await getFlattenedYTPools(env)),
    ...(await getFlattenedOTPools(env)),
    ...getFlattenedGeneralContracts(env),
    ...(await getFlattenedBasicTokens(env)),
    ...(await getDetailedBasicTokens()),
  };
  return data;
}
