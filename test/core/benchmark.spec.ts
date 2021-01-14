import { expect } from "chai";
import { Contract, BigNumber } from "ethers";
import { createFixtureLoader } from "ethereum-waffle";

import { benchmarkFixture } from "./fixtures";
import {
  constants,
  tokens,
  amountToWei,
  getAContract,
  advanceTime,
  getLiquidityRate,
  getGain,
  evm_revert,
  evm_snapshot,
} from "../helpers";
import { toUtf8CodePoints } from "ethers/lib/utils";

const { waffle } = require("hardhat");
const provider = waffle.provider;

describe("Benchmark", async () => {
  const wallets = provider.getWallets();
  const loadFixture = createFixtureLoader(wallets, provider);
  const [wallet] = wallets;

  let benchmark: Contract;
  let benchmarkTreasury: Contract;
  let benchmarkAaveMarketFactory: Contract;
  let benchmarkData: Contract;
  let benchmarkOwnershipToken: Contract;
  let benchmarkFutureYieldToken: Contract;
  let lendingPoolCore: Contract;
  let benchmarkAaveForge: Contract;
  let snapshotId: string;
  let globalSnapshotId: string;

  before(async () => {
    globalSnapshotId = await evm_snapshot();

    const fixture = await loadFixture(benchmarkFixture);
    benchmark = fixture.core.benchmark;
    benchmarkTreasury = fixture.core.benchmarkTreasury;
    benchmarkAaveMarketFactory = fixture.core.benchmarkAaveMarketFactory;
    benchmarkData = fixture.core.benchmarkData;
    benchmarkOwnershipToken = fixture.forge.benchmarkOwnershipToken;
    benchmarkFutureYieldToken = fixture.forge.benchmarkFutureYieldToken;
    benchmarkAaveForge = fixture.forge.benchmarkAaveForge;
    lendingPoolCore = fixture.aave.lendingPoolCore;
    snapshotId = await evm_snapshot();
  });

  after(async () => {
    await evm_revert(globalSnapshotId);
  });

  beforeEach(async () => {
    await evm_revert(snapshotId);
    snapshotId = await evm_snapshot();
  });

  it("should be able to deposit aUSDT to get back OT and XYT", async () => {
    const token = tokens.USDT;
    const amountToTokenize = amountToWei(token, BigNumber.from(100));
    await benchmark.tokenizeYield(
      constants.FORGE_AAVE,
      token.address,
      constants.SIX_MONTH_FROM_NOW,
      amountToTokenize,
      wallet.address
    );
    const balanceOwnershipToken = await benchmarkOwnershipToken.balanceOf(
      wallet.address
    );
    const balanceFutureYieldToken = await benchmarkFutureYieldToken.balanceOf(
      wallet.address
    );
    expect(balanceOwnershipToken).to.be.eq(amountToTokenize);
    expect(balanceFutureYieldToken).to.be.eq(amountToTokenize);
  });

  it("[After 1 month] should be able to redeem aUSDT to get back OT, XYT and interests $", async () => {
    const token = tokens.USDT;
    const aUSDT = await getAContract(wallet, lendingPoolCore, token);

    const initialAUSDTbalance = await aUSDT.balanceOf(wallet.address);
    const amountToTokenize = amountToWei(token, BigNumber.from(100));
    await benchmark.tokenizeYield(
      constants.FORGE_AAVE,
      token.address,
      constants.SIX_MONTH_FROM_NOW,
      amountToTokenize,
      wallet.address,
      constants.HIGH_GAS_OVERRIDE
    );
    await advanceTime(provider, constants.ONE_MONTH);

    await benchmark.redeemUnderlying(
      constants.FORGE_AAVE,
      token.address,
      constants.SIX_MONTH_FROM_NOW,
      amountToTokenize,
      wallet.address,
      constants.HIGH_GAS_OVERRIDE
    );

    const finalAUSDTbalance = await aUSDT.balanceOf(wallet.address);
    const rate = await getLiquidityRate(wallet, token);
    const gain = getGain(amountToTokenize, rate, constants.ONE_MONTH);
    expect(finalAUSDTbalance.toNumber()).to.be.approximately(
      initialAUSDTbalance.add(gain).toNumber(),
      20
    );
  });

  it("[After 1 month] should be able to get due interests", async () => {
    const token = tokens.USDT;
    const aUSDT = await getAContract(wallet, lendingPoolCore, token);
    const amountToTokenize = amountToWei(token, BigNumber.from(100));
    const wallet1 = wallets[1];
    const initialAUSDTbalance = await aUSDT.balanceOf(wallet.address);

    await benchmark.tokenizeYield(
      constants.FORGE_AAVE,
      token.address,
      constants.SIX_MONTH_FROM_NOW,
      amountToTokenize,
      wallet.address
    );

    const balance = await benchmarkOwnershipToken.balanceOf(wallet.address);
    await benchmarkOwnershipToken.transfer(wallet1.address, balance);

    const afterLendingAUSDTbalance = await aUSDT.balanceOf(wallet.address);
    await advanceTime(provider, constants.ONE_MONTH);

    await benchmark.redeemDueInterests(
      constants.FORGE_AAVE,
      token.address,
      constants.SIX_MONTH_FROM_NOW
    );

    const rate = await getLiquidityRate(wallet, token);
    const gain = getGain(amountToTokenize, rate, constants.ONE_MONTH);

    const finalAUSDTbalance = await aUSDT.balanceOf(wallet.address);

    expect(finalAUSDTbalance).to.be.below(initialAUSDTbalance);
    expect(finalAUSDTbalance.toNumber()).to.be.approximately(
      afterLendingAUSDTbalance.add(gain).toNumber(),
      10
    );
  });

  it("Short after expiry, should be able to redeem aUSDT from OT", async () => {
    const token = tokens.USDT;
    const aUSDT = await getAContract(wallet, lendingPoolCore, token);

    const amountToTokenize = amountToWei(token, BigNumber.from(100));
    const wallet1 = wallets[1];
    const initialAUSDTbalance = await aUSDT.balanceOf(wallet.address);

    await benchmark.tokenizeYield(
      constants.FORGE_AAVE,
      token.address,
      constants.SIX_MONTH_FROM_NOW,
      amountToTokenize,
      wallet.address
    );
    await benchmarkFutureYieldToken.transfer(wallet1.address, amountToTokenize);
    const duration = constants.SIX_MONTH_FROM_NOW.sub(
      Math.round(Date.now() / 1000)
    ).sub(10);

    await advanceTime(provider, duration);

    const wallet1Benchmark = benchmark.connect(wallet1);

    await wallet1Benchmark.redeemDueInterests(
      constants.FORGE_AAVE,
      token.address,
      constants.SIX_MONTH_FROM_NOW
    );

    const wallet1Gain = await aUSDT.balanceOf(wallet1.address);
    const rate = await getLiquidityRate(wallet, token);
    const gain = getGain(amountToTokenize, rate, duration);

    expect(wallet1Gain.toNumber()).to.be.approximately(gain.toNumber(), 20);

    await advanceTime(provider, BigNumber.from(60));

    await benchmark.redeemAfterExpiry(
      constants.FORGE_AAVE,
      token.address,
      constants.SIX_MONTH_FROM_NOW,
      wallet.address
    );
    const finalAUSDTbalance = await aUSDT.balanceOf(wallet.address);
    expect(finalAUSDTbalance.toNumber()).to.be.approximately(
      initialAUSDTbalance.toNumber(),
      20
    );
  });

  it("One month after expiry, should be able to redeem aUSDT with intrest", async () => {
    const token = tokens.USDT;
    const aUSDT = await getAContract(wallet, lendingPoolCore, token);

    const amountToTokenize = amountToWei(token, BigNumber.from(100));
    const wallet1 = wallets[1];
    const initialAUSDTbalance = await aUSDT.balanceOf(wallet.address);

    await benchmark.tokenizeYield(
      constants.FORGE_AAVE,
      token.address,
      constants.SIX_MONTH_FROM_NOW,
      amountToTokenize,
      wallet.address
    );
    await benchmarkFutureYieldToken.transfer(wallet1.address, amountToTokenize);
    const duration = constants.SIX_MONTH_FROM_NOW.sub(
      Math.round(Date.now() / 1000)
    ).sub(10);

    await advanceTime(provider, duration);

    const wallet1Benchmark = benchmark.connect(wallet1);

    await wallet1Benchmark.redeemDueInterests(
      constants.FORGE_AAVE,
      token.address,
      constants.SIX_MONTH_FROM_NOW
    );

    await advanceTime(provider, constants.ONE_MONTH);

    await benchmark.redeemAfterExpiry(
      constants.FORGE_AAVE,
      token.address,
      constants.SIX_MONTH_FROM_NOW,
      wallet.address
    );

    const rate = await getLiquidityRate(wallet, token);
    const gain = getGain(amountToTokenize, rate, constants.ONE_MONTH);

    const finalAUSDTbalance = await aUSDT.balanceOf(wallet.address);
    expect(finalAUSDTbalance.toNumber()).to.be.approximately(
      initialAUSDTbalance.add(gain).toNumber(),
      40000
    );
  });

  it("Should be able to remove a forge", async () => {
    await benchmark.removeForge(constants.FORGE_AAVE);
    let deleted = await benchmarkData.getForgeAddress(constants.FORGE_AAVE);
    expect(deleted).to.be.equal("0x0000000000000000000000000000000000000000");
  });

  it("Should be able to create a new yield contract", async () => {
    const token = tokens.USDT;
    let { otAddress, xytAddress } = await benchmark
      .newYieldContracts(constants.FORGE_AAVE, token.address, constants.SIX_MONTH_FROM_NOW);

    expect(otAddress).to.not.eq(0);
    expect(xytAddress).to.not.eq(0);
    // TODO: check for event emit @Long
    // await evm_revert(snapshotId);

    // await expect(benchmark
    //   .newYieldContracts(constants.FORGE_AAVE, token.address, constants.SIX_MONTH_FROM_NOW))
    //   .to.emit(benchmarkAaveForge, 'NewYieldContracts').withArgs(otAddress, xytAddress, constants.SIX_MONTH_FROM_NOW);
  });

  // it("Should be able to get market reserve", async () => {

  //   let [otAddress, xytAddress] = await benchmark
  //     .newYieldContracts(constants.FORGE_AAVE, tokens.address, constants.SIX_MONTH_FROM_NOW);

  //   expect(otAddress).to.not.eq(0);
  //   expect(xytAddress).to.not.eq(0);

  //   await expect(benchmark
  //     .newYieldContracts(constants.FORGE_AAVE, tokens.address, constants.SIX_MONTH_FROM_NOW))
  //     .to.emit(benchmarkAaveForge, 'NewYieldContracts').withArgs(otAddress, xytAddress, constants.SIX_MONTH_FROM_NOW);
  // });
});
