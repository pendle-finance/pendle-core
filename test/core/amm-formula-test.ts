import { BigNumber as BN, BigNumberish } from "ethers";
import {
  amountToWei,
  consts,
  setTimeNextBlock,
  bootstrapMarket,
  swapExactInTokenToXyt,
  swapExactInXytToToken,
  swapExactOutTokenToXyt,
  swapExactOutXytToToken,
  approxBigNumber,
  addMarketLiquidityDualXyt,
  addMarketLiquiditySingle,
  removeMarketLiquiditySingle,
} from "../helpers";
import { TestEnv } from "./fixtures";

const { waffle } = require("hardhat");
const { provider } = waffle;
const wallets = provider.getWallets();
const [alice, bob] = wallets;

export async function AMMTest(
  env: TestEnv,
  useSwapIn: boolean // if this is true, use swapExactIn. use swapExactOut otherwise.
) {
  /*-------------------------------------------------------------*/
  const amount = amountToWei(BN.from(1000), 6);
  await bootstrapMarket(env, alice, amount);
  await env.testToken.approve(env.stdMarket.address, consts.INF);

  await runTestTokenToXyt(
    env,
    env.T0.add(3600),
    BN.from(20405615),
    BN.from(20000000),
    useSwapIn
  );
  await runTestXytToToken(
    env,
    env.T0.add(3660),
    BN.from(120000000),
    BN.from(111303781),
    useSwapIn
  );
  await runTestTokenToXyt(
    env,
    env.T0.add(43200),
    BN.from(300000000),
    BN.from(273280448),
    useSwapIn
  );
  await runTestXytToToken(
    env,
    env.T0.add(43210),
    BN.from(74655258),
    BN.from(100000000),
    useSwapIn
  );
  await runTestXytToToken(
    env,
    env.T0.add(2592030),
    BN.from(100000000),
    BN.from(100716340),
    useSwapIn
  );
  await runTestXytToToken(
    env,
    env.T0.add(14515300),
    BN.from(200000000),
    BN.from(24266823),
    useSwapIn
  );
  await runTestTokenToXyt(
    env,
    env.T0.add(14861000),
    BN.from(26338047),
    BN.from(300000000),
    useSwapIn
  );
  await runTestXytToToken(
    env,
    env.T0.add(15120300),
    BN.from(400000000),
    BN.from(21595046),
    useSwapIn
  );
  await runTestTokenToXyt(
    env,
    env.T0.add(15120360),
    BN.from(3696839),
    BN.from(80000000),
    useSwapIn
  );
  await runTestXytToToken(
    env,
    env.T0.add(15379200),
    BN.from(800000016),
    BN.from(11997610),
    useSwapIn
  );
}

export async function AMMNearCloseTest(
  env: TestEnv,
  useSwapIn: boolean // if this is true, use swapExactIn. use swapExactOut otherwise.
) {
  let T = env.T0.add(consts.SIX_MONTH).sub(consts.ONE_DAY.add(consts.ONE_HOUR));
  const amount = amountToWei(BN.from(10000), 6);
  await bootstrapMarket(env, alice, amount, amount.div(BN.from(10).pow(5)));

  await setTimeNextBlock(T);
  await addMarketLiquidityDualXyt(env, alice, BN.from(1));

  await runTestXytToTokenCustom(
    env,
    BN.from(993586042),
    BN.from(120),
    BN.from(15000),
    useSwapIn
  );

  await runTestXytToTokenCustom(
    env,
    BN.from(2297718631),
    BN.from(240),
    BN.from(30000),
    useSwapIn
  );

  await runTestXytToTokenCustom(
    env,
    BN.from(6163346979),
    BN.from(480),
    BN.from(90000),
    useSwapIn
  );

  await runTestTokenToXytCustom(
    env,
    BN.from(1000),
    BN.from(10639807417),
    BN.from(100),
    useSwapIn
  );

  await runTestTokenToXytCustom(
    env,
    BN.from(10),
    BN.from(69158563),
    BN.from(100),
    useSwapIn
  );
}

export async function AMMCheckLPNearCloseTest(env: TestEnv) {
  let bobLP = BN.from(0),
    bobXyt: BN = BN.from(0),
    bobToken: BN = BN.from(0);

  async function checkAmountLPGained(expectedLPGained: BN, delta: BN) {
    let totalLPGained = await env.stdMarket.balanceOf(bob.address);
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

  let T = env.T0.add(consts.SIX_MONTH).sub(consts.ONE_DAY.add(consts.ONE_HOUR));
  const amount = amountToWei(BN.from(1000), 6);
  await bootstrapMarket(env, alice, amount, amount.div(BN.from(10).pow(5)));

  await setTimeNextBlock(T);
  await addMarketLiquidityDualXyt(env, alice, BN.from(1));

  await addMarketLiquiditySingle(env, bob, BN.from(53241241), true);
  await checkAmountLPGained(BN.from(2053), BN.from(20));

  await addMarketLiquiditySingle(env, bob, BN.from(53210), false);
  await checkAmountLPGained(BN.from(16381062), BN.from(30));

  await addMarketLiquiditySingle(env, bob, BN.from(100000000), true);
  await checkAmountLPGained(BN.from(22202), BN.from(30));

  await addMarketLiquiditySingle(env, bob, BN.from(100000000), false);
  await checkAmountLPGained(BN.from(28227913256), BN.from(30000));

  bobXyt = await env.xyt.balanceOf(bob.address);
  bobToken = await env.testToken.balanceOf(bob.address);

  await removeMarketLiquiditySingle(env, bob, BN.from("1412375459"), true);
  await checkAmountXytGained(BN.from(1134092376), BN.from(1000));

  await removeMarketLiquiditySingle(env, bob, BN.from("14123754590"), false);
  await checkAmountTokenGained(BN.from(53111632), BN.from(1000));
}

async function runTestTokenToXytCustom(
  env: TestEnv,
  tokenIn: BN,
  xytOut: BN,
  delta: BigNumberish,
  useSwapIn: boolean
) {
  var {
    xytBalance: initialXytBalance,
    tokenBalance: initialTokenBalance,
  } = await env.stdMarket.getReserves();

  if (useSwapIn) {
    await swapExactInTokenToXyt(env, alice, tokenIn);
  } else {
    await swapExactOutTokenToXyt(env, alice, xytOut);
  }
  var { xytBalance, tokenBalance } = await env.stdMarket.getReserves();

  var actualXytOut = initialXytBalance.sub(xytBalance);
  var actualTokenIn = tokenBalance.sub(initialTokenBalance);

  approxBigNumber(actualTokenIn, tokenIn, delta);
  approxBigNumber(actualXytOut, xytOut, delta);
}

async function runTestXytToTokenCustom(
  env: TestEnv,
  xytIn: BN,
  tokenOut: BN,
  delta: BigNumberish,
  useSwapIn: boolean
) {
  var {
    xytBalance: initialXytBalance,
    tokenBalance: initialTokenBalance,
  } = await env.stdMarket.getReserves();

  if (useSwapIn) {
    await swapExactInXytToToken(env, alice, xytIn);
  } else {
    await swapExactOutXytToToken(env, alice, tokenOut);
  }
  var { xytBalance, tokenBalance } = await env.stdMarket.getReserves();

  var actualXytIn: BN = xytBalance.sub(initialXytBalance);
  var actualTokenOut: BN = initialTokenBalance.sub(tokenBalance);

  approxBigNumber(actualTokenOut, tokenOut, delta);
  approxBigNumber(actualXytIn, xytIn, delta);
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
  var {
    xytBalance: initialXytBalance,
    tokenBalance: initialTokenBalance,
  } = await env.stdMarket.getReserves();

  await setTimeNextBlock(time);
  if (useSwapIn) {
    await swapExactInTokenToXyt(env, alice, tokenIn);
  } else {
    await swapExactOutTokenToXyt(env, alice, xytOut);
  }
  var { xytBalance, tokenBalance } = await env.stdMarket.getReserves();

  var actualXytOut = initialXytBalance.sub(xytBalance);
  var actualTokenIn = tokenBalance.sub(initialTokenBalance);

  approxBigNumber(actualTokenIn, tokenIn, delta, false);
  approxBigNumber(actualXytOut, xytOut, delta, false);
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
  var {
    xytBalance: initialXytBalance,
    tokenBalance: initialTokenBalance,
  } = await env.stdMarket.getReserves();

  await setTimeNextBlock(time);
  if (useSwapIn) {
    await swapExactInXytToToken(env, alice, xytIn);
  } else {
    await swapExactOutXytToToken(env, alice, tokenOut);
  }
  var { xytBalance, tokenBalance } = await env.stdMarket.getReserves();

  var actualXytIn: BN = xytBalance.sub(initialXytBalance);
  var actualTokenOut: BN = initialTokenBalance.sub(tokenBalance);

  approxBigNumber(actualTokenOut, tokenOut, delta);
  approxBigNumber(actualXytIn, xytIn, delta);
}
