import { expect, assert } from "chai";
import { Contract } from "ethers";
import { createFixtureLoader } from "ethereum-waffle";

import { pendleCoreFixture } from "./fixtures";
import { evm_revert, evm_snapshot } from "../helpers";

const { waffle } = require("hardhat");
const provider = waffle.provider;

describe("pendleAaveMarketFactory", async () => {
  const wallets = provider.getWallets();
  const loadFixture = createFixtureLoader(wallets, provider);

  let pendleAaveMarketFactory: Contract;
  let pendle: Contract;
  let snapshotId: string;
  let globalSnapshotId: string;

  before(async () => {
    globalSnapshotId = await evm_snapshot();

    const fixture = await loadFixture(pendleCoreFixture);
    pendleAaveMarketFactory = fixture.pendleAaveMarketFactory;
    pendle = fixture.pendle;
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
    await expect(pendleAaveMarketFactory.setCore(pendle.address))
      .to.emit(pendleAaveMarketFactory, "CoreSet")
      .withArgs(pendle.address);
  });
});
