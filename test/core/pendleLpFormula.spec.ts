import { expect } from "chai";
import { createFixtureLoader } from "ethereum-waffle";
import { BigNumber as BN, Contract, Wallet } from "ethers";
import {
  amountToWei,
  approxBigNumber,
  consts,
  evm_revert,
  evm_snapshot,
  setTimeNextBlock,
  toFixedPoint,
  Token,
  tokens,
} from "../helpers";
import { pendleMarketFixture } from "./fixtures";

const { waffle } = require("hardhat");
const { provider } = waffle;

// TODO: add tests that check for transfering unused tokens back to users
// TODO: add tests to test new math lib
describe("pendleLpFormula", async () => {
  const wallets = provider.getWallets();
  const loadFixture = createFixtureLoader(wallets, provider);
  const [alice, bob, charlie] = wallets;
  let pendleRouter: Contract;
  let pendleData: Contract;
  let pendleXyt: Contract;
  let pendleStdMarket: Contract;
  let testToken: Contract;
  let snapshotId: string;
  let globalSnapshotId: string;
  let tokenUSDT: Token;

  before(async () => {
    globalSnapshotId = await evm_snapshot();

    const fixture = await loadFixture(pendleMarketFixture);
    pendleRouter = fixture.core.pendleRouter;
    pendleData = fixture.core.pendleData;
    pendleXyt = fixture.forge.pendleFutureYieldToken;
    testToken = fixture.testToken;
    pendleStdMarket = fixture.pendleStdMarket;
    tokenUSDT = tokens.USDT;
    snapshotId = await evm_snapshot();
  });

  after(async () => {
    await evm_revert(globalSnapshotId);
  });

  beforeEach(async () => {
    await evm_revert(snapshotId);
    snapshotId = await evm_snapshot();
    await pendleData.setMarketFees(toFixedPoint("0.0035"), 0); // 0.35%
  });

  async function bootstrapMarket(amountOfXyt: BN, amountOfToken: BN) {
    await pendleRouter
      .connect(alice)
      .bootstrapMarket(
        consts.FORGE_AAVE,
        consts.MARKET_FACTORY_AAVE,
        pendleXyt.address,
        testToken.address,
        amountOfXyt,
        amountOfToken,
        consts.HIGH_GAS_OVERRIDE
      );
  }

  async function swapTokenToXyt(amount: BN) {
    // TODO: merge this function and the same function in AmmFormula
    await pendleRouter.swapExactIn(
      testToken.address,
      pendleXyt.address,
      amount,
      BN.from(0),
      consts.MAX_ALLOWANCE
    );
  }

  async function printMarketData() {
    console.log(
      `USDT weight: ${await pendleStdMarket.getWeight(
        testToken.address
      )} USDT balance: ${await pendleStdMarket.getBalance(
        testToken.address
      )} XYT weight: ${await pendleStdMarket.getWeight(
        pendleXyt.address
      )} XYT balance: ${await pendleStdMarket.getBalance(
        pendleXyt.address
      )} totalLp: ${await pendleStdMarket.totalSupply()}`
    );
  }

  async function addLiquiditySingleToken(
    user: Wallet,
    tokenAddress: string,
    amount: BN
  ) {
    if (tokenAddress == testToken.address) {
      await pendleRouter
        .connect(user)
        .addMarketLiquidityToken(
          consts.FORGE_AAVE,
          consts.MARKET_FACTORY_AAVE,
          pendleXyt.address,
          testToken.address,
          amount,
          BN.from(0)
        );
    } else {
      // if (tokenAddress == pendleXyt.address) {
      await pendleRouter
        .connect(user)
        .addMarketLiquidityXyt(
          consts.FORGE_AAVE,
          consts.MARKET_FACTORY_AAVE,
          pendleXyt.address,
          testToken.address,
          amount,
          BN.from(0)
        );
    }
  }

  async function removeLiquiditySingleToken(
    user: Wallet,
    tokenAddress: string,
    amount: BN
  ): Promise<BN> {
    let initialBalance: BN;
    let postBalance: BN;
    if (tokenAddress == testToken.address) {
      initialBalance = await testToken.balanceOf(user.address);
      await pendleRouter
        .connect(user)
        .removeMarketLiquidityToken(
          consts.FORGE_AAVE,
          consts.MARKET_FACTORY_AAVE,
          pendleXyt.address,
          testToken.address,
          amount,
          BN.from(0)
        );
      postBalance = await testToken.balanceOf(user.address);
    } else {
      // if (tokenAddress == pendleXyt.address)
      initialBalance = await pendleXyt.balanceOf(user.address);
      await pendleRouter
        .connect(user)
        .removeMarketLiquidityXyt(
          consts.FORGE_AAVE,
          consts.MARKET_FACTORY_AAVE,
          pendleXyt.address,
          testToken.address,
          amount,
          BN.from(0)
        );
      postBalance = await pendleXyt.balanceOf(user.address);
    }
    return postBalance.sub(initialBalance);
  }

  async function checkLpBalance(user: Wallet, expected: BN) {
    approxBigNumber(
      await pendleStdMarket.balanceOf(user.address),
      expected,
      consts.TEST_LP_DELTA
    );
  }

  // TODO: Investigate why market can handle a large amount of token swapping in
  it("add liquidity with single token test 1", async () => {
    const amountOfXyt = amountToWei(tokenUSDT, BN.from(331));
    const amountOfToken = amountToWei(tokenUSDT, BN.from(891));
    const T1 = consts.T0.add(consts.THREE_MONTH);
    const T2 = T1.add(consts.ONE_DAY);
    await bootstrapMarket(amountOfXyt, amountOfToken);

    await setTimeNextBlock(provider, T1);
    // weights: USDT: 660606624370, XYT: 438905003406

    await addLiquiditySingleToken(
      bob,
      testToken.address,
      amountToWei(tokenUSDT, BN.from(50))
    );
    await checkLpBalance(bob, BN.from("33301790282170172"));

    await setTimeNextBlock(provider, T2);
    await addLiquiditySingleToken(
      charlie,
      pendleXyt.address,
      amountToWei(tokenUSDT, BN.from(57))
    );
    await checkLpBalance(charlie, BN.from("67220816465474392"));
  });

  it("add liquidity with single token test 2", async () => {
    const amountOfXyt = amountToWei(tokenUSDT, BN.from(167));
    const amountOfToken = amountToWei(tokenUSDT, BN.from(381));
    const T1 = consts.T0.add(consts.ONE_MONTH);
    const T2 = T1.add(consts.ONE_DAY);
    await bootstrapMarket(amountOfXyt, amountOfToken);

    await setTimeNextBlock(provider, T1);
    // weights: USDT weight: 577209185546 XYT weight: 522302442230

    await addLiquiditySingleToken(
      bob,
      testToken.address,
      amountToWei(tokenUSDT, BN.from(157))
    );
    await checkLpBalance(bob, BN.from("198283961837071968"));

    await setTimeNextBlock(provider, T2);
    await addLiquiditySingleToken(
      charlie,
      pendleXyt.address,
      amountToWei(tokenUSDT, BN.from(36))
    );
    await checkLpBalance(charlie, BN.from("115989733684135088"));
  });

  it("add liquidity with single token test 3", async () => {
    const amountOfXyt = amountToWei(tokenUSDT, BN.from(45));
    const amountOfToken = amountToWei(tokenUSDT, BN.from(951));
    const T1 = consts.T0.add(consts.FIVE_MONTH);
    const T2 = T1.add(consts.ONE_DAY);
    await bootstrapMarket(amountOfXyt, amountOfToken);

    await setTimeNextBlock(provider, T1);
    // weights: USDT weight: 848215863334 XYT weight: 251295764442

    await addLiquiditySingleToken(
      bob,
      testToken.address,
      amountToWei(tokenUSDT, BN.from(729))
    );
    await checkLpBalance(bob, BN.from("550710168310602816"));

    await setTimeNextBlock(provider, T2);
    await addLiquiditySingleToken(
      charlie,
      pendleXyt.address,
      amountToWei(tokenUSDT, BN.from(12))
    );
    await checkLpBalance(charlie, BN.from("83998302108293488"));
  });

  it("remove liquidity with single token test 1", async () => {
    const amountOfXyt = amountToWei(tokenUSDT, BN.from(331));
    const amountOfToken = amountToWei(tokenUSDT, BN.from(891));
    const T1 = consts.T0.add(consts.THREE_MONTH);
    const T2 = T1.add(consts.ONE_DAY);
    await bootstrapMarket(amountOfXyt, amountOfToken);

    let lpBalanceAlice = await pendleStdMarket.balanceOf(alice.address);
    let amountToRemove = lpBalanceAlice.div(7);

    await setTimeNextBlock(provider, T1);
    // weights: USDT: 660606624370, XYT: 438905003406

    let balanceDiff: BN = await removeLiquiditySingleToken(
      alice,
      testToken.address,
      amountToRemove
    );
    expect(balanceDiff.toNumber()).to.be.approximately(
      201349414,
      consts.TEST_TOKEN_DELTA.toNumber()
    );

    await setTimeNextBlock(provider, T2);
    // weights: XYT weight: 436996733543
    balanceDiff = await removeLiquiditySingleToken(
      alice,
      pendleXyt.address,
      amountToRemove
    );
    expect(balanceDiff.toNumber()).to.be.approximately(
      121523300,
      consts.TEST_TOKEN_DELTA.toNumber()
    );
  });

  it("remove liquidity with single token test 2", async () => {
    const amountOfXyt = amountToWei(tokenUSDT, BN.from(167));
    const amountOfToken = amountToWei(tokenUSDT, BN.from(381));
    const T1 = consts.T0.add(consts.ONE_MONTH);
    const T2 = T1.add(consts.ONE_DAY);
    await bootstrapMarket(amountOfXyt, amountOfToken);

    let lpBalanceAlice = await pendleStdMarket.balanceOf(alice.address);
    let amountToRemove = lpBalanceAlice.div(15);

    await setTimeNextBlock(provider, T1);
    // weights: USDT weight: 577209185546 XYT weight: 522302442230
    let balanceDiff: BN = await removeLiquiditySingleToken(
      alice,
      testToken.address,
      amountToRemove
    );
    expect(balanceDiff.toNumber()).to.be.approximately(
      46843304,
      consts.TEST_TOKEN_DELTA.toNumber()
    );

    await setTimeNextBlock(provider, T2);
    // weights: XYT weight: 521269347121
    balanceDiff = await removeLiquiditySingleToken(
      alice,
      pendleXyt.address,
      amountToRemove
    );
    expect(balanceDiff.toNumber()).to.be.approximately(
      24122230,
      consts.TEST_TOKEN_DELTA.toNumber()
    );
  });

  it("remove liquidity with single token test 3", async () => {
    const amountOfXyt = amountToWei(tokenUSDT, BN.from(45));
    const amountOfToken = amountToWei(tokenUSDT, BN.from(951));
    const T1 = consts.T0.add(consts.FIVE_MONTH);
    const T2 = T1.add(consts.ONE_DAY);
    await bootstrapMarket(amountOfXyt, amountOfToken);

    let lpBalanceAlice = await pendleStdMarket.balanceOf(alice.address);
    let amountToRemove = lpBalanceAlice.div(2);

    await setTimeNextBlock(provider, T1);
    // weights: USDT weight: 848215863334 XYT weight: 251295764442
    let balanceDiff: BN = await removeLiquiditySingleToken(
      alice,
      testToken.address,
      amountToRemove
    );
    expect(balanceDiff.toNumber()).to.be.approximately(
      563321520,
      consts.TEST_TOKEN_DELTA.toNumber()
    );

    // weights: XYT weight: 245957533896
    // TODO: Enable this part after the math lib is fixed
    // await setTimeNextBlock(provider, T2);
    // balanceDiff = await removeLiquiditySingleToken(
    //   alice,
    //   pendleXyt.address,
    //   amountToRemove
    // );
    // expect(balanceDiff.toNumber()).to.be.approximately(
    //   44877732,
    //   consts.TEST_TOKEN_DELTA.toNumber()
    // );
  });

  it("add liquidity dual token test 1", async () => {
    const amountOfXyt = amountToWei(tokenUSDT, BN.from(331));
    const amountOfToken = amountToWei(tokenUSDT, BN.from(891));
    await bootstrapMarket(amountOfXyt, amountOfToken);

    const totalSupply: BN = await pendleStdMarket.totalSupply();
    // weights: USDT: 660606624370, XYT: 438905003406

    let initialXytBalance: BN = await pendleXyt.balanceOf(bob.address);
    let initialTokenBalance: BN = await testToken.balanceOf(bob.address);

    await pendleRouter
      .connect(bob)
      .addMarketLiquidity(
        consts.FORGE_AAVE,
        consts.MARKET_FACTORY_AAVE,
        pendleXyt.address,
        testToken.address,
        initialXytBalance,
        initialTokenBalance,
        totalSupply.mul(3),
        consts.HIGH_GAS_OVERRIDE
      );

    let finalXytBalance = await pendleXyt.balanceOf(bob.address);
    let finalTokenBalance = await testToken.balanceOf(bob.address);
    let amountXytUsed = initialXytBalance.sub(finalXytBalance);
    let amountTokenUsed = initialTokenBalance.sub(finalTokenBalance);

    await checkLpBalance(bob, totalSupply.mul(3));
    approxBigNumber(amountXytUsed, amountOfXyt.mul(3), consts.TEST_TOKEN_DELTA);
    approxBigNumber(
      amountTokenUsed,
      amountOfToken.mul(3),
      consts.TEST_TOKEN_DELTA
    );

    approxBigNumber(
      await pendleXyt.balanceOf(pendleStdMarket.address),
      amountOfXyt.mul(4),
      BN.from(0)
    );
    approxBigNumber(
      await testToken.balanceOf(pendleStdMarket.address),
      amountOfToken.mul(4),
      BN.from(0)
    );
    approxBigNumber(
      await pendleStdMarket.totalSupply(),
      totalSupply.mul(4),
      BN.from(0)
    );
  });

  it("remove liquidity dual token test 1", async () => {
    const amountOfXyt = amountToWei(tokenUSDT, BN.from(331));
    const amountOfToken = amountToWei(tokenUSDT, BN.from(891));
    await bootstrapMarket(amountOfXyt, amountOfToken);

    const totalSupply: BN = await pendleStdMarket.totalSupply();
    // weights: USDT: 660606624370, XYT: 438905003406

    let initialXytBalance: BN = await pendleXyt.balanceOf(alice.address);
    let initialTokenBalance: BN = await testToken.balanceOf(alice.address);

    await pendleRouter.removeMarketLiquidity(
      consts.FORGE_AAVE,
      consts.MARKET_FACTORY_AAVE,
      pendleXyt.address,
      testToken.address,
      totalSupply,
      BN.from(0),
      BN.from(0),
      consts.HIGH_GAS_OVERRIDE
    );

    await checkLpBalance(alice, BN.from(0));

    let finalXytBalance = await pendleXyt.balanceOf(alice.address);
    let finalTokenBalance = await testToken.balanceOf(alice.address);
    let amountXytReceived = finalXytBalance.sub(initialXytBalance);
    let amountTokenReceived = finalTokenBalance.sub(initialTokenBalance);

    approxBigNumber(amountXytReceived, amountOfXyt, consts.TEST_TOKEN_DELTA);
    approxBigNumber(
      amountTokenReceived,
      amountOfToken,
      consts.TEST_TOKEN_DELTA
    );

    approxBigNumber(
      await pendleXyt.balanceOf(pendleStdMarket.address),
      BN.from(0),
      BN.from(0)
    );
    approxBigNumber(
      await testToken.balanceOf(pendleStdMarket.address),
      BN.from(0),
      BN.from(0)
    );
    approxBigNumber(await pendleStdMarket.totalSupply(), BN.from(0), BN.from(0));
  });
});
