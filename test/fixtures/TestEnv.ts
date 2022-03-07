import { Erc20Token, MiscConsts, PendleConstsType, TokensConstsType } from '@pendle/constants';
import { assert } from 'chai';
import { BigNumber as BN, Contract, Wallet } from 'ethers';
import { waffle } from 'hardhat';
import {
  addFakeIncomeBenQiDAI,
  addFakeIncomeCompoundUSDT,
  addFakeIncomeSushi,
  addFakeIncomeTraderJoe,
  addFakeIncomeXJoe,
  advanceTime,
  getA2Token,
  getCContract,
  getQiContract,
  LiqParams,
  teConsts,
} from '../helpers';
import { getContract, PendleEnv } from '../../pendle-deployment-scripts';
import { PendleMerkleDistributor, PendleRedeemProxyETHDep1, PendleRedeemProxyMulti } from '../../typechain-types';

export enum Mode {
  AAVE_V2 = 1,
  COMPOUND,
  SUSHISWAP_COMPLEX,
  SUSHISWAP_SIMPLE,
  SLP_LIQ,
  UNISWAPV2,
  BENQI,
  TRADER_JOE,
  JLP_LIQ,
  XJOE,
  WONDERLAND,
  GENERAL_TEST, // must only be enabled when all other modes are enabled
}

let enabledMode: Map<Mode, boolean> = new Map<number, boolean>();
for (let x of [
  // Mode.AAVE_V2,
  // Mode.COMPOUND,
  // Mode.COMPOUND_V2,
  // Mode.SUSHISWAP_COMPLEX,
  // Mode.SUSHISWAP_SIMPLE,
  // Mode.SLP_LIQ,
  // Mode.UNISWAPV2,
  Mode.BENQI,
  Mode.TRADER_JOE,
  Mode.XJOE,
  Mode.WONDERLAND,
  // Mode.GENERAL_TEST,
  // Mode.JLP_LIQ, // NOT IN PRODUCTION USE
]) {
  enabledMode.set(x, true);
}

export function checkDisabled(mode: Mode): boolean {
  return !enabledMode.get(mode)!;
}

export let wallets = waffle.provider.getWallets();

export type TestEnv = CommonEnv &
  TokensEnv &
  AaveV2Env &
  CompoundEnv &
  SushiswapComplexEnv &
  SushiswapSimpleEnv &
  UniswapV2Env &
  BenQiEnv &
  TraderJoeEnv &
  XJoeEnv &
  WonderlandEnv;

interface CommonEnv {
  penv: PendleEnv;
  pconsts: PendleConstsType;
  ptokens: TokensConstsType;
  mode: Mode;

  router: Contract;
  data: Contract;
  pendleWrapper: Contract;

  redeemProxyEth: PendleRedeemProxyETHDep1;
  redeemProxyAvax: PendleRedeemProxyMulti;
  treasury: Contract;
  marketReader: Contract;
  pausingManagerMain: Contract;
  pausingManagerLiqMining: Contract;
  pausingManagerLiqMiningV2: Contract;
  rewardManager: Contract;
  govManager: Contract;
  pendle: Contract;
  genMarketFactory: Contract;
  uniRouter: Contract;
  sushiRouter: Contract;
  joeRouter: Contract;
  wonderlandTimeStaking: Contract;

  forge: Contract;
  ot: Contract;
  ot18: Contract;
  ot8: Contract;
  xyt: Contract;
  xyt8: Contract;
  xyt18: Contract;
  yToken: Contract;
  testToken: Contract;
  market: Contract;
  market8: Contract;
  market18: Contract;
  marketEth: Contract;
  liq: Contract;
  liq8: Contract;
  liq18: Contract;
  sushiLiquidityMiningV2: Contract;
  joeLiquidityMiningV2: Contract;
  whitelist: Contract;
  merkleDistributor: PendleMerkleDistributor;

  MasterchefV1: Contract;
  joeMasterChefV2: Contract;
  masterChefRewardRedeemer: Contract;

  // mock pure contracts
  mockMarketMath: Contract;

  // test params
  MASTER_CHEF_PID: number;
  ETH_TEST: boolean;
  T0: BN;
  FORGE_ID: string;
  INITIAL_YIELD_TOKEN_AMOUNT: BN;
  TEST_DELTA: BN;
  EXPIRY: BN;
  MARKET_FACTORY_ID: string;
  liqParams: LiqParams;
  underlyingAsset: Erc20Token;
  underlyingTokens: Erc20Token[];
  eve: Wallet;

  // function
  addGenericForgeFakeIncome: any;
}

interface TokensEnv {
  USDTContract: Contract;
  WNativeContract: Contract;
  CVXContract: Contract;
  DAIContract: Contract;
  SUSHIContract: Contract;
  JOEContract: Contract;
  sushiPool: Contract;
  uniPool: Contract;
  joePool: Contract;
  xJoe: Contract;
  wMEMOContract: Contract;
  TIMEContract: Contract;
  MEMOContract: Contract;
}

interface AaveV2Env {
  a2Forge: Contract;
  aaveLendingPool: Contract;
  a2OwnershipToken: Contract;
  a2FutureYieldToken: Contract;
  a2OwnershipToken18: Contract;
  a2FutureYieldToken18: Contract;
  a2RewardManager: Contract;
  a2MarketFactory: Contract;
  a2Market: Contract;
  a2Market18: Contract;
  a2MarketEth: Contract;
  a2LiquidityMining: Contract;
  a2LiquidityMining18: Contract;
}

interface CompoundEnv {
  cForge: Contract;
  cOwnershipToken: Contract;
  cFutureYieldToken: Contract;
  cOwnershipToken8: Contract;
  cFutureYieldToken8: Contract;
  cRewardManager: Contract;
  cMarketFactory: Contract;
  cMarket: Contract;
  cMarketEth: Contract;
  cMarket8: Contract;
  cLiquidityMining: Contract;
  cLiquidityMining8: Contract;
}

interface SushiswapComplexEnv {
  scForge: Contract;
  scOwnershipToken: Contract;
  scFutureYieldToken: Contract;
  scRewardManager: Contract;
  scMarket: Contract;
  scLiquidityMining: Contract;
}

interface SushiswapSimpleEnv {
  ssForge: Contract;
  ssOwnershipToken: Contract;
  ssFutureYieldToken: Contract;
  ssRewardManager: Contract;
  ssMarket: Contract;
  ssLiquidityMining: Contract;
}

interface UniswapV2Env {
  uniForge: Contract;
  uniOwnershipToken: Contract;
  uniFutureYieldToken: Contract;
  uniRewardManager: Contract;
  uniMarket: Contract;
}

interface BenQiEnv {
  benQiForge: Contract;
  benQiOtDAI: Contract;
  benQiYtDAI: Contract;
  benQiOtAvax: Contract;
  benQiYtAvax: Contract;
  benQiRewardManager: Contract;
  benQiMarketFactory: Contract;
  benQiMarket: Contract;
  benQiLiquidityMining: Contract;
}

interface TraderJoeEnv {
  joeForge: Contract;
  joeOwnershipToken: Contract;
  joeFutureYieldToken: Contract;
  joeRewardManager: Contract;
  joeMarketFactory: Contract;
  joeMarket: Contract;
  joeLiquididtyMining: Contract;
  joeRewardRedeemer: Contract;
}

interface XJoeEnv {
  xJoeForge: Contract;
  xJoeOwnershipToken: Contract;
  xJoeFutureYieldToken: Contract;
  xJoeRewardManager: Contract;
  xJoeMarketFactory: Contract;
  xJoeMarket: Contract;
  xJoeLiquidityMining: Contract;
  xJoeRewardRedeemer: Contract;
}
interface WonderlandEnv {
  wonderlandForge: Contract;
  wonderlandOwnershipToken: Contract;
  wonderlandFutureYieldToken: Contract;
  wonderlandRewardManager: Contract;
  wonderlandMarketFactory: Contract;
  wonderlandMarket: Contract;
  wonderlandLiquidityMining: Contract;
  wonderlandRewardRedeemer: Contract;
}

export async function parseTestEnvRouterFixture(env: TestEnv, mode: Mode) {
  let tokens = env.ptokens;
  let consts = env.pconsts;
  env.mode = mode;
  if (env.mode == Mode.AAVE_V2) {
    env.T0 = teConsts.T0_A2;
    env.EXPIRY = env.T0.add(env.pconsts.misc.SIX_MONTH);
    env.forge = env.a2Forge;
    env.ot = env.a2OwnershipToken;
    env.ot18 = env.a2OwnershipToken18;
    env.xyt = env.a2FutureYieldToken;
    env.xyt18 = env.a2FutureYieldToken18;
    env.rewardManager = env.a2RewardManager;
    env.yToken = await getA2Token(env, tokens.USDT!);
    env.FORGE_ID = consts.aave!.FORGE_ID;
    env.INITIAL_YIELD_TOKEN_AMOUNT = teConsts.INITIAL_AAVE_TOKEN_AMOUNT;
    env.underlyingAsset = tokens.USDT!;
  } else if (env.mode == Mode.COMPOUND) {
    env.T0 = teConsts.T0_C;
    env.EXPIRY = env.T0.add(env.pconsts.misc.SIX_MONTH);
    env.forge = env.cForge;
    env.ot = env.cOwnershipToken;
    env.xyt = env.cFutureYieldToken;
    env.ot8 = env.cOwnershipToken8;
    env.xyt8 = env.cFutureYieldToken8;
    // no ot18, xyt18
    env.rewardManager = env.cRewardManager;
    env.yToken = await getCContract(env, tokens.USDT!);
    env.FORGE_ID = consts.compound!.FORGE_ID_V1;
    env.INITIAL_YIELD_TOKEN_AMOUNT = teConsts.INITIAL_COMPOUND_TOKEN_AMOUNT;
    env.underlyingAsset = tokens.USDT!;
    env.addGenericForgeFakeIncome = addFakeIncomeCompoundUSDT;
  } else if (env.mode == Mode.SUSHISWAP_COMPLEX || env.mode == Mode.SLP_LIQ) {
    env.T0 = teConsts.T0_SC;
    env.EXPIRY = env.T0.add(env.pconsts.misc.SIX_MONTH);
    env.forge = env.scForge;
    env.ot = env.scOwnershipToken;
    // env.ot18 = env.scOwnershipToken18;
    env.xyt = env.scFutureYieldToken;
    // env.xyt18 = env.scFutureYieldToken18;
    env.rewardManager = env.scRewardManager;
    env.yToken = env.sushiPool;
    env.FORGE_ID = consts.sushi!.FORGE_ID_COMPLEX;
    env.INITIAL_YIELD_TOKEN_AMOUNT = teConsts.INITIAL_SUSHI_TOKEN_AMOUNT;
    env.underlyingAsset = { address: tokens.SUSHI_USDT_WETH_LP!.address, decimal: 12 }; // maybe 18
    env.underlyingTokens = [tokens.USDT!, tokens.WNATIVE];
    env.addGenericForgeFakeIncome = addFakeIncomeSushi;
  } else if (env.mode == Mode.SUSHISWAP_SIMPLE) {
    env.T0 = teConsts.T0_SS;
    env.EXPIRY = env.T0.add(env.pconsts.misc.SIX_MONTH);
    env.forge = env.ssForge;
    env.ot = env.ssOwnershipToken;
    env.xyt = env.ssFutureYieldToken;
    env.rewardManager = env.ssRewardManager;
    env.yToken = await getContract('ERC20', tokens.SUSHI_USDT_WETH_LP!.address);
    env.FORGE_ID = consts.sushi!.FORGE_ID_SIMPLE;
    env.INITIAL_YIELD_TOKEN_AMOUNT = teConsts.INITIAL_SUSHI_TOKEN_AMOUNT;
    env.underlyingAsset = { address: tokens.SUSHI_USDT_WETH_LP!.address, decimal: 12 }; // maybe 18
    env.underlyingTokens = [tokens.USDT!, tokens.WNATIVE];
    env.addGenericForgeFakeIncome = addFakeIncomeSushi;
  } else if (env.mode == Mode.UNISWAPV2) {
    env.T0 = teConsts.T0_UNI;
    env.EXPIRY = env.T0.add(env.pconsts.misc.SIX_MONTH);
    env.forge = env.uniForge;
    env.ot = env.uniOwnershipToken;
    env.xyt = env.uniFutureYieldToken;
    env.rewardManager = env.uniRewardManager;
    env.yToken = await getContract('ERC20', tokens.UNI_USDT_WETH_LP!.address);
    env.FORGE_ID = consts.uni!.FORGE_ID;
    env.INITIAL_YIELD_TOKEN_AMOUNT = teConsts.INITIAL_SUSHI_TOKEN_AMOUNT;
    env.underlyingAsset = { address: tokens.UNI_USDT_WETH_LP!.address, decimal: 18 };
    env.underlyingTokens = [tokens.USDT!, tokens.WNATIVE];
  } else if (mode == Mode.BENQI) {
    env.T0 = teConsts.T0_B;
    env.EXPIRY = env.T0.add(env.pconsts.misc.SIX_MONTH);
    env.forge = env.benQiForge;
    env.ot = env.benQiOtDAI;
    env.xyt = env.benQiYtDAI;
    env.rewardManager = env.benQiRewardManager;
    env.yToken = await getQiContract(tokens.DAI!);
    env.FORGE_ID = env.pconsts.benqi!.FORGE_ID;
    env.INITIAL_YIELD_TOKEN_AMOUNT = teConsts.INITIAL_BENQI_DAI_AMOUNT;
    env.underlyingAsset = tokens.DAI!;
    env.addGenericForgeFakeIncome = addFakeIncomeBenQiDAI;
  } else if (mode == Mode.TRADER_JOE || mode == Mode.JLP_LIQ || mode == Mode.GENERAL_TEST) {
    env.T0 = teConsts.T0_TJ;
    env.EXPIRY = env.T0.add(env.pconsts.misc.SIX_MONTH);
    env.forge = env.joeForge;
    env.ot = env.joeOwnershipToken;
    env.xyt = env.joeFutureYieldToken;
    env.rewardManager = env.joeRewardManager;
    env.yToken = env.joePool;
    env.FORGE_ID = consts.joe!.FORGE_ID_COMPLEX;
    env.INITIAL_YIELD_TOKEN_AMOUNT = teConsts.INITIAL_JOE_TOKEN_AMOUNT;
    env.underlyingAsset = { address: tokens.JOE_WAVAX_DAI_LP!.address, decimal: 18 };
    env.underlyingTokens = [tokens.WNATIVE!, tokens.DAI!];
    env.addGenericForgeFakeIncome = addFakeIncomeTraderJoe;
    env.MASTER_CHEF_PID = tokens.JOE_WAVAX_DAI_LP!.pid!;
    env.masterChefRewardRedeemer = env.joeRewardRedeemer;
  } else if (mode == Mode.XJOE) {
    env.T0 = teConsts.T0_XJ;
    env.EXPIRY = env.T0.add(env.pconsts.misc.SIX_MONTH);
    env.forge = env.xJoeForge;
    env.ot = env.xJoeOwnershipToken;
    env.xyt = env.xJoeFutureYieldToken;
    env.rewardManager = env.xJoeRewardManager;
    env.yToken = env.xJoe;
    env.FORGE_ID = consts.joe!.FORGE_ID_XJOE;
    env.INITIAL_YIELD_TOKEN_AMOUNT = teConsts.INITIAL_xJOE_AMOUNT;
    env.underlyingAsset = tokens.JOE!;
    env.addGenericForgeFakeIncome = addFakeIncomeXJoe;
    env.MASTER_CHEF_PID = tokens.XJOE!.pid!;
    env.masterChefRewardRedeemer = env.xJoeRewardRedeemer;
  } else if (mode == Mode.WONDERLAND) {
    env.T0 = teConsts.T0_WM;
    env.EXPIRY = env.T0.add(env.pconsts.misc.SIX_MONTH);
    env.forge = env.wonderlandForge;
    env.ot = env.wonderlandOwnershipToken;
    env.xyt = env.wonderlandFutureYieldToken;
    env.rewardManager = env.wonderlandRewardManager;
    env.yToken = env.wMEMOContract;
    env.FORGE_ID = consts.wonderland!.FORGE_ID;
    env.INITIAL_YIELD_TOKEN_AMOUNT = teConsts.INITIAL_wMEMO_TOKEN_AMOUNT;
    env.underlyingAsset = tokens.MEMO!;
    env.addGenericForgeFakeIncome = async (env: TestEnv) => {
      await advanceTime(MiscConsts.ONE_HOUR.mul(9));
      await env.wonderlandTimeStaking.rebase();
    };
  } else {
    assert(false, 'NOT SUPPORTED');
  }
}

export async function parseTestEnvMarketFixture(env: TestEnv, mode: Mode) {
  let consts = env.pconsts;
  env.mode = mode;
  await parseTestEnvRouterFixture(env, mode);

  if (env.mode == Mode.AAVE_V2) {
    env.MARKET_FACTORY_ID = consts.aave!.MARKET_FACTORY_ID;
    env.market = env.a2Market;
    env.market18 = env.a2Market18;
    env.marketEth = env.a2MarketEth;
  } else if (env.mode == Mode.COMPOUND) {
    env.MARKET_FACTORY_ID = consts.compound!.MARKET_FACTORY_ID;
    env.market = env.cMarket;
    env.market8 = env.cMarket8;
    env.marketEth = env.cMarketEth;
    // no market18
  } else if (env.mode == Mode.SUSHISWAP_COMPLEX || env.mode == Mode.SLP_LIQ) {
    env.MARKET_FACTORY_ID = consts.common.GENERIC_MARKET_FACTORY_ID;
    env.market = env.scMarket;
  } else if (env.mode == Mode.SUSHISWAP_SIMPLE) {
    env.MARKET_FACTORY_ID = consts.common.GENERIC_MARKET_FACTORY_ID;
    env.market = env.ssMarket;
  } else if (env.mode == Mode.UNISWAPV2) {
    env.MARKET_FACTORY_ID = consts.common.GENERIC_MARKET_FACTORY_ID;
    env.market = env.uniMarket;
  } else if (mode == Mode.BENQI) {
    env.MARKET_FACTORY_ID = consts.common.GENERIC_MARKET_FACTORY_ID;
    env.market = env.benQiMarket;
  } else if (mode == Mode.TRADER_JOE || env.mode == Mode.JLP_LIQ || mode == Mode.GENERAL_TEST) {
    env.MARKET_FACTORY_ID = consts.common.GENERIC_MARKET_FACTORY_ID;
    env.market = env.joeMarket;
  } else if (env.mode == Mode.XJOE) {
    env.MARKET_FACTORY_ID = consts.common.GENERIC_MARKET_FACTORY_ID;
    env.market = env.xJoeMarket;
  } else if (env.mode == Mode.WONDERLAND) {
    env.MARKET_FACTORY_ID = consts.common.GENERIC_MARKET_FACTORY_ID;
    env.market = env.wonderlandMarket;
  } else {
    assert(false, 'NOT SUPPORTED');
  }
}

export async function parseTestEnvLiquidityMiningFixture(env: TestEnv, mode: Mode) {
  env.mode = mode;
  await parseTestEnvMarketFixture(env, mode);

  if (env.mode == Mode.AAVE_V2 || env.mode == Mode.GENERAL_TEST) {
    env.liq = env.a2LiquidityMining;
    env.liq18 = env.a2LiquidityMining18;
  } else if (env.mode == Mode.COMPOUND) {
    env.liq = env.cLiquidityMining;
    env.liq8 = env.cLiquidityMining8;
    // no liq18
  } else if (env.mode == Mode.SUSHISWAP_COMPLEX) {
    env.liq = env.scLiquidityMining;
  } else if (env.mode == Mode.SUSHISWAP_SIMPLE) {
    env.liq = env.ssLiquidityMining;
  } else if (env.mode == Mode.SLP_LIQ) {
    env.liq = env.sushiLiquidityMiningV2;
  } else if (env.mode == Mode.BENQI) {
    env.liq = env.benQiLiquidityMining;
  } else if (env.mode == Mode.TRADER_JOE) {
    env.liq = env.joeLiquididtyMining;
  } else if (env.mode == Mode.JLP_LIQ) {
    env.liq = env.joeLiquidityMiningV2;
  } else if (env.mode == Mode.XJOE) {
    env.liq = env.xJoeLiquidityMining;
  } else if (env.mode == Mode.WONDERLAND) {
    env.liq = env.wonderlandLiquidityMining;
  } else {
    assert(false, 'NOT SUPPORTED');
  }
}
