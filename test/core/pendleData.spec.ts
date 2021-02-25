import { expect } from "chai";
import { createFixtureLoader } from "ethereum-waffle";
import { Contract } from "ethers";
import { consts, evm_revert, evm_snapshot, Token, tokens } from "../helpers";
import { pendleMarketFixture } from "./fixtures";

const { waffle } = require("hardhat");
const provider = waffle.provider;

describe("PendleData", async () => {
  const wallets = provider.getWallets();
  const loadFixture = createFixtureLoader(wallets, provider);

  let pendleRouter: Contract;
  let pendleAMarketFactory: Contract;
  let pendleCMarketFactory: Contract;
  let pendleData: Contract;
  let pendleTreasury: Contract;
  let pendleXyt: Contract;
  let tokenUSDT: Token;
  let snapshotId: string;
  let globalSnapshotId: string;

  before(async () => {
    globalSnapshotId = await evm_snapshot();

    const fixture = await loadFixture(pendleMarketFixture);
    pendleRouter = fixture.core.pendleRouter;
    pendleTreasury = fixture.core.pendleTreasury;
    pendleData = fixture.core.pendleData;
    pendleAMarketFactory = fixture.core.pendleAMarketFactory;
    pendleCMarketFactory = fixture.core.pendleCMarketFactory;
    pendleXyt = fixture.aForge.pendleAFutureYieldToken;
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

  it("should be able to setMarketFees", async () => {
    await pendleData.setMarketFees(10, 100);
    let swapFee = await pendleData.swapFee();
    let exitFee = await pendleData.exitFee();
    expect(swapFee).to.be.eq(10);
    expect(exitFee).to.be.eq(100);
  });

  it("allMarketsLength", async () => {
    let allMarketsLength = await pendleData.allMarketsLength();
    expect(allMarketsLength).to.be.eq(3); // numbers of markets that have been created in pendleMarketFixture
  });

  it("getAllMarkets", async () => {
    let filter = pendleAMarketFactory.filters.MarketCreated();
    let tx = await pendleRouter.createMarket(
      consts.MARKET_FACTORY_AAVE,
      pendleXyt.address,
      tokenUSDT.address,
      consts.HIGH_GAS_OVERRIDE
    );
    let allEvents = await pendleAMarketFactory.queryFilter(
      filter,
      tx.blockHash
    );
    let expectedMarkets: string[] = [];
    allEvents.forEach((event) => {
      expectedMarkets.push(event.args!.market);
    });
    filter = pendleCMarketFactory.filters.MarketCreated();
    allEvents = await pendleCMarketFactory.queryFilter(filter, tx.blockHash);
    allEvents.forEach((event) => {
      expectedMarkets.push(event.args!.market);
    });
    let allMarkets = await pendleData.getAllMarkets();
    expect(allMarkets).to.have.members(expectedMarkets);
  });

  it("Should be able to setTreasury", async () => {
    await expect(pendleData.setTreasury(pendleTreasury.address))
      .to.emit(pendleData, "TreasurySet")
      .withArgs(pendleTreasury.address);
  });
});
