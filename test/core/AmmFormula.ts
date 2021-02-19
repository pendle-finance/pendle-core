import { expect } from "chai";
import { BigNumber as BN, Contract } from "ethers";
import { amountToWei, consts, setTimeNextBlock, Token } from "../helpers";

const { waffle } = require("hardhat");
const { provider } = waffle;

export async function AMMTest(
  pendleRouter: Contract,
  pendleMarket: Contract,
  tokenUSDT: Token,
  testToken: Contract,
  pendleXyt: Contract,
  bootstrapSampleMarket: Function
) {
  async function swapTokenToXyt(amount: BN) {
    await pendleRouter.swapExactIn(
      testToken.address,
      pendleXyt.address,
      amount,
      BN.from(0),
      consts.MAX_ALLOWANCE
    );
  }

  async function swapXytToToken(amount: BN) {
    await pendleRouter.swapExactIn(
      pendleXyt.address,
      testToken.address,
      amount,
      BN.from(0),
      consts.MAX_ALLOWANCE
    );
  }

  async function runTestTokenToXyt(time: BN, tokenIn: BN, xytOut: BN) {
    var {
      xytReserves: initialXytReserves,
      tokenReserves: initialTokenReserves,
    } = await pendleMarket.getReserves();

    await setTimeNextBlock(provider, time);
    await swapTokenToXyt(tokenIn);
    var { xytReserves, tokenReserves } = await pendleMarket.getReserves();

    var actualXytOut = initialXytReserves.sub(xytReserves);
    var actualTokenIn = tokenReserves.sub(initialTokenReserves);

    expect(tokenIn.toNumber()).to.be.approximately(
      actualTokenIn.toNumber(),
      consts.AMM_DELTA
    );
    expect(xytOut.toNumber()).to.be.approximately(
      actualXytOut.toNumber(),
      consts.AMM_DELTA
    );
  }

  async function runTestXytToToken(time: BN, xytIn: BN, tokenOut: BN) {
    var {
      xytReserves: initialXytReserves,
      tokenReserves: initialTokenReserves,
    } = await pendleMarket.getReserves();

    await setTimeNextBlock(provider, time);
    await swapXytToToken(xytIn);
    var { xytReserves, tokenReserves } = await pendleMarket.getReserves();

    var actualXytIn: BN = xytReserves.sub(initialXytReserves);
    var actualTokenOut: BN = initialTokenReserves.sub(tokenReserves);

    expect(tokenOut.toNumber()).to.be.approximately(
      actualTokenOut.toNumber(),
      consts.AMM_DELTA
    );
    expect(xytIn.toNumber()).to.be.approximately(
      actualXytIn.toNumber(),
      consts.AMM_DELTA
    );
  }

  /*-------------------------------------------------------------*/
  const amountToTokenize = amountToWei(tokenUSDT, BN.from(1000));
  await bootstrapSampleMarket(amountToTokenize);
  await testToken.approve(pendleMarket.address, consts.MAX_ALLOWANCE);

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
    consts.T0.add(15551400),
    BN.from(800000000),
    BN.from(42635)
  );
}
