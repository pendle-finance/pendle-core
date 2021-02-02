import { assert, expect } from "chai";
import { createFixtureLoader } from "ethereum-waffle";
import { Contract } from "ethers";
import { evm_revert, evm_snapshot } from "../helpers";
import { pendleCoreFixture } from "./fixtures";

const { waffle } = require("hardhat");
const provider = waffle.provider;

describe("PendleData", async () => {
  const wallets = provider.getWallets();
  const loadFixture = createFixtureLoader(wallets, provider);

  let pendle: Contract;
  let pendleData: Contract;
  let snapshotId: string;
  let globalSnapshotId: string;

  before(async () => {
    globalSnapshotId = await evm_snapshot();

    const fixture = await loadFixture(pendleCoreFixture);
    pendle = fixture.pendle;
    pendleData = fixture.pendleData;

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
    await pendleData.setMarketFees(10, 100);
    let swapFee = await pendleData.swapFee();
    let exitFee = await pendleData.exitFee();
    expect(swapFee).to.be.eq(10);
    expect(exitFee).to.be.eq(100);
  });

  it("allMarketsLength", async () => {
    let allMarketsLength = await pendleData.allMarketsLength();
    expect(allMarketsLength).to.be.eq(0);
  });

  it("getAllMarkets", async () => {
    let getAllMarkets = await pendleData.getAllMarkets();
    assert(Array.isArray(getAllMarkets));
  });

  it("should be able to setCore", async () => {
    await expect(pendleData.setCore(pendle.address))
      .to.emit(pendleData, "CoreSet")
      .withArgs(pendle.address);
  });
});
