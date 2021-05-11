import { BigNumber as BN } from "ethers";
import { amountToWei, consts, setTimeNextBlock, bootstrapMarket, swapExactInTokenToXyt, swapExactInXytToToken, swapExactOutTokenToXyt, swapExactOutXytToToken, approxBigNumber } from "../helpers";
import {
  TestEnv,
} from "./fixtures";


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
