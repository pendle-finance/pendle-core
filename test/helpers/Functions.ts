import { BigNumber as BN, Contract, Wallet } from "ethers";
import { TestEnv } from "../core/fixtures";
import { tokens, consts, Token } from "./Constants";

let USDT: Token = tokens.USDT;

export async function tokenizeYield(
  env: TestEnv,
  user: Wallet,
  amount: BN,
  to?: Wallet
): Promise<BN> {
  if (to == null) {
    to = user;
  }
  let amountTokenMinted = await env.ot.balanceOf(to.address);
  await env.router
    .connect(user)
    .tokenizeYield(
      env.FORGE_ID,
      USDT.address,
      env.EXPIRY,
      amount,
      to.address,
      consts.HIGH_GAS_OVERRIDE
    );
  amountTokenMinted = (await env.ot.balanceOf(to.address)).sub(
    amountTokenMinted
  );
  return amountTokenMinted;
}

export async function redeemDueInterests(
  env: TestEnv,
  user: Wallet,
  expiry?: BN
) {
  if (expiry == null) {
    expiry = env.EXPIRY;
  }
  await env.router
    .connect(user)
    .redeemDueInterests(env.FORGE_ID, USDT.address, expiry, user.address, consts.HIGH_GAS_OVERRIDE);
}

export async function redeemAfterExpiry(
  env: TestEnv,
  user: Wallet,
  expiry?: BN
) {
  if (expiry == null) {
    expiry = env.EXPIRY;
  }
  await env.router
    .connect(user)
    .redeemAfterExpiry(env.FORGE_ID, USDT.address, expiry);
}

export async function redeemUnderlying(
  env: TestEnv,
  user: Wallet,
  amount: BN,
  expiry?: BN
) {
  if (expiry == null) {
    expiry = env.EXPIRY;
  }
  await env.router
    .connect(user)
    .redeemUnderlying(
      env.FORGE_ID,
      USDT.address,
      expiry,
      amount,
      consts.HIGH_GAS_OVERRIDE
    );
}

export async function bootstrapMarket(env: TestEnv, user: Wallet, amount: BN) {
  await env.router
    .connect(user)
    .bootstrapMarket(
      env.MARKET_FACTORY_ID,
      env.xyt.address,
      env.testToken.address,
      amount,
      amount,
      consts.HIGH_GAS_OVERRIDE
    );
}

export async function swapExactInTokenToXyt(
  env: TestEnv,
  user: Wallet,
  inAmount: BN
) {
  await env.router
    .connect(user)
    .swapExactIn(
      env.testToken.address,
      env.xyt.address,
      inAmount,
      BN.from(0),
      env.MARKET_FACTORY_ID,
      consts.HIGH_GAS_OVERRIDE
    );
}

export async function swapExactInXytToToken(
  env: TestEnv,
  user: Wallet,
  inAmount: BN
) {
  await env.router
    .connect(user)
    .swapExactIn(
      env.xyt.address,
      env.testToken.address,
      inAmount,
      BN.from(0),
      env.MARKET_FACTORY_ID,
      consts.HIGH_GAS_OVERRIDE
    );
}

export async function swapExactOutTokenToXyt(env: TestEnv, user: Wallet, outAmount: BN) {
  await env.router.swapExactOut(
    env.testToken.address,
    env.xyt.address,
    outAmount,
    consts.INF,
    consts.MARKET_FACTORY_AAVE
  );
}

export async function swapExactOutXytToToken(env: TestEnv, user: Wallet, outAmount: BN) {
  await env.router.swapExactOut(
    env.xyt.address,
    env.testToken.address,
    outAmount,
    consts.INF,
    consts.MARKET_FACTORY_AAVE
  );
}

export async function addMarketLiquiditySingleXyt(
  env: TestEnv,
  user: Wallet,
  amount: BN
) {
  await env.router
    .connect(user)
    .addMarketLiquiditySingle(
      env.MARKET_FACTORY_ID,
      env.xyt.address,
      env.testToken.address,
      true,
      amount,
      BN.from(0),
      consts.HIGH_GAS_OVERRIDE
    );
}

export async function addMarketLiquidityDualXyt(
  env: TestEnv,
  user: Wallet,
  amountXyt: BN
) {
  await env.router
    .connect(user)
    .addMarketLiquidityDual(
      env.MARKET_FACTORY_ID,
      env.xyt.address,
      env.testToken.address,
      amountXyt,
      consts.INF,
      amountXyt,
      BN.from(0),
      consts.HIGH_GAS_OVERRIDE
    );
}

export async function addMarketLiquiditySingleToken(
  env: TestEnv,
  user: Wallet,
  amount: BN
) {
  await env.router
    .connect(user)
    .addMarketLiquiditySingle(
      env.MARKET_FACTORY_ID,
      env.xyt.address,
      env.testToken.address,
      false,
      amount,
      BN.from(0),
      consts.HIGH_GAS_OVERRIDE
    );
}

export async function removeMarketLiquidityDual(
  env: TestEnv,
  user: Wallet,
  amount: BN
) {
  await env.router
    .connect(user)
    .removeMarketLiquidityDual(
      env.MARKET_FACTORY_ID,
      env.xyt.address,
      env.testToken.address,
      amount,
      BN.from(0),
      BN.from(0),
      consts.HIGH_GAS_OVERRIDE
    );
}

export async function removeMarketLiquidityXyt(
  env: TestEnv,
  user: Wallet,
  amount: BN
) {
  await env.router
    .connect(user)
    .removeMarketLiquiditySingle(
      env.MARKET_FACTORY_ID,
      env.xyt.address,
      env.testToken.address,
      true,
      amount,
      BN.from(0),
      consts.HIGH_GAS_OVERRIDE
    );
}

export async function removeMarketLiquiditySingleToken(
  env: TestEnv,
  user: Wallet,
  amount: BN
) {
  await env.router
    .connect(user)
    .removeMarketLiquiditySingle(
      env.MARKET_FACTORY_ID,
      env.xyt.address,
      env.testToken.address,
      false,
      amount,
      BN.from(0),
      consts.HIGH_GAS_OVERRIDE
    );
}

export async function redeemLpInterests(
  env: TestEnv,
  user: Wallet,
  market?: Contract
) {
  if (market == null) {
    market = env.stdMarket;
  }
  await env.router
    .connect(user)
    .redeemLpInterests(market.address, user.address, consts.HIGH_GAS_OVERRIDE);
}
