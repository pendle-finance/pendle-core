import { expect } from "chai";
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
  let benchmarkMarketFactory: Contract;
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
    benchmarkMarketFactory = fixture.core.benchmarkMarketFactory;
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

  it("should be able to bootstrap", async () => {
    const token = tokens.USDT;
    const amountToTokenize = amountToWei(token, BigNumber.from(100));

    await benchmarkMarket.bootstrap(
      amountToTokenize,
      amountToTokenize,
      constants.HIGH_GAS_OVERRIDE
    );
    let yieldTokenBalance = await benchmarkFutureYieldToken.balanceOf(
      benchmarkMarket.address
    );
    let testTokenBalance = await testToken.balanceOf(benchmarkMarket.address);
    let totalSupply = await benchmarkMarket.totalSupply();

    expect(yieldTokenBalance).to.be.equal(amountToTokenize);
    expect(testTokenBalance).to.be.equal(amountToTokenize);
  });

  it("should be able to join a bootstrapped pool", async () => {
    const token = tokens.USDT;
    const amountToTokenize = amountToWei(token, BigNumber.from(10));

    await benchmarkMarket.bootstrap(
      amountToTokenize,
      amountToTokenize,
      constants.HIGH_GAS_OVERRIDE
    );

    await testToken.approve(benchmarkMarket.address, constants.MAX_ALLOWANCE);

    const totalSupply = await benchmarkMarket.totalSupply();

    await benchmarkMarket
      .connect(wallet1)
      .joinPoolByAll(totalSupply, amountToTokenize, amountToTokenize);

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

    await benchmarkMarket.bootstrap(
      amountToTokenize,
      amountToTokenize,
      constants.HIGH_GAS_OVERRIDE
    );

    await benchmarkMarket
      .connect(wallet1)
      .swapAmountOut(
        testToken.address,
        constants.MAX_ALLOWANCE,
        benchmarkFutureYieldToken.address,
        amountToTokenize.div(10),
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
    expect(testTokenBalance.toNumber()).to.be.approximately(111111080, 20);
  });

  it("should be able to swap amount in", async () => {
    const token = tokens.USDT;
    const amountToTokenize = amountToWei(token, BigNumber.from(100));

    await benchmarkMarket.bootstrap(
      amountToTokenize,
      amountToTokenize,
      constants.HIGH_GAS_OVERRIDE
    );

    await benchmarkMarket
      .connect(wallet1)
      .swapAmountIn(
        amountToTokenize.div(10),
        testToken.address,
        benchmarkFutureYieldToken.address,
        BigNumber.from(0),
        constants.MAX_ALLOWANCE,
        constants.HIGH_GAS_OVERRIDE
      );

    let yieldTokenBalance = await benchmarkFutureYieldToken.balanceOf(
      benchmarkMarket.address
    );
    let testTokenBalance = await testToken.balanceOf(benchmarkMarket.address);

    expect(yieldTokenBalance.toNumber()).to.be.approximately(
      amountToTokenize.sub(amountToTokenize.div(10)).toNumber(),
      amountToTokenize.div(100).toNumber()
    );
    expect(testTokenBalance.toNumber()).to.be.eq(
      amountToTokenize.add(amountToTokenize.div(10))
    );
  });

  it("should be able to exit a pool", async () => {
    const token = tokens.USDT;
    const amountToTokenize = amountToWei(token, BigNumber.from(100));
    await benchmarkMarket.bootstrap(amountToTokenize, amountToTokenize);

    await advanceTime(provider, constants.ONE_MOUNTH);
    const totalSuply = await benchmarkMarket.totalSupply();

    await benchmarkMarket.exitPoolByAll(
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
});