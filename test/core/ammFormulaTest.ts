import { expect } from "chai";
import { BigNumber as BN, Contract } from "ethers";
import { amountToWei, consts, setTimeNextBlock, Token } from "../helpers";

const { waffle } = require("hardhat");
const { provider } = waffle;

export async function AMMTest(
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
      consts.MAX_ALLOWANCE,
      consts.MARKET_FACTORY_AAVE
    );
  }

  async function swapExactInXytToToken(inAmount: BN) {
    await router.swapExactIn(
      xyt.address,
      testToken.address,
      inAmount,
      BN.from(0),
      consts.MAX_ALLOWANCE,
      consts.MARKET_FACTORY_AAVE
    );
  }

  async function swapExactOutTokenToXyt(outAmount: BN, inAmountLimit: BN) {
    await router.swapExactOut(
      testToken.address,
      xyt.address,
      outAmount,
      inAmountLimit,
      consts.MAX_ALLOWANCE,
      consts.MARKET_FACTORY_AAVE
    );
  }

  async function swapExactOutXytToToken(outAmount: BN, inAmountLimit: BN) {
    await router.swapExactOut(
      xyt.address,
      testToken.address,
      outAmount,
      inAmountLimit,
      consts.MAX_ALLOWANCE,
      consts.MARKET_FACTORY_AAVE
    );
  }

  async function runTestTokenToXyt(time: BN, tokenIn: BN, xytOut: BN) {
    var {
      xytReserves: initialXytReserves,
      tokenReserves: initialTokenReserves,
    } = await market.getReserves();

    await setTimeNextBlock(provider, time);
    if (useSwapIn) {
      await swapExactInTokenToXyt(tokenIn);
    } else {
      // tokenIn.mul(2): double the expected rate to make sure the transaction is successful.
      await swapExactOutTokenToXyt(xytOut, tokenIn.mul(2));
    }
    var { xytReserves, tokenReserves } = await market.getReserves();

    var actualXytOut = initialXytReserves.sub(xytReserves);
    var actualTokenIn = tokenReserves.sub(initialTokenReserves);

    expect(tokenIn.toNumber()).to.be.approximately(
      actualTokenIn.toNumber(),
      consts.TEST_TOKEN_DELTA.toNumber()
    );
    expect(xytOut.toNumber()).to.be.approximately(
      actualXytOut.toNumber(),
      consts.TEST_TOKEN_DELTA.toNumber()
    );
  }

  async function runTestXytToToken(time: BN, xytIn: BN, tokenOut: BN) {
    var {
      xytReserves: initialXytReserves,
      tokenReserves: initialTokenReserves,
    } = await market.getReserves();

    await setTimeNextBlock(provider, time);
    if (useSwapIn) {
      await swapExactInXytToToken(xytIn);
    } else {
      // tokenIn.mul(2): double the expected rate to make sure the transaction is successful.
      await swapExactOutXytToToken(tokenOut, xytIn.mul(2));
    }
    var { xytReserves, tokenReserves } = await market.getReserves();

    var actualXytIn: BN = xytReserves.sub(initialXytReserves);
    var actualTokenOut: BN = initialTokenReserves.sub(tokenReserves);

    expect(tokenOut.toNumber()).to.be.approximately(
      actualTokenOut.toNumber(),
      consts.TEST_TOKEN_DELTA.toNumber()
    );
    expect(xytIn.toNumber()).to.be.approximately(
      actualXytIn.toNumber(),
      consts.TEST_TOKEN_DELTA.toNumber()
    );
  }

  /*-------------------------------------------------------------*/
  const amount = amountToWei(BN.from(1000), 6);
  await bootstrapSampleMarket(amount);
  await testToken.approve(market.address, consts.MAX_ALLOWANCE);

  await runTestTokenToXyt(
    consts.T0.add(3600),
    BN.from(20405615),
    BN.from(20000000)
  );
  await runTestXytToToken(
    consts.T0.add(3660),
    BN.from(120000000),
    BN.from(111303781)
  );
  await runTestTokenToXyt(
    consts.T0.add(43200),
    BN.from(300000000),
    BN.from(273280448)
  );
  await runTestXytToToken(
    consts.T0.add(43210),
    BN.from(74655258),
    BN.from(100000000)
  );
  await runTestXytToToken(
    consts.T0.add(2592030),
    BN.from(100000000),
    BN.from(100716340)
  );
  await runTestXytToToken(
    consts.T0.add(14515300),
    BN.from(200000000),
    BN.from(24266823)
  );
  await runTestTokenToXyt(
    consts.T0.add(14861000),
    BN.from(26338047),
    BN.from(300000000)
  );
  await runTestXytToToken(
    consts.T0.add(15120300),
    BN.from(400000000),
    BN.from(21595046)
  );
  await runTestTokenToXyt(
    consts.T0.add(15120360),
    BN.from(3696839),
    BN.from(80000000)
  );
  await runTestXytToToken(
    consts.T0.add(15379200),
    BN.from(800000016),
    BN.from(11997610)
  );
}
