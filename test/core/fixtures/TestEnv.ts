import { BigNumber as BN, Contract, Wallet } from "ethers";
import { PendleFixture } from "./pendle.fixture";
import { CoreFixture } from "./core.fixture";
import { assert } from "chai";
import {
  consts, tokens, getAContract, getA2Contract, getCContract, Token
} from "../../helpers";

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
  forge: Contract;

  ot: Contract;
  xyt: Contract;
  aUSDT: Contract;
  cUSDT: Contract;

  // test params
  T0: BN;
  FORGE_ID: string;
  INITIAL_YIELD_TOKEN_AMOUNT: BN;
  TEST_DELTA: BN;
  EXPIRY: BN;
}



export function parseTestEnvCoreFixture(env: TestEnv, fixture: CoreFixture) {
  env.router = fixture.router;
  env.data = fixture.data;
  env.treasury = fixture.treasury;
  env.marketReader = fixture.marketReader;
  env.pausingManager = fixture.pausingManager;
}

export async function parseTestEnvPendleFixture(alice: Wallet, mode: Mode, env: TestEnv, fixture: PendleFixture) {
  env.mode = mode;
  parseTestEnvCoreFixture(env, fixture.core);

  if (env.mode == Mode.AAVE_V1) {
    env.T0 = consts.T0;
    env.forge = fixture.aForge.aaveForge;
    env.ot = fixture.aForge.aOwnershipToken;
    env.xyt = fixture.aForge.aFutureYieldToken;
    env.aUSDT = await getAContract(alice, env.forge, tokens.USDT);
    env.FORGE_ID = consts.FORGE_AAVE;
  }
  else if (env.mode == Mode.AAVE_V2) {
    env.T0 = consts.T0_A2;
    env.forge = fixture.a2Forge.aaveV2Forge;
    env.ot = fixture.a2Forge.a2OwnershipToken;
    env.xyt = fixture.a2Forge.a2FutureYieldToken;
    env.aUSDT = await getA2Contract(alice, env.forge, tokens.USDT);
    env.FORGE_ID = consts.FORGE_AAVE_V2;
  }
  else if (env.mode == Mode.COMPOUND) {
    env.T0 = consts.T0_C;
    env.forge = fixture.cForge.compoundForge;
    env.ot = fixture.cForge.cOwnershipToken;
    env.xyt = fixture.cForge.cFutureYieldToken;
    env.cUSDT = await getCContract(alice, tokens.USDT);
    env.FORGE_ID = consts.FORGE_COMPOUND;
  }
}