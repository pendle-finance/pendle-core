import { assert } from 'chai';
import { BigNumber as BN, Contract, utils, Wallet } from 'ethers';
import { consts, wrapEth } from '.';
import { Mode, TestEnv } from '../fixtures';

export async function tokenizeYield(env: TestEnv, user: Wallet, amount: BN, to?: string): Promise<BN> {
  if (to == null) {
    to = user.address;
  }
  let amountTokenMinted = await env.ot.balanceOf(to);
  await env.router
    .connect(user)
    .tokenizeYield(env.FORGE_ID, env.underlyingAsset.address, env.EXPIRY, amount, to, consts.HG);
  amountTokenMinted = (await env.ot.balanceOf(to)).sub(amountTokenMinted);
  return amountTokenMinted;
}

export async function redeemDueInterests(env: TestEnv, user: Wallet, expiry?: BN) {
  if (expiry == null) {
    expiry = env.EXPIRY;
  }
  await env.router
    .connect(user)
    .redeemDueInterests(env.FORGE_ID, env.underlyingAsset.address, expiry, user.address, consts.HG);
}

export async function redeemAfterExpiry(env: TestEnv, user: Wallet, expiry?: BN) {
  if (expiry == null) {
    expiry = env.EXPIRY;
  }
  await env.router.connect(user).redeemAfterExpiry(env.FORGE_ID, env.underlyingAsset.address, expiry, consts.HG);
}

export async function redeemUnderlying(env: TestEnv, user: Wallet, amount: BN, expiry?: BN) {
  if (expiry == null) {
    expiry = env.EXPIRY;
  }
  await env.router.connect(user).redeemUnderlying(env.FORGE_ID, env.underlyingAsset.address, expiry, amount, consts.HG);
}

export async function bootstrapMarket(env: TestEnv, user: Wallet, amountXyt: BN, amountToken?: BN) {
  if (amountToken == null) amountToken = amountXyt;
  let override: any = wrapEth(consts.HG, env.ETH_TEST ? amountToken : BN.from(0));
  let tokenAddress: string = env.ETH_TEST ? consts.ETH_ADDRESS : env.testToken.address;

  await env.router
    .connect(user)
    .bootstrapMarket(env.MARKET_FACTORY_ID, env.xyt.address, tokenAddress, amountXyt, amountToken, override);
}

export async function swapExactInTokenToXyt(env: TestEnv, user: Wallet, inAmount: BN): Promise<BN> {
  let initialXytBalance = await env.xyt.balanceOf(user.address);
  let override: any = wrapEth(consts.HG, env.ETH_TEST ? inAmount : BN.from(0));
  let tokenAddress: string = env.ETH_TEST ? consts.ETH_ADDRESS : env.testToken.address;
  await env.router
    .connect(user)
    .swapExactIn(tokenAddress, env.xyt.address, inAmount, BN.from(0), env.MARKET_FACTORY_ID, override);
  let postXytBalance = await env.xyt.balanceOf(user.address);
  return postXytBalance.sub(initialXytBalance);
}

export async function swapExactInXytToToken(env: TestEnv, user: Wallet, inAmount: BN): Promise<BN> {
  let initialTokenBalance = await env.testToken.balanceOf(user.address);
  let tokenAddress: string = env.ETH_TEST ? consts.ETH_ADDRESS : env.testToken.address;
  await env.router
    .connect(user)
    .swapExactIn(env.xyt.address, tokenAddress, inAmount, BN.from(0), env.MARKET_FACTORY_ID, consts.HG);
  let postTokenBalance = await env.testToken.balanceOf(user.address);
  return postTokenBalance.sub(initialTokenBalance);
}

export async function swapExactOutTokenToXyt(env: TestEnv, user: Wallet, outAmount: BN, maxInAmount?: BN): Promise<BN> {
  if (env.ETH_TEST) assert(maxInAmount != null, 'In eth tests, maxInAmount must be present');
  if (maxInAmount == null) maxInAmount = consts.INF;
  let override: any = wrapEth(consts.HG, env.ETH_TEST ? maxInAmount : BN.from(0));
  let tokenAddress: string = env.ETH_TEST ? consts.ETH_ADDRESS : env.testToken.address;

  let initialXytBalance = await env.xyt.balanceOf(user.address);
  await env.router
    .connect(user)
    .swapExactOut(tokenAddress, env.xyt.address, outAmount, maxInAmount, env.MARKET_FACTORY_ID, override);
  let postXytBalance = await env.xyt.balanceOf(user.address);
  return postXytBalance.sub(initialXytBalance);
}

export async function swapExactOutXytToToken(env: TestEnv, user: Wallet, outAmount: BN): Promise<BN> {
  let tokenAddress: string = env.ETH_TEST ? consts.ETH_ADDRESS : env.testToken.address;
  let initialTokenBalance = await env.testToken.balanceOf(user.address);
  await env.router
    .connect(user)
    .swapExactOut(env.xyt.address, tokenAddress, outAmount, consts.INF, env.MARKET_FACTORY_ID, consts.HG);
  // For Eth, the returned result shouldn't be used
  let postTokenBalance = await env.testToken.balanceOf(user.address);
  return postTokenBalance.sub(initialTokenBalance);
}

export async function addMarketLiquiditySingle(env: TestEnv, user: Wallet, amount: BN, useXyt: boolean) {
  let tokenAddress: string = env.ETH_TEST ? consts.ETH_ADDRESS : env.testToken.address;
  let override: any = wrapEth(consts.HG, env.ETH_TEST && !useXyt ? amount : BN.from(0));
  await env.router
    .connect(user)
    .addMarketLiquiditySingle(
      env.MARKET_FACTORY_ID,
      env.xyt.address,
      tokenAddress,
      useXyt,
      amount,
      BN.from(0),
      override
    );
}

export async function addMarketLiquidityDualXyt(env: TestEnv, user: Wallet, amountXyt: BN): Promise<BN> {
  assert(!env.ETH_TEST, 'Please use addMarketLiquidityDual in eth tests instead');
  let initialLpBalance = await env.market.balanceOf(user.address);
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
      consts.HG
    );
  let postLpBalance = await env.market.balanceOf(user.address);
  return postLpBalance.sub(initialLpBalance);
}

export async function addMarketLiquidityDual(env: TestEnv, user: Wallet, amountXyt: BN, amountToken?: BN): Promise<BN> {
  if (env.ETH_TEST) {
    assert(amountToken != null, 'In eth tests, the amountToken must not be null');
  }

  if (amountToken == null) amountToken = amountXyt;

  let override: any = wrapEth(consts.HG, env.ETH_TEST ? amountToken : BN.from(0));
  let tokenAddress: string = env.ETH_TEST ? consts.ETH_ADDRESS : env.testToken.address;
  let initialLpBalance = await env.market.balanceOf(user.address);
  await env.router
    .connect(user)
    .addMarketLiquidityDual(
      env.MARKET_FACTORY_ID,
      env.xyt.address,
      tokenAddress,
      amountXyt,
      amountToken,
      BN.from(1),
      BN.from(1),
      override
    );
  let postLpBalance = await env.market.balanceOf(user.address);
  return postLpBalance.sub(initialLpBalance);
}

export async function removeMarketLiquidityDual(env: TestEnv, user: Wallet, amount: BN) {
  let tokenAddress: string = env.ETH_TEST ? consts.ETH_ADDRESS : env.testToken.address;
  await env.router
    .connect(user)
    .removeMarketLiquidityDual(
      env.MARKET_FACTORY_ID,
      env.xyt.address,
      tokenAddress,
      amount,
      BN.from(0),
      BN.from(0),
      consts.HG
    );
}

export async function removeMarketLiquiditySingle(
  env: TestEnv,
  user: Wallet,
  amount: BN,
  forXyt: boolean
): Promise<BN> {
  let initialBalance: BN = forXyt ? await env.xyt.balanceOf(user.address) : await env.testToken.balanceOf(user.address);
  let tokenAddress: string = env.ETH_TEST ? consts.ETH_ADDRESS : env.testToken.address;

  await env.router
    .connect(user)
    .removeMarketLiquiditySingle(
      env.MARKET_FACTORY_ID,
      env.xyt.address,
      tokenAddress,
      forXyt,
      amount,
      BN.from(0),
      consts.HG
    );
  // this won't work correctly for eth tests
  let postBalance: BN = forXyt ? await env.xyt.balanceOf(user.address) : await env.testToken.balanceOf(user.address);
  return postBalance.sub(initialBalance);
}

export async function redeemLpInterests(env: TestEnv, user: Wallet, market?: Contract) {
  if (market == null) {
    market = env.market;
  }
  await env.router.connect(user).redeemLpInterests(market!.address, user.address, consts.HG);
}

export async function getMarketRateExactIn(
  env: TestEnv,
  tokenIn: string,
  tokenOut: string,
  amount: BN
): Promise<any[]> {
  return await env.marketReader.getMarketRateExactIn(tokenIn, tokenOut, amount, env.MARKET_FACTORY_ID);
}

export async function getMarketRateExactOut(
  env: TestEnv,
  tokenIn: string,
  tokenOut: string,
  amount: BN
): Promise<any[]> {
  return await env.marketReader.getMarketRateExactOut(tokenIn, tokenOut, amount, env.MARKET_FACTORY_ID);
}

export async function stake(env: TestEnv, user: Wallet, amount: BN, expiry?: BN, forAddr?: Wallet) {
  if (env.mode == Mode.SLP_LIQ) {
    await env.liq.connect(user).stake(forAddr != null ? forAddr.address : user.address, amount, consts.HG);
  } else {
    if (expiry == null) expiry = env.EXPIRY;
    await env.liq.connect(user).stake(expiry, amount, consts.HG);
  }
}

export async function stakeWithPermit(env: TestEnv, user: Wallet, amount: BN, expiry?: BN) {
  if (expiry == null) expiry = env.EXPIRY;

  const Domain = (contract: any) => ({
    name: 'Pendle Market',
    version: '1',
    chainId: consts.DEFAULT_CHAIN_ID,
    verifyingContract: contract.address,
  });

  const Types = {
    Permit: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'nonce', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
    ],
  };

  const Data = {
    owner: user.address,
    spender: env.liq.address,
    value: amount,
    nonce: 0,
    deadline: 10e9,
  };

  const { v, r, s } = utils.splitSignature(await user._signTypedData(Domain(env.market), Types, Data));
  await env.liq.connect(user).stakeWithPermit(expiry, amount, 10e9, v, r, s, consts.HG);
}

export async function withdraw(env: TestEnv, user: Wallet, amount: BN, expiry?: BN, to?: Wallet) {
  if (env.mode == Mode.SLP_LIQ) {
    await env.liq.connect(user).withdraw(to != null ? to.address : user.address, amount, consts.HG);
  } else {
    if (expiry == null) expiry = env.EXPIRY;
    await env.liq.connect(user).withdraw(expiry, amount, consts.HG);
  }
}

export async function redeemRewards(env: TestEnv, user: Wallet, expiry?: BN) {
  if (env.mode == Mode.SLP_LIQ) {
    await env.liq.connect(user).redeemRewards(user.address, consts.HG);
  } else {
    if (expiry == null) expiry = env.EXPIRY;
    await env.liq.connect(user).redeemRewards(expiry, user.address, consts.HG);
  }
}

export async function otBalance(env: TestEnv, user: Wallet): Promise<BN> {
  return env.ot.balanceOf(user.address);
}

export async function xytBalance(env: TestEnv, user: Wallet): Promise<BN> {
  return env.xyt.balanceOf(user.address);
}

export async function yTokenBalance(env: TestEnv, user: Wallet): Promise<BN> {
  return env.yToken.balanceOf(user.address);
}
