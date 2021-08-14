import chai, { expect } from 'chai';
import { solidity } from 'ethereum-waffle';
import { BigNumber as BN, BigNumberish } from 'ethers';
import {
  addMarketLiquidityDual,
  addMarketLiquidityDualXyt,
  addMarketLiquiditySingle,
  amountToWei,
  approxBigNumber,
  bootstrapMarket,
  consts,
  errMsg,
  mineBlock,
  removeMarketLiquiditySingle,
  setTimeNextBlock,
  swapExactInTokenToXyt,
  swapExactInXytToToken,
  swapExactOutTokenToXyt,
  swapExactOutXytToToken,
  toFixedPoint,
} from '../../helpers';
import { TestEnv } from '../../fixtures';
chai.use(solidity);

const { waffle } = require('hardhat');
const { provider } = waffle;
const wallets = provider.getWallets();
const [alice, bob] = wallets;

export async function AMMTest(env: TestEnv, useSwapIn: boolean) {
  /*-------------------------------------------------------------*/
  const amount = amountToWei(BN.from(1000), 6);
  await bootstrapMarket(env, alice, amount);
  // await env.testToken.approve(env.market.address, consts.INF);

  await runTestTokenToXyt(env, env.T0.add(3600), BN.from(20405615), BN.from(20000000), useSwapIn);
  await runTestXytToToken(env, env.T0.add(3660), BN.from(120000000), BN.from(111303781), useSwapIn);
  await runTestTokenToXyt(env, env.T0.add(43200), BN.from(300000000), BN.from(273280448), useSwapIn);
  await runTestXytToToken(env, env.T0.add(43210), BN.from(74655258), BN.from(100000000), useSwapIn);
  await runTestXytToToken(env, env.T0.add(2592030), BN.from(100000000), BN.from(100716340), useSwapIn);
  await runTestXytToToken(env, env.T0.add(14515300), BN.from(200000000), BN.from(24266823), useSwapIn);
  await runTestTokenToXyt(env, env.T0.add(14861000), BN.from(26338047), BN.from(300000000), useSwapIn);
  await runTestXytToToken(env, env.T0.add(15120300), BN.from(400000000), BN.from(21595046), useSwapIn);
  await runTestTokenToXyt(env, env.T0.add(15120360), BN.from(3696839), BN.from(80000000), useSwapIn);
  await runTestXytToToken(env, env.T0.add(15379200), BN.from(800000016), BN.from(11997610), useSwapIn);
}

export async function AMMTestWhenBlockDeltaIsNonZero(env: TestEnv, useSwapIn: boolean) {
  /*-------------------------------------------------------------*/
  const amount = amountToWei(BN.from(1000), 6);
  await bootstrapMarket(env, alice, amount);
  let BLOCK_DELTA = 3;
  await env.data.setCurveShiftBlockDelta(BLOCK_DELTA);
  // await env.testToken.approve(env.market.address, consts.INF);
  for (let i = 0; i < BLOCK_DELTA; i++) {
    await mineBlock();
  }

  // have curveShift
  await runTestXytToToken(env, env.T0.add(2592000), BN.from(100000000), BN.from(82629492), useSwapIn);
  // no curveShift
  await runTestXytToToken(env, env.T0.add(5184000), BN.from(100000000), BN.from(69458410), useSwapIn);
  // no curveShift
  await runTestTokenToXyt(env, env.T0.add(7776000), BN.from(100000000), BN.from(139100663), useSwapIn);
  // no curveShift
  await runTestXytToToken(env, env.T0.add(10368000), BN.from(100000000), BN.from(74198713), useSwapIn);
  // have curveShift
  await runTestTokenToXyt(env, env.T0.add(12960000), BN.from(100000000), BN.from(355627611), useSwapIn);
}

export async function AMMNearCloseTest(
  env: TestEnv,
  useSwapIn: boolean // if this is true, use swapExactIn. use swapExactOut otherwise.
) {
  let T1 = env.T0.add(consts.SIX_MONTH).sub(consts.ONE_DAY.add(consts.ONE_HOUR)),
    seg = BN.from(60);
  const amount = amountToWei(BN.from(10000), 6);
  await bootstrapMarket(env, alice, amount, amount.div(BN.from(10).pow(5)));
  await addMarketLiquidityDualXyt(env, alice, BN.from(1));

  await runTestXytToToken(env, T1, BN.from(993586042), BN.from(120), useSwapIn);

  await runTestXytToToken(env, T1.add(seg.mul(1)), BN.from(2299356372), BN.from(240), useSwapIn);

  await runTestXytToToken(env, T1.add(seg.mul(2)), BN.from(6173735287), BN.from(480), useSwapIn);

  await runTestXytToToken(env, T1.add(seg.mul(3)), BN.from(46611784), BN.from(3), useSwapIn);

  await runTestTokenToXyt(env, T1.add(seg.mul(4)), BN.from(10000), BN.from(19503526195), useSwapIn);

  // await logMarketReservesData(env.market);
}

export async function AMMCheckLPNearCloseTest(env: TestEnv) {
  let bobLP = BN.from(0),
    bobXyt: BN = BN.from(0),
    bobToken: BN = BN.from(0);

  async function checkAmountLPGained(expectedLPGained: BN, delta: BN) {
    let totalLPGained = await env.market.balanceOf(bob.address);
    let LPGained = totalLPGained.sub(bobLP);
    bobLP = totalLPGained;
    approxBigNumber(LPGained, expectedLPGained, delta, true);
  }

  async function checkAmountTokenGained(expectedTokenGained: BN, delta: BN) {
    let totalTokenGained = await env.testToken.balanceOf(bob.address);
    let tokenGained = totalTokenGained.sub(bobToken);
    bobToken = totalTokenGained;
    approxBigNumber(tokenGained, expectedTokenGained, delta, true);
  }

  async function checkAmountXytGained(expectedXytGained: BN, delta: BN) {
    let totalXytGained = await env.xyt.balanceOf(bob.address);
    let xytGained = totalXytGained.sub(bobXyt);
    bobXyt = totalXytGained;
    approxBigNumber(xytGained, expectedXytGained, delta, true);
  }

  let T1 = env.T0.add(consts.SIX_MONTH).sub(consts.ONE_DAY.add(consts.ONE_HOUR)),
    seg = BN.from(60);
  const amount = amountToWei(BN.from(1000), 6);
  await bootstrapMarket(env, alice, amount, amount.div(BN.from(10).pow(5)));

  await setTimeNextBlock(T1);
  await addMarketLiquidityDualXyt(env, alice, BN.from(1));

  await setTimeNextBlock(T1.add(seg.mul(1)));
  await addMarketLiquiditySingle(env, bob, BN.from(53241241), true);
  await checkAmountLPGained(BN.from(2052), BN.from(20));

  await setTimeNextBlock(T1.add(seg.mul(2)));
  await addMarketLiquiditySingle(env, bob, BN.from(53210), false);
  await checkAmountLPGained(BN.from(16381346), BN.from(300));

  await setTimeNextBlock(T1.add(seg.mul(3)));
  await addMarketLiquiditySingle(env, bob, BN.from(100000000), true);
  await checkAmountLPGained(BN.from(22160), BN.from(30));

  await setTimeNextBlock(T1.add(seg.mul(4)));
  await addMarketLiquiditySingle(env, bob, BN.from(100000000), false);
  await checkAmountLPGained(BN.from(28235392013), BN.from(30));

  bobXyt = await env.xyt.balanceOf(bob.address);
  bobToken = await env.testToken.balanceOf(bob.address);

  await setTimeNextBlock(T1.add(seg.mul(5)));
  await removeMarketLiquiditySingle(env, bob, BN.from('1412375459'), true);
  await checkAmountXytGained(BN.from(1134323097), BN.from(10));

  await setTimeNextBlock(T1.add(seg.mul(6)));
  await removeMarketLiquiditySingle(env, bob, BN.from('14123754590'), false);
  await checkAmountTokenGained(BN.from(53095229), BN.from(10));
}

export async function MarketFeesTest(env: TestEnv, useSwapIn: boolean) {
  await env.data.setMarketFees(toFixedPoint('0.0035'), toFixedPoint('0.2'), consts.HG);

  const amount = amountToWei(BN.from(1000), 6);
  await bootstrapMarket(env, alice, amount);
  // await env.testToken.approve(env.market.address, consts.INF);

  await runTestTokenToXyt(env, env.T0.add(3600), BN.from(20405615), BN.from(19931395), useSwapIn);

  await runTestTokenToXyt(env, env.T0.add(21600), BN.from(20405615), BN.from(19162864), useSwapIn);

  await runTestTokenToXyt(env, env.T0.add(93600), BN.from(14832741), BN.from(13498154), useSwapIn);

  await runTestXytToToken(env, env.T0.add(205200), BN.from(12731281), BN.from(13851215), useSwapIn);

  await runTestXytToToken(env, env.T0.add(720000), BN.from(11241212), BN.from(11713770), useSwapIn);

  await runTestTokenToXyt(env, env.T0.add(900000), BN.from(112411212), BN.from(98219316), useSwapIn);
}

export async function ProtocolFeeTest(env: TestEnv, useSwapIn: boolean) {
  await env.data.setMarketFees(toFixedPoint('0.0035'), toFixedPoint('0.2'), consts.HG);

  const amount = BN.from(10 ** 10);
  const constSwapAmount = BN.from(1500500 * 15);

  async function checkTreasuryLP(expectedLP: BN) {
    let currentTreasuryLP = BN.from(await env.market.balanceOf(env.treasury.address));
    approxBigNumber(currentTreasuryLP, expectedLP, consts.TEST_TOKEN_DELTA.toNumber() * 2);
  }

  await bootstrapMarket(env, alice, amount);
  // await testToken.approve(env.market.address, consts.INF);

  setTimeNextBlock(env.T0.add(3600));
  await env.xyt.connect(bob).transfer(alice.address, amount);
  await env.testToken.connect(bob).transfer(alice.address, amount);

  await swapExactInTokenToXyt(env, alice, constSwapAmount);
  await swapExactInXytToToken(env, alice, constSwapAmount);
  await addMarketLiquidityDual(env, alice, constSwapAmount);
  await checkTreasuryLP(BN.from(15737));

  setTimeNextBlock(env.T0.add(3600 * 10));
  await swapExactInTokenToXyt(env, alice, constSwapAmount.mul(2));
  await swapExactInXytToToken(env, alice, constSwapAmount.mul(3));
  await addMarketLiquidityDual(env, alice, constSwapAmount.mul(4));
  await checkTreasuryLP(BN.from(54997));

  setTimeNextBlock(env.T0.add(3600 * 100));
  await swapExactInTokenToXyt(env, alice, constSwapAmount.mul(5));
  await swapExactInXytToToken(env, alice, constSwapAmount.mul(6));
  await addMarketLiquidityDual(env, alice, constSwapAmount.mul(7));
  await checkTreasuryLP(BN.from(141046));

  setTimeNextBlock(env.T0.add(3600 * 300));
  await swapExactInTokenToXyt(env, alice, constSwapAmount.mul(8));
  await swapExactInXytToToken(env, alice, constSwapAmount.mul(9));
  await addMarketLiquidityDual(env, alice, constSwapAmount.mul(10));
  await checkTreasuryLP(BN.from(273551));

  setTimeNextBlock(env.T0.add(3600 * 500));
  await swapExactInTokenToXyt(env, alice, constSwapAmount.mul(11));
  await swapExactInXytToToken(env, alice, constSwapAmount.mul(12));
  await addMarketLiquidityDual(env, alice, constSwapAmount.mul(13));
  await checkTreasuryLP(BN.from(452271));
}

export async function marketBalanceNonZeroTest(env: TestEnv) {
  const MINIMUM_LIQUIDITY = BN.from(1000);
  const amount = BN.from(10000);

  await bootstrapMarket(env, alice, amount);
  const lastAmount = await env.xyt.balanceOf(alice.address);
  await expect(
    env.router
      .connect(alice)
      .removeMarketLiquidityDual(env.FORGE_ID, env.xyt.address, env.testToken.address, amount, 0, 0)
  ).to.be.revertedWith(errMsg.XYT_BALANCE_ERROR);
  await env.router
    .connect(alice)
    .removeMarketLiquidityDual(
      env.FORGE_ID,
      env.xyt.address,
      env.testToken.address,
      amount.sub(MINIMUM_LIQUIDITY),
      0,
      0,
      consts.HG
    );

  approxBigNumber((await env.xyt.balanceOf(alice.address)).sub(lastAmount), amount.sub(MINIMUM_LIQUIDITY), BN.from(2));
  return;
}

export async function marketBalanceNonZeroSwapTest(env: TestEnv) {
  const amount = BN.from(1000000000);
  await bootstrapMarket(env, alice, amount, BN.from(1));
  await setTimeNextBlock(env.EXPIRY.sub(consts.ONE_DAY.add(consts.ONE_HOUR)));
  await expect(swapExactInTokenToXyt(env, alice, BN.from(1000000000))).to.be.revertedWith(errMsg.XYT_BALANCE_ERROR);
}

export async function marketAddLiquidityDualTest(env: TestEnv) {
  const amountXyt = BN.from(1000);
  const amountToken = BN.from(1000000); /// bootstrap with ratio xyt 1:1000 token

  await bootstrapMarket(env, alice, amountXyt, amountToken);
  await addMarketLiquidityDual(env, alice, amountXyt); /// Desires to add 1000 xyt, 1000 token in

  approxBigNumber(await env.xyt.balanceOf(env.market.address), 1001, 0, true);

  approxBigNumber(await env.testToken.balanceOf(env.market.address), 1001000, 0, true);
}

async function runTestTokenToXyt(
  env: TestEnv,
  time: BN,
  tokenIn: BN,
  xytOut: BN,
  useSwapIn: boolean,
  delta?: BigNumberish
) {
  if (delta == null) {
    delta = consts.TEST_TOKEN_DELTA;
  }
  var { xytBalance: initialXytBalance, tokenBalance: initialTokenBalance } = await env.market.getReserves();

  await setTimeNextBlock(time);
  if (useSwapIn) {
    await swapExactInTokenToXyt(env, alice, tokenIn);
  } else {
    await swapExactOutTokenToXyt(env, alice, xytOut);
  }
  var { xytBalance, tokenBalance } = await env.market.getReserves();

  var actualXytOut = initialXytBalance.sub(xytBalance);
  var actualTokenIn = tokenBalance.sub(initialTokenBalance);

  approxBigNumber(actualTokenIn, tokenIn, delta, true);
  approxBigNumber(actualXytOut, xytOut, delta, true);
}

async function runTestXytToToken(
  env: TestEnv,
  time: BN,
  xytIn: BN,
  tokenOut: BN,
  useSwapIn: boolean,
  delta?: BigNumberish
) {
  if (delta == null) {
    delta = consts.TEST_TOKEN_DELTA;
  }
  var { xytBalance: initialXytBalance, tokenBalance: initialTokenBalance } = await env.market.getReserves();

  await setTimeNextBlock(time);
  if (useSwapIn) {
    await swapExactInXytToToken(env, alice, xytIn);
  } else {
    await swapExactOutXytToToken(env, alice, tokenOut);
  }
  var { xytBalance, tokenBalance } = await env.market.getReserves();

  var actualXytIn: BN = xytBalance.sub(initialXytBalance);
  var actualTokenOut: BN = initialTokenBalance.sub(tokenBalance);

  approxBigNumber(actualTokenOut, tokenOut, delta);
  approxBigNumber(actualXytIn, xytIn, delta);
}
