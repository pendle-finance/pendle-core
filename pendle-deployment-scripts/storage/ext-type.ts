import { BigNumber as BN } from 'ethers';
import { ContractMap, ForgeMap, SimpleTokenType } from '..';

export interface SingleYieldContract {
  OT: SimpleTokenType;
  YT: SimpleTokenType;

  underlyingAsset: SimpleTokenType;
  expiry: BN;
  yieldTokenHolder: string;

  start?: BN;
  balanceUnderlying?: BN;
}

export interface SingleMarket {
  address: string;
  factoryId: string;
  baseToken: SimpleTokenType;

  YT: SimpleTokenType;

  lockStartTime?: BN;

  balanceBaseToken?: BN;
  balanceYT?: BN;
  totalSupplyLP?: BN;
  pausingManager?: string;
}

export interface SingleOTMarket {
  address: string;
  baseToken: SimpleTokenType;
  OT: SimpleTokenType;

  balanceBaseToken: BN;
  balanceOT: BN;
  totalSupplyLP: BN;
}

export interface SingleJoePool {
  address: string;
  token0: SimpleTokenType;
  token1: SimpleTokenType;

  reserve0: BN;
  reserve1: BN;
  totalSupplyLP: BN;
}

export interface SingleLiq {
  address: string;

  startTime: BN;
  epochDuration: BN;
  vestingEpochs: BN;

  numberOfEpochs?: BN;
  currentEpoch?: BN;
  fundedFutureEpoch?: [BN, BN][];
}

export interface SingleLiqYT extends SingleLiq {
  baseToken: SimpleTokenType;

  underlyingAsset: SimpleTokenType;

  expiriesData?: { expiry: BN; alloc: BN; lpHolder: string; lpBalance: BN }[];
}

export interface SingleLiqOT extends SingleLiq {
  stakeToken: SimpleTokenType;

  yieldTokens: SimpleTokenType[];

  rewardTokensHolder?: string;

  balanceStakeToken?: BN;
}

export interface SingleForge {
  address: string;
  rewardManager: string;
  forgeId: string;
  pausingManager?: string;
}

export interface Forge {
  forgeInfo: SingleForge;
  yieldContracts: SingleYieldContract[];

  markets: SingleMarket[];

  liqYTs: SingleLiqYT[];

  liqOTs: SingleLiqOT[];
}

export interface YOToken extends SimpleTokenType {
  forge: string;
  underlyingAsset: SimpleTokenType;
  start: BN;
  expiry: BN;
  underlyingYieldToken: SimpleTokenType;
  yieldTokenHolder: string;
  rewardManager: string;
}

export interface PendleData {
  forgeFee: BN;
  interestUpdateRateDeltaForMarket: BN;

  expiryDivisor: BN;

  swapFee: BN;
  protocolSwapFee: BN;

  lockNumerator: BN;
  lockDenominator: BN;
  curveShiftBlockDelta: BN;
}

export interface SavedData {
  dataParams?: PendleData;
  contractMap: ContractMap;
  forgeMap: ForgeMap;
}

export type FlattenedData = Record<string, any>;

export class CaseInsensitiveRecord<V> {
  mset: Record<string, V>;
  constructor() {
    this.mset = {};
  }
  set(key: string, value: V): void {
    this.mset[key.toLowerCase()] = value;
  }
  get(key: string): V {
    return this.mset[key.toLowerCase()];
  }
}
