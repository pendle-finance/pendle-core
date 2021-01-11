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
    aUSDT = await getAContract(wallet, lendingPoolCore, tokens.USDT);
    snapshotId = await evm_snapshot();
  });

  after(async () => {
    await evm_revert(globalSnapshotId);
  });

  beforeEach(async () => {
    await evm_revert(snapshotId);
    snapshotId = await evm_snapshot();
  });

  it("should be able to join a bootstrapped pool with a single token", async () => {
    const token = tokens.USDT;
    const amountToTokenize = amountToWei(token, BigNumber.from(10));

    await benchmarkMarket.bootstrap(
      wallet1.address,
      amountToTokenize,
      amountToTokenize,
      constants.HIGH_GAS_OVERRIDE
    );

    await testToken.approve(benchmarkMarket.address, constants.MAX_ALLOWANCE);
    let totalSupplyBalance = await benchmarkMarket.totalSupply();

    await benchmarkMarket
      .connect(wallet1)
      .joinPoolSingleToken(
        wallet1.address,
        testToken.address,
        amountToTokenize.div(10),
        totalSupplyBalance.div(21)
      );
    let wallet1Balance = await benchmarkMarket.balanceOf(wallet1.address);
    assert(BigNumber.from(wallet1Balance).gt(0));
  });

  it("should be able to bootstrap", async () => {
    const token = tokens.USDT;
    const amountToTokenize = amountToWei(token, BigNumber.from(100));

    await benchmark.bootStrapMarket(
      constants.FORGE_AAVE,
      constants.MARKET_FACTORY_AAVE,
      benchmarkFutureYieldToken.address,
      testToken.address,
      amountToTokenize,
      amountToTokenize,
      constants.HIGH_GAS_OVERRIDE
    );
    let yieldTokenBalance = await benchmarkFutureYieldToken.balanceOf(
      benchmarkMarket.address
    );
    let testTokenBalance = await testToken.balanceOf(benchmarkMarket.address);

    expect(yieldTokenBalance).to.be.equal(amountToTokenize);
    expect(testTokenBalance).to.be.equal(amountToTokenize);
  });

  it("should be able to join a bootstrapped pool", async () => {
    const token = tokens.USDT;
    const amountToTokenize = amountToWei(token, BigNumber.from(10));

    await benchmark.bootStrapMarket(
      constants.FORGE_AAVE,
      constants.MARKET_FACTORY_AAVE,
      benchmarkFutureYieldToken.address,
      testToken.address,
      amountToTokenize,
      amountToTokenize,
      constants.HIGH_GAS_OVERRIDE
    );

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
    const token = tokens.USDT;
    const amountToTokenize = amountToWei(token, BigNumber.from(100));

    await benchmark.bootStrapMarket(
      constants.FORGE_AAVE,
      constants.MARKET_FACTORY_AAVE,
      benchmarkFutureYieldToken.address,
      testToken.address,
      amountToTokenize,
      amountToTokenize,
      constants.HIGH_GAS_OVERRIDE
    );

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
    const token = tokens.USDT;
    const amountToTokenize = amountToWei(token, BigNumber.from(100));

    await benchmark.bootStrapMarket(
      constants.FORGE_AAVE,
      constants.MARKET_FACTORY_AAVE,
      benchmarkFutureYieldToken.address,
      testToken.address,
      amountToTokenize,
      amountToTokenize,
      constants.HIGH_GAS_OVERRIDE
    );

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
    const token = tokens.USDT;
    const amountToTokenize = amountToWei(token, BigNumber.from(100));

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
    const token = tokens.USDT;
    const amountToTokenize = amountToWei(token, BigNumber.from(100));
    await benchmark.bootStrapMarket(
      constants.FORGE_AAVE,
      constants.MARKET_FACTORY_AAVE,
      benchmarkFutureYieldToken.address,
      testToken.address,
      amountToTokenize,
      amountToTokenize,
      constants.HIGH_GAS_OVERRIDE
    );
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

  it("should be able to exit a pool with a single token", async () => {
    const token = tokens.USDT;
    const amountToTokenize = amountToWei(token, BigNumber.from(100));
    await benchmarkMarket.bootstrap(
      wallet.address,
      amountToTokenize,
      amountToTokenize,
      constants.HIGH_GAS_OVERRIDE
    );

    await advanceTime(provider, constants.ONE_MONTH);

    const totalSupply = await benchmarkMarket.totalSupply();

    await benchmarkMarket.exitPoolSingleToken(
      wallet.address,
      benchmarkFutureYieldToken.address,
      totalSupply.div(4),
      amountToTokenize.div(6),
      constants.HIGH_GAS_OVERRIDE
    );

    let benchmarkFutureYieldTokenBalance = await benchmarkFutureYieldToken.balanceOf(
      wallet.address
    );

    expect(benchmarkFutureYieldTokenBalance).to.be.equal(43750000);
  });
});
