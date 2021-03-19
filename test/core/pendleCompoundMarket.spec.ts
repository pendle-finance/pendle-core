import { expect } from "chai";
import { createFixtureLoader } from "ethereum-waffle";
import { BigNumber as BN, Contract } from "ethers";
import {
  advanceTime,
  amountToWei,
  consts,
  evm_revert,
  evm_snapshot,
  Token,
  tokens,
} from "../helpers";
import { marketFixture } from "./fixtures";

const { waffle } = require("hardhat");
const { provider } = waffle;

describe("PendleCompoundMarket", async () => {
  const wallets = provider.getWallets();
  const loadFixture = createFixtureLoader(wallets, provider);
  const [alice, bob] = wallets;
  let router: Contract;
  let marketReader: Contract;
  let xyt: Contract;
  let stdMarket: Contract;
  let testToken: Contract;
  let snapshotId: string;
  let globalSnapshotId: string;
  let tokenUSDT: Token;

  before(async () => {
    globalSnapshotId = await evm_snapshot();

    const fixture = await loadFixture(marketFixture);
    router = fixture.core.router;
    marketReader = fixture.core.marketReader;
    xyt = fixture.cForge.cFutureYieldToken;
    testToken = fixture.testToken;
    stdMarket = fixture.cMarket;
    tokenUSDT = tokens.USDT;
    snapshotId = await evm_snapshot();
  });

  after(async () => {
    await evm_revert(globalSnapshotId);
  });

  beforeEach(async () => {
    await evm_revert(snapshotId);
    snapshotId = await evm_snapshot();
  });

  async function bootstrapSampleMarket(amount: BN) {
    await router.bootstrapMarket(
      consts.MARKET_FACTORY_COMPOUND,
      xyt.address,
      testToken.address,
      amount,
      amount,
      consts.HIGH_GAS_OVERRIDE
    );
  }

  it("should be able to join a bootstrapped market with a single standard token", async () => {
    const amount = amountToWei(BN.from(100), 6);

    await bootstrapSampleMarket(amount);

    let totalSupply = await stdMarket.totalSupply();
    let initalWalletBalance = await stdMarket.balanceOf(alice.address);
    await router.addMarketLiquiditySingle(
      consts.MARKET_FACTORY_COMPOUND,
      xyt.address,
      testToken.address,
      false,
      amount.div(10),
      totalSupply.div(21),
      consts.HIGH_GAS_OVERRIDE
    );
    let currentWalletBalance = await stdMarket.balanceOf(alice.address);
    expect(currentWalletBalance).to.be.gt(initalWalletBalance);
  });

  it("should be able to bootstrap", async () => {
    const amount = amountToWei(BN.from(100), 6);

    await bootstrapSampleMarket(amount);
    let xytBalance = await xyt.balanceOf(stdMarket.address);
    let testTokenBalance = await testToken.balanceOf(stdMarket.address);

    expect(xytBalance).to.be.equal(amount);
    expect(testTokenBalance).to.be.equal(amount);
  });

  it("should be able to join a bootstrapped pool by dual tokens", async () => {
    const amount = amountToWei(BN.from(10), 6);

    await bootstrapSampleMarket(amount);

    const totalSupply = await stdMarket.totalSupply();

    await router
      .connect(bob)
      .addMarketLiquidityAll(
        consts.MARKET_FACTORY_COMPOUND,
        xyt.address,
        testToken.address,
        amount,
        amount,
        totalSupply,
        consts.HIGH_GAS_OVERRIDE
      );

    let xytBalance = await xyt.balanceOf(stdMarket.address);
    let testTokenBalance = await testToken.balanceOf(stdMarket.address);
    let totalSupplyBalance = await stdMarket.totalSupply();

    expect(xytBalance).to.be.equal(amount.mul(2));
    expect(testTokenBalance).to.be.equal(amount.mul(2));
    expect(totalSupplyBalance).to.be.equal(totalSupply.mul(2));
  });

  it("should be able to swap amount out", async () => {
    const amount = amountToWei(BN.from(100), 6);

    await bootstrapSampleMarket(amount);

    let xytBalanceBefore = await xyt.balanceOf(stdMarket.address);

    let result = await marketReader.getMarketRateExactOut(
      xyt.address,
      testToken.address,
      amountToWei(BN.from(10), 6),
      consts.MARKET_FACTORY_COMPOUND
    );

    await router
      .connect(bob)
      .swapExactOut(
        xyt.address,
        testToken.address,
        amountToWei(BN.from(10), 6),
        amountToWei(BN.from(100), 6),
        consts.MAX_ALLOWANCE,
        consts.MARKET_FACTORY_COMPOUND,
        consts.HIGH_GAS_OVERRIDE
      );

    let xytBalance = await xyt.balanceOf(stdMarket.address);
    let testTokenBalance = await testToken.balanceOf(stdMarket.address);

    expect(xytBalance.toNumber()).to.be.approximately(
      xytBalanceBefore.add(BN.from(result[1])).toNumber(),
      20
    );
    expect(testTokenBalance).to.be.equal(amount.sub(amount.div(10)));
  });

  it("should be able to swap amount in", async () => {
    const amount = amountToWei(BN.from(100), 6);

    await bootstrapSampleMarket(amount);

    await router
      .connect(bob)
      .swapExactIn(
        xyt.address,
        testToken.address,
        amountToWei(BN.from(10), 6),
        BN.from(0),
        consts.MAX_ALLOWANCE,
        consts.MARKET_FACTORY_COMPOUND,
        consts.HIGH_GAS_OVERRIDE
      );

    let xytBalance = await xyt.balanceOf(stdMarket.address);
    let testTokenBalance = await testToken.balanceOf(stdMarket.address);

    expect(xytBalance.toNumber()).to.be.approximately(
      amount.add(amount.div(10)).toNumber(),
      30
    );

    expect(testTokenBalance.toNumber()).to.be.approximately(
      amount.sub(amount.div(10)).toNumber(),
      amount.div(100).toNumber()
    );
  });

  it("should be able to get spot price", async () => {
    const amount = amountToWei(BN.from(100), 6);

    await bootstrapSampleMarket(amount);

    let spotPrice = await stdMarket.spotPrice(testToken.address, xyt.address);

    expect(spotPrice.toNumber()).to.be.approximately(
      1000000000000,
      100000000000
    );
  });

  it("should be able to exit a pool by dual tokens", async () => {
    const amount = amountToWei(BN.from(100), 6);
    await bootstrapSampleMarket(amount);
    await advanceTime(provider, consts.ONE_MONTH);
    const totalSupply = await stdMarket.totalSupply();

    await router.removeMarketLiquidityAll(
      consts.MARKET_FACTORY_COMPOUND,
      xyt.address,
      testToken.address,
      totalSupply.div(10),
      BN.from(0),
      BN.from(0),
      consts.HIGH_GAS_OVERRIDE
    );

    let xytBalance = await xyt.balanceOf(stdMarket.address);
    let testTokenBalance = await testToken.balanceOf(stdMarket.address);

    expect(xytBalance).to.be.equal(amount.sub(amount.div(10)));
    expect(testTokenBalance).to.be.equal(amount.sub(amount.div(10)));
  });

  it("should be able to getReserves", async () => {
    const amount = amountToWei(BN.from(100), 6);

    await bootstrapSampleMarket(amount);

    let [
      xytReserve,
      tokenReserve,
      blockTimestamp,
    ] = await stdMarket.getReserves();
    expect(xytReserve).to.be.equal(amount);
    expect(tokenReserve).to.be.equal(amount);
  });

  it("should be able to getMarketReserve", async () => {
    const amount = amountToWei(BN.from(100), 6);

    await bootstrapSampleMarket(amount);

    let [
      xytReserve,
      tokenReserve,
      currentTime,
    ] = await marketReader.getMarketReserves(
      consts.MARKET_FACTORY_COMPOUND,
      xyt.address,
      testToken.address
    );
    expect(xytReserve).to.be.equal(amount);
    expect(tokenReserve).to.be.equal(amount);
  });

  it("should be able to getMarketRateExactOut", async () => {
    const amount = amountToWei(BN.from(100), 6);

    await bootstrapSampleMarket(amount);

    let result = await marketReader.getMarketRateExactOut(
      xyt.address,
      testToken.address,
      amountToWei(BN.from(10), 6),
      consts.MARKET_FACTORY_COMPOUND
    );

    expect(result[1].toNumber()).to.be.approximately(
      11111111,
      consts.TEST_TOKEN_DELTA.toNumber()
    );
  });

  it("should be able to getMarketRateExactIn", async () => {
    const amount = amountToWei(BN.from(100), 6);

    await bootstrapSampleMarket(amount);

    let result = await marketReader.getMarketRateExactIn(
      testToken.address,
      xyt.address,
      amountToWei(BN.from(10), 6),
      consts.MARKET_FACTORY_COMPOUND
    );

    expect(result[1].toNumber()).to.be.approximately(
      9090909,
      consts.TEST_TOKEN_DELTA.toNumber()
    );
  });

  it("should be able to add market liquidity for a token", async () => {
    const amount = amountToWei(BN.from(10), 6);

    await bootstrapSampleMarket(amount);
    await testToken.approve(stdMarket.address, consts.MAX_ALLOWANCE);

    let initalLpTokenBal = await stdMarket.balanceOf(alice.address);
    let initalXytBal = await xyt.balanceOf(alice.address);
    let initalTestTokenBal = await testToken.balanceOf(alice.address);

    let totalSupply = await stdMarket.totalSupply();
    await router.addMarketLiquiditySingle(
      consts.MARKET_FACTORY_COMPOUND,
      xyt.address,
      testToken.address,
      false,
      amount.div(10),
      totalSupply.div(21),
      consts.HIGH_GAS_OVERRIDE
    );

    let currentLpTokenBal = await stdMarket.balanceOf(alice.address);
    let currentXytBal = await xyt.balanceOf(alice.address);
    let currentTestTokenBal = await testToken.balanceOf(alice.address);

    expect(currentLpTokenBal).to.be.gt(initalLpTokenBal);
    expect(currentTestTokenBal).to.be.lt(initalTestTokenBal);
    expect(currentXytBal).to.be.equal(initalXytBal);
  });

  it("should be able to add XYT market liquidity", async () => {
    const amount = amountToWei(BN.from(10), 6);

    await bootstrapSampleMarket(amount);
    await testToken.approve(stdMarket.address, consts.MAX_ALLOWANCE);

    let initalLpTokenBal = await stdMarket.balanceOf(alice.address);
    let initalXytBal = await xyt.balanceOf(alice.address);
    let initalTestTokenBal = await testToken.balanceOf(alice.address);

    let totalSupply = await stdMarket.totalSupply();
    await router.addMarketLiquiditySingle(
      consts.MARKET_FACTORY_COMPOUND,
      xyt.address,
      testToken.address,
      true,
      amount.div(10),
      totalSupply.div(21),
      consts.HIGH_GAS_OVERRIDE
    );

    let currentLpTokenBal = await stdMarket.balanceOf(alice.address);
    let currentXytBal = await xyt.balanceOf(alice.address);
    let currentTestTokenBal = await testToken.balanceOf(alice.address);

    expect(currentLpTokenBal).to.be.gt(initalLpTokenBal);
    expect(currentTestTokenBal).to.be.equal(initalTestTokenBal);
    expect(currentXytBal).to.be.lt(initalXytBal);
  });

  it("should be able to getMarketTokenAddresses", async () => {
    let {
      token: receivedToken,
      xyt: receivedXyt,
    } = await marketReader.getMarketTokenAddresses(stdMarket.address);
    expect(receivedToken).to.be.equal(testToken.address);
    expect(receivedXyt).to.be.equal(xyt.address);
  });

  it("shouldn't be able to create duplicated markets", async () => {
    await expect(
      router.createMarket(
        consts.MARKET_FACTORY_COMPOUND,
        xyt.address,
        testToken.address,
        consts.HIGH_GAS_OVERRIDE
      )
    ).to.be.revertedWith("EXISTED_MARKET");
  });
});
