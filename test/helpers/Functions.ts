import { BigNumber as BN, Contract, Wallet } from "ethers";
import { TestEnv } from "../core/fixtures";
import { consts, Token, tokens } from "../helpers";

let USDT: Token = tokens.USDT;

export async function tokenizeYield(
  env: TestEnv,
  user: Wallet,
  amount: BN,
  to?: string
): Promise<BN> {
  if (to == null) {
    to = user.address;
  }
  let amountTokenMinted = await env.ot.balanceOf(to);
  await env.router
    .connect(user)
    .tokenizeYield(
      env.FORGE_ID,
      USDT.address,
      env.EXPIRY,
      amount,
      to,
      consts.HIGH_GAS_OVERRIDE
    );
  amountTokenMinted = (await env.ot.balanceOf(to)).sub(
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
    .redeemDueInterests(
      env.FORGE_ID,
      USDT.address,
      expiry,
      user.address,
      consts.HIGH_GAS_OVERRIDE
    );
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

export async function bootstrapMarket(
  env: TestEnv,
  user: Wallet,
  amountXyt: BN,
  amountToken?: BN
) {
  if (amountToken == null) {
    amountToken = amountXyt;
  }
  await env.router
    .connect(user)
    .bootstrapMarket(
      env.MARKET_FACTORY_ID,
      env.xyt.address,
      env.testToken.address,
      amountXyt,
      amountToken,
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

export async function swapExactOutTokenToXyt(
  env: TestEnv,
  user: Wallet,
  outAmount: BN
) {
  await env.router.swapExactOut(
    env.testToken.address,
    env.xyt.address,
    outAmount,
    consts.INF,
    env.MARKET_FACTORY_ID,
    consts.HIGH_GAS_OVERRIDE
  );
}

export async function swapExactOutXytToToken(
  env: TestEnv,
  user: Wallet,
  outAmount: BN
) {
  await env.router.swapExactOut(
    env.xyt.address,
    env.testToken.address,
    outAmount,
    consts.INF,
    env.MARKET_FACTORY_ID,
    consts.HIGH_GAS_OVERRIDE
  );
}

export async function addMarketLiquiditySingle(
  env: TestEnv,
  user: Wallet,
  amount: BN,
  useXyt: boolean
) {
  await env.router
    .connect(user)
    .addMarketLiquiditySingle(
      env.MARKET_FACTORY_ID,
      env.xyt.address,
      env.testToken.address,
      useXyt,
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

export async function addMarketLiquidityDual(
  env: TestEnv,
  user: Wallet,
  amountXyt: BN,
  amountToken?: BN
) {
  if (amountToken == null) amountToken = amountXyt;

  await env.router
    .connect(user)
    .addMarketLiquidityDual(
      env.MARKET_FACTORY_ID,
      env.xyt.address,
      env.testToken.address,
      amountXyt,
      amountToken,
      BN.from(1),
      BN.from(1),
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

export async function removeMarketLiquiditySingle(
  env: TestEnv,
  user: Wallet,
  amount: BN,
  forXyt: boolean
): Promise<BN> {
  let initialBalance: BN = forXyt
    ? await env.xyt.balanceOf(user.address)
    : await env.testToken.balanceOf(user.address);

  await env.router
    .connect(user)
    .removeMarketLiquiditySingle(
      env.MARKET_FACTORY_ID,
      env.xyt.address,
      env.testToken.address,
      forXyt,
      amount,
      BN.from(0),
      consts.HIGH_GAS_OVERRIDE
    );
  let postBalance: BN = forXyt
    ? await env.xyt.balanceOf(user.address)
    : await env.testToken.balanceOf(user.address);
  return postBalance.sub(initialBalance);
}

export async function redeemLpInterests(
  env: TestEnv,
  user: Wallet,
  market?: Contract
) {
  if (market == null) {
    market = env.market;
  }
  await env.router
    .connect(user)
    .redeemLpInterests(market.address, user.address, consts.HIGH_GAS_OVERRIDE);
}

export async function getMarketRateExactIn(
  env: TestEnv,
  amount: BN
): Promise<any[]> {
  return await env.marketReader.getMarketRateExactIn(
    env.testToken.address,
    env.xyt.address,
    amount,
    env.MARKET_FACTORY_ID
  );
}

export async function getMarketRateExactOut(
  env: TestEnv,
  amount: BN
): Promise<any[]> {
  return await env.marketReader.getMarketRateExactOut(
    env.xyt.address,
    env.testToken.address,
    amount,
    env.MARKET_FACTORY_ID
  );
}

export async function stake(
  env: TestEnv,
  user: Wallet,
  amount: BN,
  expiry?: BN
) {
  if (expiry == null) expiry = env.EXPIRY;
  await env.liq.connect(user).stake(expiry, amount, consts.HIGH_GAS_OVERRIDE);
}

export async function withdraw(
  env: TestEnv,
  user: Wallet,
  amount: BN,
  expiry?: BN
) {
  if (expiry == null) expiry = env.EXPIRY;
  await env.liq
    .connect(user)
    .withdraw(expiry, amount, consts.HIGH_GAS_OVERRIDE);
}

export async function redeemRewards(env: TestEnv, user: Wallet, expiry?: BN) {
  if (expiry == null) expiry = env.EXPIRY;
  await env.liq.redeemRewards(expiry, user.address, consts.HIGH_GAS_OVERRIDE);
}
