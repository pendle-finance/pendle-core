import { BigNumber as BN, Contract, Wallet } from 'ethers';
import { consts, getA2Contract, getCContract, getERC20Contract, Token, tokens } from '../../helpers';
import { CoreFixture } from './core.fixture';
import { LiqParams, LiquidityMiningFixture } from './liquidityMining.fixture';
import { MarketFixture } from './market.fixture';
import { RouterFixture } from './router.fixture';

export enum Mode {
  AAVE_V2 = 1,
  COMPOUND,
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
  xyt: Contract;
  xyt18: Contract;
  yToken: Contract;
  testToken: Contract;
  market: Contract;
  market18: Contract;
  marketEth: Contract;
  pdl: Contract;
  liq: Contract;
  liq18: Contract;
  USDTContract: Contract;

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

export async function parseTestEnvCoreFixture(env: TestEnv, alice: Wallet, fixture: CoreFixture) {
  env.router = fixture.router;
  env.data = fixture.data;
  env.treasury = fixture.treasury;
  env.marketReader = fixture.marketReader;
  env.pausingManager = fixture.pausingManager;
  env.marketReader = fixture.marketReader;
  env.USDTContract = await getERC20Contract(alice, tokens.USDT);
  env.underlyingAsset = tokens.USDT;
  env.ETH_TEST = false;
}

export async function parseTestEnvRouterFixture(alice: Wallet, mode: Mode, env: TestEnv, fixture: RouterFixture) {
  env.mode = mode;
  await parseTestEnvCoreFixture(env, alice, fixture.core);

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
    env.yToken = await getA2Contract(alice, env.forge, tokens.USDT);
    env.FORGE_ID = consts.FORGE_AAVE_V2;
    env.INITIAL_YIELD_TOKEN_AMOUNT = consts.INITIAL_AAVE_TOKEN_AMOUNT;
  } else if (env.mode == Mode.COMPOUND) {
    env.T0 = consts.T0_C;
    env.EXPIRY = env.T0.add(consts.SIX_MONTH);
    env.forge = fixture.cForge.compoundForge;
    env.ot = fixture.cForge.cOwnershipToken;
    env.xyt = fixture.cForge.cFutureYieldToken;
    // no ot18, xyt18
    env.rewardManager = fixture.cForge.cRewardManager;
    env.yToken = await getCContract(alice, tokens.USDT);
    env.FORGE_ID = consts.FORGE_COMPOUND;
    env.INITIAL_YIELD_TOKEN_AMOUNT = consts.INITIAL_COMPOUND_TOKEN_AMOUNT;
  }
}

export async function parseTestEnvMarketFixture(alice: Wallet, mode: Mode, env: TestEnv, fixture: MarketFixture) {
  env.mode = mode;
  await parseTestEnvRouterFixture(alice, mode, env, fixture.routerFix);

  env.mockMarketMath = fixture.mockMarketMath;
  env.testToken = fixture.testToken;
  env.marketFixture = fixture;

  if (env.mode == Mode.AAVE_V2) {
    env.MARKET_FACTORY_ID = consts.MARKET_FACTORY_AAVE_V2;
    env.market = fixture.a2Market;
    env.market18 = fixture.a2Market18;
    env.marketEth = fixture.marketEth;
  } else if (env.mode == Mode.COMPOUND) {
    env.MARKET_FACTORY_ID = consts.MARKET_FACTORY_COMPOUND;
    env.market = fixture.cMarket;
    // no market18
    // no marketEth for Compound
  }
}

export async function parseTestEnvLiquidityMiningFixture(
  alice: Wallet,
  mode: Mode,
  env: TestEnv,
  fixture: LiquidityMiningFixture
) {
  env.mode = mode;
  await parseTestEnvMarketFixture(alice, mode, env, fixture.marketFix);

  env.pdl = fixture.pdl;
  env.liqMiningFixture = fixture;
  env.liqParams = fixture.params;

  if (env.mode == Mode.AAVE_V2) {
    env.liq = fixture.a2LiquidityMining;
    env.liq18 = fixture.a2LiquidityMining18;
  } else if (env.mode == Mode.COMPOUND) {
    env.liq = fixture.cLiquidityMining;
    // no liq18
  }
}
