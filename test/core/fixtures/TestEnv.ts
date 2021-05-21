import { BigNumber as BN, Contract, Wallet } from "ethers";
import {
  consts, getA2Contract, getAContract, getCContract, tokens, getERC20Contract
} from "../../helpers";
import { CoreFixture } from "./core.fixture";
import { LiqParams, LiquidityMiningFixture } from "./liquidityMining.fixture";
import { MarketFixture } from "./market.fixture";
import { RouterFixture } from "./router.fixture";

export enum Mode {
  AAVE_V1 = 1,
  AAVE_V2,
  COMPOUND
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
  xyt: Contract;
  xyt2: Contract;
  yUSDT: Contract;
  testToken: Contract;
  market: Contract;
  marketEth: Contract;
  pdl: Contract;
  liq: Contract;
  USDTContract: Contract;

  // test params
  T0: BN;
  FORGE_ID: string;
  INITIAL_YIELD_TOKEN_AMOUNT: BN;
  TEST_DELTA: BN;
  EXPIRY: BN;
  MARKET_FACTORY_ID: string;
  liqParams: LiqParams;

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
  env.USDTContract = await getERC20Contract(alice, tokens.USDT)
}

export async function parseTestEnvRouterFixture(alice: Wallet, mode: Mode, env: TestEnv, fixture: RouterFixture) {
  env.mode = mode;
  await parseTestEnvCoreFixture(env, alice, fixture.core);

  env.routerFixture = fixture;
  if (env.mode == Mode.AAVE_V1) {
    env.T0 = consts.T0; env.EXPIRY = env.T0.add(consts.SIX_MONTH);
    env.forge = fixture.aForge.aaveForge;
    env.ot = fixture.aForge.aOwnershipToken;
    env.xyt = fixture.aForge.aFutureYieldToken;
    env.xyt2 = fixture.aForge.aFutureYieldToken2;
    env.rewardManager = fixture.aForge.aRewardManager;
    env.yUSDT = await getAContract(alice, env.forge, tokens.USDT);
    env.FORGE_ID = consts.FORGE_AAVE;
    env.INITIAL_YIELD_TOKEN_AMOUNT = consts.INITIAL_AAVE_TOKEN_AMOUNT;
  }
  else if (env.mode == Mode.AAVE_V2) {
    env.T0 = consts.T0_A2; env.EXPIRY = env.T0.add(consts.SIX_MONTH);
    env.forge = fixture.a2Forge.aaveV2Forge;
    env.ot = fixture.a2Forge.a2OwnershipToken;
    env.xyt = fixture.a2Forge.a2FutureYieldToken;
    env.xyt2 = fixture.a2Forge.a2FutureYieldToken2;
    env.rewardManager = fixture.a2Forge.a2RewardManager;
    env.yUSDT = await getA2Contract(alice, env.forge, tokens.USDT);
    env.FORGE_ID = consts.FORGE_AAVE_V2;
    env.INITIAL_YIELD_TOKEN_AMOUNT = consts.INITIAL_AAVE_TOKEN_AMOUNT;
  }
  else if (env.mode == Mode.COMPOUND) {
    env.T0 = consts.T0_C; env.EXPIRY = env.T0.add(consts.SIX_MONTH);
    env.forge = fixture.cForge.compoundForge;
    env.ot = fixture.cForge.cOwnershipToken;
    env.xyt = fixture.cForge.cFutureYieldToken;
    // no xyt2
    env.rewardManager = fixture.cForge.cRewardManager;
    env.yUSDT = await getCContract(alice, tokens.USDT);
    env.FORGE_ID = consts.FORGE_COMPOUND;
    env.INITIAL_YIELD_TOKEN_AMOUNT = consts.INITIAL_COMPOUND_TOKEN_AMOUNT;
  }
}

export async function parseTestEnvMarketFixture(alice: Wallet, mode: Mode, env: TestEnv, fixture: MarketFixture) {
  env.mode = mode;
  parseTestEnvRouterFixture(alice, mode, env, fixture.routerFix);

  env.testToken = fixture.testToken;
  env.marketFixture = fixture;

  if (env.mode == Mode.AAVE_V1) {
    env.MARKET_FACTORY_ID = consts.MARKET_FACTORY_AAVE;
    env.market = fixture.aMarket;
    env.marketEth = fixture.marketEth;
  }
  else if (env.mode == Mode.AAVE_V2) {
    env.MARKET_FACTORY_ID = consts.MARKET_FACTORY_AAVE_V2;
    env.market = fixture.a2Market;
    // no marketEth for AaveV2
  }
  else if (env.mode == Mode.COMPOUND) {
    env.MARKET_FACTORY_ID = consts.MARKET_FACTORY_COMPOUND;
    env.market = fixture.cMarket;
    // no marketEth for Compound
  }
}

export async function parseTestEnvLiquidityMiningFixture(alice: Wallet, mode: Mode, env: TestEnv, fixture: LiquidityMiningFixture) {
  env.mode = mode;
  parseTestEnvMarketFixture(alice, mode, env, fixture.marketFix);

  env.pdl = fixture.pdl;
  env.liqMiningFixture = fixture;
  env.liqParams = fixture.params;

  if (env.mode == Mode.AAVE_V1) {
    env.liq = fixture.aLiquidityMining;
  }
  else if (env.mode == Mode.AAVE_V2) {
  }
  else if (env.mode == Mode.COMPOUND) {
    env.liq = fixture.cLiquidityMining;
  }

}
