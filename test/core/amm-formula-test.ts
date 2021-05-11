import { BigNumber as BN } from "ethers";
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
  async function runTestTokenToXyt(time: BN, tokenIn: BN, xytOut: BN) {
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

    approxBigNumber(actualTokenIn, tokenIn, consts.TEST_TOKEN_DELTA, false);
    approxBigNumber(actualXytOut, xytOut, consts.TEST_TOKEN_DELTA, false);
  }

  async function runTestXytToToken(time: BN, xytIn: BN, tokenOut: BN) {
    var {
      xytBalance: initialXytBalance,
      tokenBalance: initialTokenBalance,
    } = await env.stdMarket.getReserves();

    await setTimeNextBlock(time);
    if (useSwapIn) {
      await swapExactInXytToToken(env, alice, xytIn);
    } else {
      // tokenIn.mul(2): double the expected rate to make sure the transaction is successful.
      await swapExactOutXytToToken(env, alice, tokenOut);
    }
    var { xytBalance, tokenBalance } = await env.stdMarket.getReserves();

    var actualXytIn: BN = xytBalance.sub(initialXytBalance);
    var actualTokenOut: BN = initialTokenBalance.sub(tokenBalance);

    approxBigNumber(actualTokenOut, tokenOut, consts.TEST_TOKEN_DELTA);
    approxBigNumber(actualXytIn, xytIn, consts.TEST_TOKEN_DELTA);
  }

  /*-------------------------------------------------------------*/
  const amount = amountToWei(BN.from(1000), 6);
  await bootstrapMarket(env, alice, amount);
  await env.testToken.approve(env.stdMarket.address, consts.INF);

  await runTestTokenToXyt(
    env.T0.add(3600),
    BN.from(20405615),
    BN.from(20000000)
  );
  await runTestXytToToken(
    env.T0.add(3660),
    BN.from(120000000),
    BN.from(111303781)
  );
  await runTestTokenToXyt(
    env.T0.add(43200),
    BN.from(300000000),
    BN.from(273280448)
  );
  await runTestXytToToken(
    env.T0.add(43210),
    BN.from(74655258),
    BN.from(100000000)
  );
  await runTestXytToToken(
    env.T0.add(2592030),
    BN.from(100000000),
    BN.from(100716340)
  );
  await runTestXytToToken(
    env.T0.add(14515300),
    BN.from(200000000),
    BN.from(24266823)
  );
  await runTestTokenToXyt(
    env.T0.add(14861000),
    BN.from(26338047),
    BN.from(300000000)
  );
  await runTestXytToToken(
    env.T0.add(15120300),
    BN.from(400000000),
    BN.from(21595046)
  );
  await runTestTokenToXyt(
    env.T0.add(15120360),
    BN.from(3696839),
    BN.from(80000000)
  );
  await runTestXytToToken(
    env.T0.add(15379200),
    BN.from(800000016),
    BN.from(11997610)
  );
}

export async function AMMNearCloseTest(
  router: Contract,
  market: Contract,
  tokenUSDT: Token,
  testToken: Contract,
  xyt: Contract,
  bootstrapSampleMarket: Function,
  useSwapIn: boolean // if this is true, use swapExactIn. use swapExactOut otherwise.
) {
  async function swapExactInTokenToXyt(inAmount: BN) {
    await router.swapExactIn(
      testToken.address,
      xyt.address,
      inAmount,
      BN.from(0),
      consts.MARKET_FACTORY_AAVE,
      consts.HIGH_GAS_OVERRIDE
    );
  }

  async function swapExactInXytToToken(inAmount: BN) {
    await router.swapExactIn(
      xyt.address,
      testToken.address,
      inAmount,
      BN.from(0),
      consts.MARKET_FACTORY_AAVE,
      consts.HIGH_GAS_OVERRIDE
    );
  }

  async function swapExactOutTokenToXyt(outAmount: BN, inAmountLimit: BN) {
    await router.swapExactOut(
      testToken.address,
      xyt.address,
      outAmount,
      inAmountLimit,
      consts.MARKET_FACTORY_AAVE,
      consts.HIGH_GAS_OVERRIDE
    );
  }

  async function swapExactOutXytToToken(outAmount: BN, inAmountLimit: BN) {
    await router.swapExactOut(
      xyt.address,
      testToken.address,
      outAmount,
      inAmountLimit,
      consts.MARKET_FACTORY_AAVE,
      consts.HIGH_GAS_OVERRIDE
    );
  }

  async function addMarketLiquidityDual(amountXyt: BN | number, amountToken: BN | number) {
    await router.addMarketLiquidityDual(
      consts.MARKET_FACTORY_AAVE,
      xyt.address,
      testToken.address,
      amountXyt,
      amountToken,
      0,
      0,
      consts.HIGH_GAS_OVERRIDE
    );
  }

  async function runTestTokenToXyt(tokenIn: BN, xytOut: BN, delta: number) {
    var {
      xytBalance: initialXytBalance,
      tokenBalance: initialTokenBalance,
    } = await market.getReserves();

    if (useSwapIn) {
      await swapExactInTokenToXyt(tokenIn);
    } else {
      // tokenIn.mul(2): double the expected rate to make sure the transaction is successful.
      await swapExactOutTokenToXyt(xytOut, tokenIn.mul(2));
    }
    var { xytBalance, tokenBalance } = await market.getReserves();

    var actualXytOut = initialXytBalance.sub(xytBalance);
    var actualTokenIn = tokenBalance.sub(initialTokenBalance);

    expect(tokenIn.toNumber()).to.be.approximately(
      actualTokenIn.toNumber(),
      delta
    );
    expect(xytOut.toNumber()).to.be.approximately(
      actualXytOut.toNumber(),
      delta
    );
  }

  async function runTestXytToToken(xytIn: BN, tokenOut: BN, delta: number) {
    var {
      xytBalance: initialXytBalance,
      tokenBalance: initialTokenBalance,
    } = await market.getReserves();

    if (useSwapIn) {
      await swapExactInXytToToken(xytIn);
    } else {
      // tokenIn.mul(2): double the expected rate to make sure the transaction is successful.
      await swapExactOutXytToToken(tokenOut, xytIn.mul(2));
    }
    var { xytBalance, tokenBalance } = await market.getReserves();

    var actualXytIn: BN = xytBalance.sub(initialXytBalance);
    var actualTokenOut: BN = initialTokenBalance.sub(tokenBalance);

    expect(tokenOut.toNumber()).to.be.approximately(
      actualTokenOut.toNumber(),
      delta,
    );
    expect(xytIn.toNumber()).to.be.approximately(
      actualXytIn.toNumber(),
      delta
    );

  }

  let T = consts.T0.add(consts.SIX_MONTH).sub(consts.ONE_DAY.add(consts.ONE_HOUR));
  const amount = amountToWei(BN.from(10000), 6);
  await bootstrapSampleMarket(amount, amount.div(BN.from(10).pow(5)));

  await setTimeNextBlock(provider, T);
  await addMarketLiquidityDual(1, 1);

  await runTestXytToToken(
    BN.from(993586042),
    BN.from(120),
    15000
  );

  await runTestXytToToken(
    BN.from(2297718631),
    BN.from(240),
    30000
  );

  await runTestXytToToken(
    BN.from(6163346979),
    BN.from(480),
    90000
  );

  await runTestTokenToXyt(
    BN.from(1000),
    BN.from(10639807417),
    100
  );

  await runTestTokenToXyt(
    BN.from(10),
    BN.from(69158563),
    100
  );
} 

export async function AMMCheckLPNearCloseTest(
  router: Contract,
  market: Contract,
  tokenUSDT: Token,
  testToken: Contract,
  xyt: Contract,
  bootstrapSampleMarket: Function,
  useSwapIn: boolean, // if this is true, use swapExactIn. use swapExactOut otherwise.
  bob: Wallet
) {
  async function addMarketLiquidityDual(amountXyt: BN | number, amountToken: BN | number) {
    await router.addMarketLiquidityDual(
      consts.MARKET_FACTORY_AAVE,
      xyt.address,
      testToken.address,
      amountXyt,
      amountToken,
      0,
      0,
      consts.HIGH_GAS_OVERRIDE
    );
  }

  let lastRecordedLP = BN.from(0);

  async function addXyt(inAmount:BN) {
    await router.connect(bob).addMarketLiquiditySingle(
      consts.MARKET_FACTORY_AAVE,
      xyt.address,
      testToken.address,
      true,
      inAmount,
      0,
      consts.HIGH_GAS_OVERRIDE
    );
  }

  async function addToken(inAmount:BN) {
    await router.connect(bob).addMarketLiquiditySingle(
      consts.MARKET_FACTORY_AAVE,
      xyt.address,
      testToken.address,
      false,
      inAmount,
      0,
      consts.HIGH_GAS_OVERRIDE
    );
  }

  async function removeXyt(amountLP:BN) {
    await router.connect(bob).removeMarketLiquiditySingle(
      consts.MARKET_FACTORY_AAVE,
      xyt.address,
      testToken.address,
      true,
      amountLP,
      0,
      consts.HIGH_GAS_OVERRIDE
    );
  }

  async function removeToken(amountLP:BN) {
    await router.connect(bob).removeMarketLiquiditySingle(
      consts.MARKET_FACTORY_AAVE,
      xyt.address,
      testToken.address,
      false,
      amountLP,
      0,
      consts.HIGH_GAS_OVERRIDE
    );  
  }

  let bobLP = BN.from(0), bobXyt:BN, bobToken:BN;

  async function checkAmountLPGained(expectedLPGained:BN, delta:BN) {
    let totalLPGained = await market.balanceOf(bob.address);
    let LPGained = totalLPGained.sub(bobLP);
    bobLP = totalLPGained;
    approxBigNumber(
      LPGained,
      expectedLPGained,
      delta,
      true
    );
  }

  async function checkAmountTokenGained(expectedTokenGained:BN, delta:BN) {
    let totalTokenGained = await testToken.balanceOf(bob.address);
    let tokenGained = totalTokenGained.sub(bobToken);
    bobToken = totalTokenGained;
    approxBigNumber(
      tokenGained,
      expectedTokenGained,
      delta,
      true
    );
  }

  async function checkAmountXytGained(expectedXytGained:BN, delta:BN) {
    let totalXytGained = (await xyt.balanceOf(bob.address));
    let xytGained = totalXytGained.sub(bobXyt);
    bobXyt = totalXytGained;
    approxBigNumber(
      xytGained,
      expectedXytGained,
      delta,
      true
    );
  }


  let T = consts.T0.add(consts.SIX_MONTH).sub(consts.ONE_DAY.add(consts.ONE_HOUR));
  const amount = amountToWei(BN.from(1000), 6);
  await bootstrapSampleMarket(amount, amount.div(BN.from(10).pow(5)));

  await setTimeNextBlock(provider, T);
  await addMarketLiquidityDual(1, 1);

  await addXyt(BN.from(53241241));
  await checkAmountLPGained(
    BN.from(2053),
    BN.from(20)
  );

  await addToken(BN.from(53210));
  await checkAmountLPGained(
    BN.from(16381062),
    BN.from(30)
  );

  await addXyt(BN.from(100000000));
  await checkAmountLPGained(
    BN.from(22202),
    BN.from(30)
  );

  await addToken(BN.from(100000000));
  await checkAmountLPGained(
    BN.from(28227913256),
    BN.from(30000)
  );
  
  bobXyt = (await xyt.balanceOf(bob.address));
  bobToken = (await testToken.balanceOf(bob.address));

  await removeXyt(BN.from("1412375459"));
  await checkAmountXytGained(
    BN.from(1134092376), 
    BN.from(1000)
  );

  await removeToken(BN.from("14123754590"));
  await checkAmountTokenGained(
    BN.from(53111632),
    BN.from(1000)
  );
} 

