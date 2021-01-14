import { assert, expect } from "chai";
import { Contract, BigNumber } from "ethers";
import { createFixtureLoader } from "ethereum-waffle";

import { benchmarkMarketFixture } from "./fixtures";
import {
  constants,
  tokens,
  amountToWei,
  getAContract,
  evm_snapshot,
  evm_revert,
  advanceTime,
  Token,
} from "../helpers";
const { waffle } = require("hardhat");
const { deployContract, provider } = waffle;

describe("BenchmarkMarket", async () => {
  const wallets = provider.getWallets();
  const loadFixture = createFixtureLoader(wallets, provider);
  const [wallet, wallet1] = wallets;
  let benchmark: Contract;
  let benchmarkTreasury: Contract;
  let benchmarkAaveMarketFactory: Contract;
  let benchmarkData: Contract;
  let benchmarkOwnershipToken: Contract;
  let benchmarkFutureYieldToken: Contract;
  let lendingPoolCore: Contract;
  let benchmarkAaveForge: Contract;
  let benchmarkMarket: Contract;
  let testToken: Contract;
  let aUSDT: Contract;
  let snapshotId: string;
  let globalSnapshotId: string;
  let tokenUSDT: Token;
  before(async () => {
    globalSnapshotId = await evm_snapshot();

    const fixture = await loadFixture(benchmarkMarketFixture);
    benchmark = fixture.core.benchmark;
    benchmarkTreasury = fixture.core.benchmarkTreasury;
    benchmarkAaveMarketFactory = fixture.core.benchmarkAaveMarketFactory;
    benchmarkData = fixture.core.benchmarkData;
    benchmarkOwnershipToken = fixture.forge.benchmarkOwnershipToken;
    benchmarkFutureYieldToken = fixture.forge.benchmarkFutureYieldToken;
    benchmarkAaveForge = fixture.forge.benchmarkAaveForge;
    lendingPoolCore = fixture.aave.lendingPoolCore;
    testToken = fixture.testToken;
    benchmarkMarket = fixture.benchmarkMarket;
    tokenUSDT = tokens.USDT;
    aUSDT = await getAContract(wallet, lendingPoolCore, tokenUSDT);
    snapshotId = await evm_snapshot();
  });

  after(async () => {
    await evm_revert(globalSnapshotId);
  });

  beforeEach(async () => {
    await evm_revert(snapshotId);
    snapshotId = await evm_snapshot();
  });

  async function bootstrapSampleMarket(amountToTokenize: BigNumber, lowLevelCall: boolean = true) {
    if (lowLevelCall == true) {
      await benchmarkMarket.bootstrap(
        wallet.address,
        amountToTokenize,
        amountToTokenize,
        constants.HIGH_GAS_OVERRIDE
      );
    } else {
      await benchmark.bootStrapMarket(
        constants.FORGE_AAVE,
        constants.MARKET_FACTORY_AAVE,
        benchmarkFutureYieldToken.address,
        testToken.address,
        amountToTokenize,
        amountToTokenize,
        constants.HIGH_GAS_OVERRIDE
      );
    }

  }

  it("should be able to join a bootstrapped pool with a single tokenUSDT", async () => {
    const amountToTokenize = amountToWei(tokenUSDT, BigNumber.from(10));

    await bootstrapSampleMarket(amountToTokenize);

    await testToken.approve(benchmarkMarket.address, constants.MAX_ALLOWANCE);
    let totalSupply = await benchmarkMarket.totalSupply();
    let initalWalletBalance = await benchmarkMarket.balanceOf(wallet.address);
    await benchmarkMarket
      .joinPoolSingleToken(
        wallet.address,
        testToken.address,
        amountToTokenize.div(10),
        totalSupply.div(21)
      );
    let currentWalletBalance = await benchmarkMarket.balanceOf(wallet.address);
    expect(currentWalletBalance).to.be.gt(initalWalletBalance);
  });

  it("should be able to bootstrap", async () => {
    const amountToTokenize = amountToWei(tokenUSDT, BigNumber.from(100));

    await bootstrapSampleMarket(amountToTokenize);
    let yieldTokenBalance = await benchmarkFutureYieldToken.balanceOf(
      benchmarkMarket.address
    );
    let testTokenBalance = await testToken.balanceOf(benchmarkMarket.address);

    expect(yieldTokenBalance).to.be.equal(amountToTokenize);
    expect(testTokenBalance).to.be.equal(amountToTokenize);
  });

  it("should be able to join a bootstrapped pool", async () => {
    const amountToTokenize = amountToWei(tokenUSDT, BigNumber.from(10));

    await bootstrapSampleMarket(amountToTokenize);

    await testToken.approve(benchmarkMarket.address, constants.MAX_ALLOWANCE);

    const totalSupply = await benchmarkMarket.totalSupply();

    await benchmark
      .connect(wallet1)
      .addMarketLiquidity(
        constants.FORGE_AAVE,
        constants.MARKET_FACTORY_AAVE,
        benchmarkFutureYieldToken.address,
        testToken.address,
        totalSupply,
        amountToTokenize,
        amountToTokenize,
        constants.HIGH_GAS_OVERRIDE
      );

    let yieldTokenBalance = await benchmarkFutureYieldToken.balanceOf(
      benchmarkMarket.address
    );
    let testTokenBalance = await testToken.balanceOf(benchmarkMarket.address);
    let totalSupplyBalance = await benchmarkMarket.totalSupply();

    expect(yieldTokenBalance).to.be.equal(amountToTokenize.mul(2));
    expect(testTokenBalance).to.be.equal(amountToTokenize.mul(2));
    expect(totalSupplyBalance).to.be.equal(totalSupply.mul(2));
  });

  it("should be able to swap amount out", async () => {
    const amountToTokenize = amountToWei(tokenUSDT, BigNumber.from(100));

    await bootstrapSampleMarket(amountToTokenize);

    await benchmark
      .connect(wallet1)
      .swapXytFromToken(
        constants.FORGE_AAVE,
        constants.MARKET_FACTORY_AAVE,
        benchmarkFutureYieldToken.address,
        testToken.address,
        amountToTokenize.div(10),
        constants.MAX_ALLOWANCE,
        constants.MAX_ALLOWANCE,
        constants.HIGH_GAS_OVERRIDE
      );

    let yieldTokenBalance = await benchmarkFutureYieldToken.balanceOf(
      benchmarkMarket.address
    );
    let testTokenBalance = await testToken.balanceOf(benchmarkMarket.address);

    expect(yieldTokenBalance).to.be.equal(
      amountToTokenize.sub(amountToTokenize.div(10))
    );
    expect(testTokenBalance.toNumber()).to.be.approximately(111111080, 30);
  });

  it("should be able to swap amount in", async () => {
    const amountToTokenize = amountToWei(tokenUSDT, BigNumber.from(100));

    await bootstrapSampleMarket(amountToTokenize);

    await benchmark
      .connect(wallet1)
      .swapXytToToken(
        constants.FORGE_AAVE,
        constants.MARKET_FACTORY_AAVE,
        benchmarkFutureYieldToken.address,
        testToken.address,
        amountToTokenize.div(10),
        BigNumber.from(0),
        constants.MAX_ALLOWANCE,
        constants.HIGH_GAS_OVERRIDE
      );

    let yieldTokenBalance = await benchmarkFutureYieldToken.balanceOf(
      benchmarkMarket.address
    );
    let testTokenBalance = await testToken.balanceOf(benchmarkMarket.address);

    expect(yieldTokenBalance.toNumber()).to.be.approximately(
      amountToTokenize.add(amountToTokenize.div(10)).toNumber(),
      30
    );

    //TODO: calculates the exact expected amount based on curve shifting
    expect(testTokenBalance.toNumber()).to.be.approximately(
      amountToTokenize.sub(amountToTokenize.div(10)).toNumber(),
      amountToTokenize.div(100).toNumber()
    );
  });

  it("should be able to get spot price", async () => {
    const amountToTokenize = amountToWei(tokenUSDT, BigNumber.from(100));

    await benchmarkMarket.bootstrap(
      wallet1.address,
      amountToTokenize,
      amountToTokenize,
      constants.HIGH_GAS_OVERRIDE
    );

    let spotPrice = await benchmarkMarket.spotPrice(
      testToken.address,
      benchmarkFutureYieldToken.address
    );

    expect(spotPrice.toNumber()).to.be.approximately(
      1000000000000,
      100000000000
    );
  });

  it("should be able to exit a pool", async () => {
    const amountToTokenize = amountToWei(tokenUSDT, BigNumber.from(100));
    await bootstrapSampleMarket(amountToTokenize);
    await advanceTime(provider, constants.ONE_MONTH);
    const totalSuply = await benchmarkMarket.totalSupply();

    await benchmark.removeMarketLiquidity(
      constants.FORGE_AAVE,
      constants.MARKET_FACTORY_AAVE,
      benchmarkFutureYieldToken.address,
      testToken.address,
      totalSuply.div(10),
      amountToTokenize.div(10),
      amountToTokenize.div(10),
      constants.HIGH_GAS_OVERRIDE
    );

    let yieldTokenBalance = await benchmarkFutureYieldToken.balanceOf(
      benchmarkMarket.address
    );
    let testTokenBalance = await testToken.balanceOf(benchmarkMarket.address);

    expect(yieldTokenBalance).to.be.equal(
      amountToTokenize.sub(amountToTokenize.div(10))
    );
    expect(testTokenBalance).to.be.equal(
      amountToTokenize.sub(amountToTokenize.div(10))
    );
  });

  it("should be able to exit a pool with a single xyt token", async () => {
    const amountToTokenize = amountToWei(tokenUSDT, BigNumber.from(100));
    await benchmarkMarket.bootstrap(
      wallet.address,
      amountToTokenize,
      amountToTokenize,
      constants.HIGH_GAS_OVERRIDE
    );

    const initialFutureYieldTokenBalance = await benchmarkFutureYieldToken.balanceOf(
      wallet.address
    );
    const totalSupply = await benchmarkMarket.totalSupply();

    await advanceTime(provider, constants.ONE_MONTH);

    await benchmarkMarket.exitPoolSingleToken(
      wallet.address,
      benchmarkFutureYieldToken.address,
      totalSupply.div(4),
      amountToTokenize.div(6),
      constants.HIGH_GAS_OVERRIDE
    );

    const currentFutureYieldTokenBalance = await benchmarkFutureYieldToken.balanceOf(
      wallet.address
    );
    const expectedDifference = 43750000;

    expect(currentFutureYieldTokenBalance.sub(initialFutureYieldTokenBalance)).to.be.equal(expectedDifference);
  });

  it("should return correct reserves after bootstraping", async () => {
    const amountToTokenize = amountToWei(tokenUSDT, BigNumber.from(100));

    await benchmarkMarket.bootstrap(
      wallet.address,
      amountToTokenize,
      amountToTokenize,
      constants.HIGH_GAS_OVERRIDE
    );
    let [xytReserve, tokenReserve, blockTimestamp] = await benchmarkMarket.getReserves();
    expect(xytReserve).to.be.equal(amountToTokenize);
    expect(tokenReserve).to.be.equal(amountToTokenize);
    // TODO: add expect for blockTimestamp @Long
  });

  it("should be able to getMarketReserve", async () => {
    const amountToTokenize = amountToWei(tokenUSDT, BigNumber.from(100));

    await bootstrapSampleMarket(amountToTokenize);

    let [xytReserve, tokenReserve, currentTime] = await benchmark.getMarketReserves(
      constants.FORGE_AAVE,
      constants.MARKET_FACTORY_AAVE,
      benchmarkFutureYieldToken.address,
      testToken.address);
    expect(xytReserve).to.be.equal(amountToTokenize);
    expect(tokenReserve).to.be.equal(amountToTokenize);
    // TODO: add expect for currentTIme @Long
  });

  it("should be able to getMarketRateToken", async () => {
    const amountToTokenize = amountToWei(tokenUSDT, BigNumber.from(100));

    await bootstrapSampleMarket(amountToTokenize);

    let marketRate = await benchmark.getMarketRateToken(
      constants.FORGE_AAVE,
      constants.MARKET_FACTORY_AAVE,
      benchmarkFutureYieldToken.address,
      testToken.address);
    expect(marketRate.toNumber()).to.be.approximately(
      1000000000000,
      100000000000
    );
  });

  it("should be able to getMarketRateXyt", async () => {
    const amountToTokenize = amountToWei(tokenUSDT, BigNumber.from(100));

    await bootstrapSampleMarket(amountToTokenize);

    let marketRate = await benchmark.getMarketRateXyt(
      constants.FORGE_AAVE,
      constants.MARKET_FACTORY_AAVE,
      benchmarkFutureYieldToken.address,
      testToken.address);
    expect(marketRate.toNumber()).to.be.approximately(
      1000000000000,
      100000000000
    );
  });

  it("should be able to removeMarketLiquidityXyt", async () => { // correct but strange
    const amountToTokenize = amountToWei(tokenUSDT, BigNumber.from(100));
    await bootstrapSampleMarket(amountToTokenize);

    const initialFutureYieldTokenBalance = await benchmarkFutureYieldToken.balanceOf(
      wallet.address
    );
    const totalSupply = await benchmarkMarket.totalSupply();

    await advanceTime(provider, constants.ONE_MONTH);

    await benchmark.removeMarketLiquidityXyt(
      constants.FORGE_AAVE,
      constants.MARKET_FACTORY_AAVE,
      benchmarkFutureYieldToken.address,
      testToken.address,
      totalSupply.div(4),
      amountToTokenize.div(6),
      constants.HIGH_GAS_OVERRIDE);

    const currentFutureYieldTokenBalance = await benchmarkFutureYieldToken.balanceOf(
      wallet.address
    );
    const expectedDifference = 43750000;

    expect(currentFutureYieldTokenBalance.sub(initialFutureYieldTokenBalance)).to.be.equal(expectedDifference);
  });

  it("should be able to removeMarketLiquidityToken", async () => { // maybe correct but wrong name
    const amountToTokenize = amountToWei(tokenUSDT, BigNumber.from(100));

    await bootstrapSampleMarket(amountToTokenize);

    const initialTestTokenBalance = await testToken.balanceOf(
      wallet.address
    );
    const totalSupply = await benchmarkMarket.totalSupply();

    await advanceTime(provider, constants.ONE_MONTH);

    await benchmark.removeMarketLiquidityToken(
      constants.FORGE_AAVE,
      constants.MARKET_FACTORY_AAVE,
      benchmarkFutureYieldToken.address,
      testToken.address,
      totalSupply.div(4),
      amountToTokenize.div(6),
      constants.HIGH_GAS_OVERRIDE);

    const currentTestTokenBalance = await testToken.balanceOf(
      wallet.address
    );
    const expectedDifference = 43750000;

    expect(currentTestTokenBalance.sub(initialTestTokenBalance)).to.be.equal(expectedDifference);
  });

  it("should be able to addMarketLiquidityToken", async () => {
    const amountToTokenize = amountToWei(tokenUSDT, BigNumber.from(10));

    await bootstrapSampleMarket(amountToTokenize);

    await testToken.approve(benchmarkMarket.address, constants.MAX_ALLOWANCE);
    let totalSupply = await benchmarkMarket.totalSupply();
    let initalWalletBalance = await benchmarkMarket.balanceOf(wallet.address);
    await benchmark.addMarketLiquidityToken(
      constants.FORGE_AAVE,
      constants.MARKET_FACTORY_AAVE,
      benchmarkFutureYieldToken.address,
      testToken.address,
      amountToTokenize.div(10),
      totalSupply.div(21)
    );
    let currentWalletBalance = await benchmarkMarket.balanceOf(wallet.address);
    expect(currentWalletBalance).to.be.gt(initalWalletBalance);
    // TODO: change gt to approximate or equal @Long
  });

  it("should be able to getMarketTokenAddresses", async () => {
    let { token, xyt } = await benchmark.getMarketTokenAddresses(benchmarkMarket.address);
    expect(token).to.be.equal(testToken.address);
    expect(xyt).to.be.equal(benchmarkFutureYieldToken.address);
  });

  it("should be able to getAllMarkets", async () => {
    let filter = benchmarkAaveMarketFactory.filters.MarketCreated();
    let tx = await benchmark.createMarket(
      constants.FORGE_AAVE,
      constants.MARKET_FACTORY_AAVE,
      benchmarkFutureYieldToken.address,
      tokenUSDT.address,
      constants.THREE_MONTH_FROM_NOW,
      constants.HIGH_GAS_OVERRIDE
    );
    let allEvents = await benchmarkAaveMarketFactory.queryFilter(filter, tx.blockHash);
    let expectedMarkets: string[] = [];
    allEvents.forEach(event => {
      expectedMarkets.push((event.args!).market);
    });
    let allMarkets = await benchmark.getAllMarkets();
    expect(allMarkets).to.have.members(expectedMarkets);
  });

  it("shouldn't be able to create duplicated markets", async () => {
    await expect(benchmarkAaveMarketFactory.createMarket(
      constants.FORGE_AAVE,
      benchmarkFutureYieldToken.address,
      testToken.address,
      constants.THREE_MONTH_FROM_NOW,
      constants.HIGH_GAS_OVERRIDE
    ))
      .to.be.revertedWith('Benchmark: market already exists');
  });

  // it.only("should be able to getMarketByUnderlyingToken", async () => {
  // place holder only since the original function is not complete
  // });
});
