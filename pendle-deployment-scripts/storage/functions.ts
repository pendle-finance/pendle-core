import { cloneDeep } from 'lodash';
import { MiscConsts } from '@pendle/constants';
import { BigNumber as BN, Contract } from 'ethers';
import path from 'path';
import {
  PendleData,
  SavedData,
  SingleForge,
  SingleJoePool,
  SingleLiqOT,
  SingleLiqYT,
  SingleMarket,
  SingleOTMarket,
} from '.';
import { getBalanceToken, getContract, getCurrentTime, isEth, YOToken } from '..';
import { DetailedTokenType, ForgeMap, PendleEnv, SimpleTokenType } from '../type';
import { IJoePair, IPendleForge } from '../../typechain-types';

export async function getInfoSimpleToken(addr: string): Promise<SimpleTokenType> {
  if (addr == MiscConsts.ZERO_ADDRESS) {
    return {} as SimpleTokenType;
  }
  let contract = await getContract('ERC20', addr);
  return {
    address: addr,
    symbol: await contract.symbol(),
  };
}

export async function getInfoDetailedToken(addr: string): Promise<DetailedTokenType> {
  if (addr == MiscConsts.ZERO_ADDRESS) {
    return {} as DetailedTokenType;
  }
  let contract = await getContract('ERC20', addr);
  return {
    address: addr,
    symbol: await contract.symbol(),
    decimal: await contract.decimals(),
    name: await contract.name(),
  };
}

export async function getInfoMarket(env: PendleEnv, marketAddr: string): Promise<SingleMarket> {
  let market = await getContract('PendleMarketBase', marketAddr);

  let baseToken = await getInfoSimpleToken(await market.token());
  let YT = await getInfoSimpleToken(await market.xyt());
  let factoryId: string = await market.factoryId();
  return {
    address: marketAddr,
    baseToken,
    YT,
    factoryId,
    lockStartTime: await market.lockStartTime(),
    balanceBaseToken: await getBalanceToken(baseToken, marketAddr),
    balanceYT: await getBalanceToken(YT, marketAddr),
    totalSupplyLP: await market.totalSupply(),
    pausingManager: await env.pendleData.pausingManager(),
  };
}

export async function getInfoOTMarket(marketAddr: string): Promise<SingleOTMarket> {
  let market = await getContract('IJoePair', marketAddr);

  let baseToken = await getInfoSimpleToken(await market.token0());
  let OT = await getInfoSimpleToken(await market.token1());

  if (!OT.symbol.startsWith('OT')) {
    [baseToken, OT] = [OT, baseToken];
  }

  return {
    address: marketAddr,
    baseToken,
    OT,
    balanceBaseToken: await getBalanceToken(baseToken, marketAddr),
    balanceOT: await getBalanceToken(OT, marketAddr),
    totalSupplyLP: await market.totalSupply(),
  };
}

export async function getInfoJoePool(marketAddr: string): Promise<SingleJoePool> {
  let market = (await getContract('IJoePair', marketAddr)) as IJoePair;

  let { reserve0, reserve1 } = await market.getReserves();
  return {
    address: marketAddr,
    token0: await getInfoSimpleToken(await market.token0()),
    token1: await getInfoSimpleToken(await market.token1()),
    reserve0,
    reserve1,
    totalSupplyLP: await market.totalSupply(),
  };
}

export async function getCurrentEpochId(startTime: BN, epochDuration: BN) {
  let currentTime = BN.from(await getCurrentTime());
  if (currentTime < startTime) return BN.from(0);
  return currentTime.sub(startTime).div(epochDuration).add(1);
}

export async function getInfoLiqYT(env: PendleEnv, liqAddr: string) {
  let liq: Contract;
  if (isEth(env)) liq = await getContract('PendleGenericLiquidityMining', liqAddr);
  else liq = await getContract('PendleGenericLiquidityMiningMulti', liqAddr);

  let startTime = await liq.startTime();
  let epochDuration = await liq.epochDuration();
  let currentEpoch: BN;

  if (isEth(env)) currentEpoch = await getCurrentEpochId(startTime, epochDuration);
  else currentEpoch = await liq.getCurrentEpochId();

  let numberOfEpochs: BN = await liq.numberOfEpochs();
  let fundedFutureEpoch: [BN, BN][] = [];
  for (let i = currentEpoch; i <= numberOfEpochs; i = i.add(1)) {
    if (isEth(env)) {
      let { totalRewards: rewards }: { totalRewards: BN } = await liq.readEpochData(i);
      fundedFutureEpoch.push([rewards, BN.from(0)]);
    } else {
      let { totalRewards: rewards } = await liq.readEpochData(i);
      fundedFutureEpoch.push(rewards);
    }
  }

  let expiries: Set<number> = new Set();
  for (let forgeId in env.forgeMap) {
    for (let yieldContract of env.forgeMap[forgeId].yieldContracts) {
      let expiry = (await getInfoYO(yieldContract.YT.address)).expiry;
      expiries.add(expiry.toNumber());
    }
  }

  let expiriesData: { expiry: BN; alloc: BN; lpHolder: string; lpBalance: BN }[] = [];
  let [lastestSettingId] = await liq.latestSetting();
  for (let expiry of expiries) {
    let alloc: BN = await liq.allocationSettings(lastestSettingId, expiry);
    if (alloc.eq(0)) continue;

    let lpHolderAddr: string = await liq.callStatic.lpHolderForExpiry(expiry);
    let lpBalance: BN = BN.from(0);
    if (lpHolderAddr != MiscConsts.ZERO_ADDRESS) {
      let lpHolder = await getContract('PendleLpHolder', lpHolderAddr);
      let lpTokenAddr: string = await lpHolder.pendleMarket();
      let lpToken = await getContract('PendleMarketBase', lpTokenAddr);
      lpBalance = await lpToken.callStatic.balanceOf(lpHolderAddr);
    }
    expiriesData.push({ expiry: BN.from(expiry), alloc, lpHolder: lpHolderAddr, lpBalance });
  }

  let res: SingleLiqYT = {
    address: liqAddr,
    baseToken: await getInfoSimpleToken(await liq.baseToken()),
    underlyingAsset: await getInfoSimpleToken(await liq.underlyingAsset()),
    startTime,
    epochDuration,
    vestingEpochs: await liq.vestingEpochs(),
    numberOfEpochs,
    currentEpoch,
    fundedFutureEpoch,
    expiriesData: expiriesData,
  };

  return res;
}

export async function getInfoLiqOT(env: PendleEnv, liqAddr: string) {
  let liq: Contract;
  if (isEth(env)) liq = await getContract('PendleLiquidityMiningBaseV2', liqAddr);
  else liq = await getContract('PendleLiquidityMiningBaseV2Multi', liqAddr);

  let startTime = await liq.startTime();
  let epochDuration = await liq.epochDuration();
  let currentEpoch: BN;

  if (isEth(env)) currentEpoch = await getCurrentEpochId(startTime, epochDuration);
  else currentEpoch = await liq.getCurrentEpochId();

  let numberOfEpochs: BN = await liq.numberOfEpochs();
  let fundedFutureEpoch: [BN, BN][] = [];
  for (let i = currentEpoch; i <= numberOfEpochs; i = i.add(1)) {
    if (isEth(env)) {
      let { totalRewards: rewards }: { totalRewards: BN } = await liq.readEpochData(i, MiscConsts.ZERO_ADDRESS);
      fundedFutureEpoch.push([rewards, BN.from(0)]);
    } else {
      let { totalRewards: rewards } = await liq.readEpochData(i, MiscConsts.ZERO_ADDRESS);
      fundedFutureEpoch.push(rewards);
    }
  }

  let yieldTokens: SimpleTokenType[];
  let rewardTokensHolder: string;
  if (isEth(env)) {
    yieldTokens = [await getInfoSimpleToken(await liq.yieldToken())];
    rewardTokensHolder = '';
  } else {
    let yieldTokenAddrs = await liq.yieldTokens();
    yieldTokens = [await getInfoSimpleToken(yieldTokenAddrs[0]), await getInfoSimpleToken(yieldTokenAddrs[1])];
    rewardTokensHolder = await liq.rewardTokensHolder();
  }

  let res: SingleLiqOT = {
    address: liqAddr,
    stakeToken: await getInfoSimpleToken(await liq.stakeToken()),
    yieldTokens,
    startTime,
    epochDuration,
    vestingEpochs: await liq.vestingEpochs(),
    numberOfEpochs,
    currentEpoch,
    fundedFutureEpoch,
    rewardTokensHolder,
  };

  return res;
}

export async function getInfoSingleForge(forgeAddr: string): Promise<SingleForge> {
  let forge = await getContract('PendleForgeBaseV2', forgeAddr);
  return {
    address: forgeAddr,
    forgeId: await forge.forgeId(),
    rewardManager: await forge.rewardManager(),
    pausingManager: await forge.pausingManager(),
  };
}

export async function getInfoYO(YOAddr: string): Promise<YOToken> {
  let YOToken = await getContract('PendleFutureYieldToken', YOAddr);
  let forgeAddr = await YOToken.forge();
  let underlyingAssetAddr = await YOToken.underlyingAsset();
  let underlyingYieldTokenAddr = await YOToken.underlyingYieldToken();
  let forge = await getContract('IPendleForge', forgeAddr);
  let expiry = await YOToken.expiry();
  return {
    address: YOAddr,
    symbol: await YOToken.symbol(),
    forge: await forgeAddr,
    underlyingAsset: await getInfoSimpleToken(underlyingAssetAddr),
    expiry,
    underlyingYieldToken: await getInfoSimpleToken(underlyingYieldTokenAddr),
    start: await YOToken.start(),
    yieldTokenHolder: await forge.yieldTokenHolders(underlyingAssetAddr, expiry),
    rewardManager: await forge.rewardManager(),
  };
}

export async function getInfoSimpleTokens(addrs: string[]): Promise<SimpleTokenType[]> {
  let res: SimpleTokenType[] = [];
  for (let addr of addrs) {
    res.push(await getInfoSimpleToken(addr));
  }
  return res;
}

export async function getForgeIdFromYO(YOAddr: string): Promise<string> {
  let YOInfo = await getInfoYO(YOAddr);
  let forgeInfo = await getInfoSingleForge(YOInfo.forge);
  return forgeInfo.forgeId;
}

export async function getForgeIdFromForge(forgeAddr: string): Promise<string> {
  let forge = (await getContract('IPendleForge', forgeAddr)) as IPendleForge;
  return await forge.forgeId();
}

export async function getInfoPendleData(pendleData: Contract) {
  let res = {} as PendleData;
  res.curveShiftBlockDelta = await pendleData.curveShiftBlockDelta();
  res.expiryDivisor = await pendleData.expiryDivisor();
  res.forgeFee = await pendleData.forgeFee();
  res.interestUpdateRateDeltaForMarket = await pendleData.interestUpdateRateDeltaForMarket();
  res.lockDenominator = await pendleData.lockDenominator();
  res.lockNumerator = await pendleData.lockNumerator();
  res.protocolSwapFee = await pendleData.protocolSwapFee();
  res.swapFee = await pendleData.swapFee();
  return res;
}

export async function fillInYieldContractsInfo(env: PendleEnv, res: ForgeMap) {
  for (let key in res) {
    for (let yieldContract of res[key].yieldContracts) {
      let OT = await getInfoYO(yieldContract.OT.address);

      let yieldBearingToken = OT.underlyingYieldToken!;

      if (key == 'xJoe') {
        let masterchef = await getContract('IJoeMasterChefV2', env.consts.joe!.MASTERCHEF_V2);
        let { amount: amount } = await masterchef.callStatic.userInfo(env.tokens.XJOE!.pid, OT.yieldTokenHolder!);
        yieldContract.balanceUnderlying = amount;
      } else {
        yieldContract.balanceUnderlying = await getBalanceToken(yieldBearingToken, OT.yieldTokenHolder);
      }
      yieldContract.start = OT.start;
      yieldContract.yieldTokenHolder = OT.yieldTokenHolder;
      yieldContract.expiry = OT.expiry;
    }
  }
}

export async function getInfoForgeMap(env: PendleEnv) {
  let forgeMap = env.forgeMap;
  let res: ForgeMap;
  res = cloneDeep(forgeMap);
  for (let key in res) {
    await fillInYieldContractsInfo(env, res);
    for (let i = 0; i < res[key].markets.length; i++) {
      res[key].markets[i] = await getInfoMarket(env, res[key].markets[i].address);
    }
    for (let i = 0; i < res[key].liqYTs.length; i++) {
      res[key].liqYTs[i] = await getInfoLiqYT(env, res[key].liqYTs[i].address);
    }
    for (let i = 0; i < res[key].liqOTs.length; i++) {
      res[key].liqOTs[i] = await getInfoLiqOT(env, res[key].liqOTs[i].address);
    }
  }
  return res;
}

export async function getUnderlyingYieldToken(forgeAddr: string, underlyingAddr: string): Promise<SimpleTokenType> {
  let forge = await getContract('IPendleForge', forgeAddr);
  return await getInfoSimpleToken(await forge.callStatic.getYieldBearingToken(underlyingAddr));
}

export function getPathForInfo(env: PendleEnv) {
  return path.resolve(__dirname, `../../build/onchain-data.json`);
}

export async function getInfoPendleEnv(env: PendleEnv) {
  let data = {} as SavedData;
  data.dataParams = await getInfoPendleData(env.pendleData);
  data.forgeMap = await getInfoForgeMap(env);
  return data;
}
