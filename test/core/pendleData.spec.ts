import { expect } from "chai";
import { createFixtureLoader } from "ethereum-waffle";
import { Contract } from "ethers";
import { consts, evm_revert, evm_snapshot, Token, tokens } from "../helpers";
import { marketFixture } from "./fixtures";

const { waffle } = require("hardhat");
const provider = waffle.provider;

describe("PendleData", async () => {
  const wallets = provider.getWallets();
  const loadFixture = createFixtureLoader(wallets, provider);

  let router: Contract;
  let aMarketFactory: Contract;
  let cMarketFactory: Contract;
  let data: Contract;
  let treasury: Contract;
  let xyt: Contract;
  let tokenUSDT: Token;
  let snapshotId: string;
  let globalSnapshotId: string;

  before(async () => {
    globalSnapshotId = await evm_snapshot();

    const fixture = await loadFixture(marketFixture);
    router = fixture.core.router;
    treasury = fixture.core.treasury;
    data = fixture.core.data;
    aMarketFactory = fixture.core.aMarketFactory;
    cMarketFactory = fixture.core.cMarketFactory;
    xyt = fixture.aForge.aFutureYieldToken;
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
    await data.setMarketFees(10, 100);
    let swapFee = await data.swapFee();
    let exitFee = await data.exitFee();
    expect(swapFee).to.be.eq(10);
    expect(exitFee).to.be.eq(100);
  });

  it("allMarketsLength", async () => {
    let allMarketsLength = await data.allMarketsLength();
    expect(allMarketsLength).to.be.eq(3); // numbers of markets that have been created in marketFixture
  });

  it("getAllMarkets", async () => {
    let filter = aMarketFactory.filters.MarketCreated();
    let tx = await router.createMarket(
      consts.MARKET_FACTORY_AAVE,
      xyt.address,
      tokenUSDT.address,
      consts.HIGH_GAS_OVERRIDE
    );
    let allEvents = await aMarketFactory.queryFilter(filter, tx.blockHash);
    let expectedMarkets: string[] = [];
    allEvents.forEach((event) => {
      expectedMarkets.push(event.args!.market);
    });
    filter = cMarketFactory.filters.MarketCreated();
    allEvents = await cMarketFactory.queryFilter(filter, tx.blockHash);
    allEvents.forEach((event) => {
      expectedMarkets.push(event.args!.market);
    });
    let allMarkets = await data.getAllMarkets();
    expect(allMarkets).to.have.members(expectedMarkets);
  });

  it("Should be able to setTreasury", async () => {
    await expect(data.setTreasury(treasury.address))
      .to.emit(data, "TreasurySet")
      .withArgs(treasury.address);
  });
});
