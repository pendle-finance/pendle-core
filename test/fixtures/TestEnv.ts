import { assert } from 'chai';
import { BigNumber as BN, Contract, Wallet } from 'ethers';
import IUniswapV2Pair from '../../build/artifacts/contracts/interfaces/IUniswapV2Pair.sol/IUniswapV2Pair.json';
import { consts, getA2Contract, getCContract, getERC20Contract, Token, tokens } from '../helpers';
import { CoreFixture } from './core.fixture';
import { LiqParams, LiquidityMiningFixture } from './liquidityMining.fixture';
import { MarketFixture } from './market.fixture';
import { RouterFixture } from './router.fixture';

const { waffle, network } = require('hardhat');
// const { provider } = waffle;

let wallets = [];
let alice: Wallet;
let bob: Wallet;
let charlie: Wallet;
let dave: Wallet;
let eve: Wallet;

if (network.name == 'hardhat') {
  wallets = waffle.provider.getWallets();
  [alice, bob, charlie, dave, eve] = wallets;
}

export enum Mode {
  AAVE_V2 = 1,
  COMPOUND,
  COMPOUND_V2,
  SUSHISWAP_COMPLEX,
  SUSHISWAP_SIMPLE,
  SLP_LIQ,
  GENERAL_TEST, // must only be enabled when all other modes are enabled
}

let disabledModes: Map<Mode, boolean> = new Map<number, boolean>();
for (let x of [Mode.AAVE_V2, Mode.COMPOUND, Mode.GENERAL_TEST]) {
  disabledModes.set(x, true);
}

export function checkDisabled(mode: Mode): boolean {
  return disabledModes.get(mode)!;
}

export interface TestEnv {
  mode: Mode;

  // common contracts
  router: Contract;
  data: Contract;
  treasury: Contract;
  marketReader: Contract;
  pausingManager: Contract;
  rewardManager: Contract;
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
  pdl: Contract;
  liq: Contract;
  liq8: Contract;
  liq18: Contract;
  USDTContract: Contract;
  WETHContract: Contract;
  sushiPool: Contract;

  // mock pure contracts
  mockMarketMath: Contract;

  // test params
  ETH_TEST: boolean;
  T0: BN;
  FORGE_ID: string;
  INITIAL_YIELD_TOKEN_AMOUNT: BN;
  TEST_DELTA: BN;
  EXPIRY: BN;
  MARKET_FACTORY_ID: string;
  liqParams: LiqParams;
  underlyingAsset: Token;

  // fixture
  routerFixture: RouterFixture;
  marketFixture: MarketFixture;
  liqMiningFixture: LiquidityMiningFixture;
}

export async function parseTestEnvCoreFixture(env: TestEnv, user: Wallet, fixture: CoreFixture) {
  env.router = fixture.router;
  env.data = fixture.data;
  env.treasury = fixture.treasury;
  env.marketReader = fixture.marketReader;
  env.pausingManager = fixture.pausingManager;
  env.marketReader = fixture.marketReader;
  env.USDTContract = await getERC20Contract(user, tokens.USDT);
  env.WETHContract = await getERC20Contract(user, tokens.WETH);
  env.ETH_TEST = false;
  env.sushiPool = new Contract(tokens.SUSHI_USDT_WETH_LP.address, IUniswapV2Pair.abi, alice);
}

export async function parseTestEnvRouterFixture(user: Wallet, mode: Mode, env: TestEnv, fixture: RouterFixture) {
  env.mode = mode;
  await parseTestEnvCoreFixture(env, user, fixture.core);

  env.routerFixture = fixture;
  if (env.mode == Mode.AAVE_V2) {
    env.T0 = consts.T0_A2;
    env.EXPIRY = env.T0.add(consts.SIX_MONTH);
    env.forge = fixture.a2Forge.aaveV2Forge;
    env.ot = fixture.a2Forge.a2OwnershipToken;
    env.ot18 = fixture.a2Forge.a2OwnershipToken18;
    env.xyt = fixture.a2Forge.a2FutureYieldToken;
    env.xyt18 = fixture.a2Forge.a2FutureYieldToken18;
    env.rewardManager = fixture.a2Forge.a2RewardManager;
    env.yToken = await getA2Contract(user, env.forge, tokens.USDT);
    env.FORGE_ID = consts.FORGE_AAVE_V2;
    env.INITIAL_YIELD_TOKEN_AMOUNT = consts.INITIAL_AAVE_TOKEN_AMOUNT;
    env.underlyingAsset = tokens.USDT;
  } else if (env.mode == Mode.COMPOUND) {
    env.T0 = consts.T0_C;
    env.EXPIRY = env.T0.add(consts.SIX_MONTH);
    env.forge = fixture.cForge.compoundForge;
    env.ot = fixture.cForge.cOwnershipToken;
    env.xyt = fixture.cForge.cFutureYieldToken;
    env.ot8 = fixture.cForge.cOwnershipToken8;
    env.xyt8 = fixture.cForge.cFutureYieldToken8;
    // no ot18, xyt18
    env.rewardManager = fixture.cForge.cRewardManager;
    env.yToken = await getCContract(user, tokens.USDT);
    env.FORGE_ID = consts.FORGE_COMPOUND;
    env.INITIAL_YIELD_TOKEN_AMOUNT = consts.INITIAL_COMPOUND_TOKEN_AMOUNT;
    env.underlyingAsset = tokens.USDT;
  } else if (env.mode == Mode.COMPOUND_V2) {
    env.T0 = consts.T0_C2;
    env.EXPIRY = env.T0.add(consts.SIX_MONTH);
    env.forge = fixture.c2Forge.compoundV2Forge;
    env.ot = fixture.c2Forge.c2OwnershipToken;
    env.xyt = fixture.c2Forge.c2FutureYieldToken;
    env.ot8 = fixture.c2Forge.c2OwnershipToken8;
    env.xyt8 = fixture.c2Forge.c2FutureYieldToken8;
    // no ot18, xyt18
    env.rewardManager = fixture.c2Forge.c2RewardManager;
    env.yToken = await getCContract(user, tokens.USDT);
    env.FORGE_ID = consts.FORGE_COMPOUND_V2;
    env.INITIAL_YIELD_TOKEN_AMOUNT = consts.INITIAL_COMPOUND_TOKEN_AMOUNT;
    env.underlyingAsset = tokens.USDT;
  } else if (env.mode == Mode.SUSHISWAP_COMPLEX || env.mode == Mode.SLP_LIQ) {
    env.T0 = consts.T0_SC;
    env.EXPIRY = env.T0.add(consts.SIX_MONTH);
    env.forge = fixture.scForge.sushiswapComplexForge;
    env.ot = fixture.scForge.scOwnershipToken;
    // env.ot18 = fixture.scForge.scOwnershipToken18;
    env.xyt = fixture.scForge.scFutureYieldToken;
    // env.xyt18 = fixture.scForge.scFutureYieldToken18;
    env.rewardManager = fixture.scForge.scRewardManager;
    env.yToken = await getERC20Contract(user, tokens.SUSHI_USDT_WETH_LP);
    env.FORGE_ID = consts.FORGE_SUSHISWAP_COMPLEX;
    env.INITIAL_YIELD_TOKEN_AMOUNT = consts.INITIAL_SUSHI_TOKEN_AMOUNT;
    env.underlyingAsset = tokens.SUSHI_USDT_WETH_LP;

    for (var person of [alice, bob, charlie, dave, eve]) {
      await env.USDTContract.connect(person).approve(consts.SUSHISWAP_ROUTER_ADDRESS, 0, consts.HG);
      await env.WETHContract.connect(person).approve(consts.SUSHISWAP_ROUTER_ADDRESS, 0, consts.HG);
      await env.USDTContract.connect(person).approve(consts.SUSHISWAP_ROUTER_ADDRESS, consts.INF, consts.HG);
      await env.WETHContract.connect(person).approve(consts.SUSHISWAP_ROUTER_ADDRESS, consts.INF, consts.HG);
    }
  } else if (env.mode == Mode.SUSHISWAP_SIMPLE) {
    env.T0 = consts.T0_SS;
    env.EXPIRY = env.T0.add(consts.SIX_MONTH);
    env.forge = fixture.ssForge.sushiswapSimpleForge;
    env.ot = fixture.ssForge.ssOwnershipToken;
    env.xyt = fixture.ssForge.ssFutureYieldToken;
    env.rewardManager = fixture.ssForge.ssRewardManager;
    env.yToken = await getERC20Contract(user, tokens.SUSHI_USDT_WETH_LP);

    env.FORGE_ID = consts.FORGE_SUSHISWAP_SIMPLE;
    env.INITIAL_YIELD_TOKEN_AMOUNT = consts.INITIAL_SUSHI_TOKEN_AMOUNT;
    env.underlyingAsset = tokens.SUSHI_USDT_WETH_LP;
    for (var person of [alice, bob, charlie, dave, eve]) {
      await env.USDTContract.connect(person).approve(consts.SUSHISWAP_ROUTER_ADDRESS, 0, consts.HG);
      await env.WETHContract.connect(person).approve(consts.SUSHISWAP_ROUTER_ADDRESS, 0, consts.HG);
      await env.USDTContract.connect(person).approve(consts.SUSHISWAP_ROUTER_ADDRESS, consts.INF, consts.HG);
      await env.WETHContract.connect(person).approve(consts.SUSHISWAP_ROUTER_ADDRESS, consts.INF, consts.HG);
    }
  } else {
    assert(false, 'NOT SUPPORTED');
  }
}

export async function parseTestEnvMarketFixture(user: Wallet, mode: Mode, env: TestEnv, fixture: MarketFixture) {
  env.mode = mode;
  await parseTestEnvRouterFixture(user, mode, env, fixture.routerFix);

  env.mockMarketMath = fixture.mockMarketMath;
  env.testToken = fixture.testToken;
  env.marketFixture = fixture;

  if (env.mode == Mode.AAVE_V2) {
    env.MARKET_FACTORY_ID = consts.MARKET_FACTORY_AAVE_V2;
    env.market = fixture.a2Market;
    env.market18 = fixture.a2Market18;
    env.marketEth = fixture.a2MarketEth;
  } else if (env.mode == Mode.COMPOUND) {
    env.MARKET_FACTORY_ID = consts.MARKET_FACTORY_COMPOUND;
    env.market = fixture.cMarket;
    env.market8 = fixture.cMarket8;
    env.marketEth = fixture.cMarketEth;
    // no market18
  } else if (env.mode == Mode.COMPOUND_V2) {
    env.MARKET_FACTORY_ID = consts.MARKET_FACTORY_GENERIC;
    env.market = fixture.c2Market;
    env.market8 = fixture.c2Market8;
  } else if (env.mode == Mode.SUSHISWAP_COMPLEX || env.mode == Mode.SLP_LIQ) {
    env.MARKET_FACTORY_ID = consts.MARKET_FACTORY_GENERIC;
    env.market = fixture.scMarket;
    // env.market18 = fixture.a2Market18;
    // env.marketEth = fixture.a2MarketEth;
  } else if (env.mode == Mode.SUSHISWAP_SIMPLE) {
    env.MARKET_FACTORY_ID = consts.MARKET_FACTORY_GENERIC;
    env.market = fixture.ssMarket;
  } else {
    assert(false, 'NOT SUPPORTED');
  }
}

export async function parseTestEnvLiquidityMiningFixture(
  user: Wallet,
  mode: Mode,
  env: TestEnv,
  fixture: LiquidityMiningFixture
) {
  env.mode = mode;
  await parseTestEnvMarketFixture(user, mode, env, fixture.marketFix);

  env.pdl = fixture.pdl;
  env.liqMiningFixture = fixture;
  env.liqParams = fixture.params;

  if (env.mode == Mode.AAVE_V2) {
    env.liq = fixture.a2LiquidityMining;
    env.liq18 = fixture.a2LiquidityMining18;
  } else if (env.mode == Mode.COMPOUND) {
    env.liq = fixture.cLiquidityMining;
    env.liq8 = fixture.cLiquidityMining8;
    // no liq18
  } else if (env.mode == Mode.COMPOUND_V2) {
    env.liq = fixture.c2LiquidityMining;
    env.liq8 = fixture.c2LiquidityMining8;
  } else if (env.mode == Mode.SUSHISWAP_COMPLEX) {
    env.liq = fixture.scLiquidityMining;
  } else if (env.mode == Mode.SUSHISWAP_SIMPLE) {
    env.liq = fixture.ssLiquidityMining;
  } else if (env.mode == Mode.SLP_LIQ) {
    env.liq = fixture.sushiLiquidityMiningV2;
  } else {
    assert(false, 'NOT SUPPORTED');
  }
}
