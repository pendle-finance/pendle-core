import { expect, assert } from "chai";
import { Contract } from "ethers";
import { createFixtureLoader } from "ethereum-waffle";

import { benchmarkCoreFixture } from "./fixtures";
import { evm_revert, evm_snapshot } from "../helpers";

const { waffle } = require("hardhat");
const provider = waffle.provider;

describe("BenchmarkData", async () => {
  const wallets = provider.getWallets();
  const loadFixture = createFixtureLoader(wallets, provider);

  let benchmarkData: Contract;
  let snapshotId: string;
  let globalSnapshotId: string;

  before(async () => {
    globalSnapshotId = await evm_snapshot();

    const fixture = await loadFixture(benchmarkCoreFixture);
    benchmarkData = fixture.benchmarkData;

    snapshotId = await evm_snapshot();
  });

  after(async () => {
    await evm_revert(globalSnapshotId);
  });

  beforeEach(async () => {
    await evm_revert(snapshotId);
    snapshotId = await evm_snapshot();
  });

  it("should be able to setMarketFees", async () => {
    await benchmarkData.setMarketFees(10, 100);
    let swapFee = await benchmarkData.swapFee();
    let exitFee = await benchmarkData.exitFee();
    expect(swapFee).to.be.eq(10);
    expect(exitFee).to.be.eq(100);
  });

  it("allMarketsLength", async () => {
    let allMarketsLength = await benchmarkData.allMarketsLength();
    expect(allMarketsLength).to.be.eq(0);
  });

  it("getAllMarkets", async () => {
    let getAllMarkets = await benchmarkData.getAllMarkets();
    assert(Array.isArray(getAllMarkets));
  });
});
