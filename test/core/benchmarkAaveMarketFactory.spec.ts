import { expect, assert } from "chai";
import { Contract } from "ethers";
import { createFixtureLoader } from "ethereum-waffle";

import { benchmarkCoreFixture } from "./fixtures";
import { evm_revert, evm_snapshot } from "../helpers";

const { waffle } = require("hardhat");
const provider = waffle.provider;

describe("benchmarkAaveMarketFactory", async () => {
  const wallets = provider.getWallets();
  const loadFixture = createFixtureLoader(wallets, provider);

  let benchmarkAaveMarketFactory: Contract;
  let benchmark: Contract;
  let snapshotId: string;
  let globalSnapshotId: string;

  before(async () => {
    globalSnapshotId = await evm_snapshot();

    const fixture = await loadFixture(benchmarkCoreFixture);
    benchmarkAaveMarketFactory = fixture.benchmarkAaveMarketFactory;
    benchmark = fixture.benchmark;
    snapshotId = await evm_snapshot();
  });

  after(async () => {
    await evm_revert(globalSnapshotId);
  });

  beforeEach(async () => {
    await evm_revert(snapshotId);
    snapshotId = await evm_snapshot();
  });

  it("should be able to setCore", async () => {
    await expect((benchmarkAaveMarketFactory.setCore(benchmark.address)))
      .to.emit(benchmarkAaveMarketFactory, 'CoreSet')
      .withArgs(benchmark.address);
  });
});
