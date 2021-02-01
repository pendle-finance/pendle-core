import { expect } from "chai";
import { createFixtureLoader } from "ethereum-waffle";
import { BigNumber as BN, Contract } from "ethers";
import {
  advanceTime,
  amountToWei,
  consts,
  evm_revert,
  evm_snapshot,
  getAContract,
  Token,
  tokens,
} from "../helpers";
import { AMMTest } from "./AmmFormula";
import { pendleMarketFixture } from "./fixtures";
const { waffle } = require("hardhat");
const { deployContract, provider } = waffle;

describe("PendleMarket", async () => {
  const wallets = provider.getWallets();
  const loadFixture = createFixtureLoader(wallets, provider);
  const [alice, wallet1] = wallets;
  let pendle: Contract;
  let pendleAaveMarketFactory: Contract;
  let pendleXyt: Contract;
  let lendingPoolCore: Contract;
  let pendleMarket: Contract;
  let testToken: Contract;
  let aUSDT: Contract;
  let snapshotId: string;
  let globalSnapshotId: string;
  let tokenUSDT: Token;
  before(async () => {
    globalSnapshotId = await evm_snapshot();

    const fixture = await loadFixture(pendleMarketFixture);
    pendle = fixture.core.pendle;
    pendleAaveMarketFactory = fixture.core.pendleAaveMarketFactory;
    pendleXyt = fixture.forge.pendleFutureYieldToken;
    lendingPoolCore = fixture.aave.lendingPoolCore;
    testToken = fixture.testToken;
    pendleMarket = fixture.pendleMarket;
    tokenUSDT = tokens.USDT;
    aUSDT = await getAContract(alice, lendingPoolCore, tokenUSDT);
    snapshotId = await evm_snapshot();
  });

  after(async () => {
    await evm_revert(globalSnapshotId);
  });

  beforeEach(async () => {
    await evm_revert(snapshotId);
    snapshotId = await evm_snapshot();
  });

  async function bootstrapSampleMarket(amountToTokenize: BN) {
    await pendle.bootStrapMarket(
      // TODO: Rename to bootstrap when merge with Anton's new code
      consts.FORGE_AAVE,
      consts.MARKET_FACTORY_AAVE,
      pendleXyt.address,
      testToken.address,
      amountToTokenize,
      amountToTokenize,
      consts.HIGH_GAS_OVERRIDE
    );
  }

  it("should be able to join a bootstrapped pool with a single tokenUSDT", async () => {
    const amountToTokenize = amountToWei(tokenUSDT, BN.from(10));

    await bootstrapSampleMarket(amountToTokenize);

    await testToken.approve(pendleMarket.address, consts.MAX_ALLOWANCE);
    let totalSupply = await pendleMarket.totalSupply();
    let initalWalletBalance = await pendleMarket.balanceOf(alice.address);
    await pendleMarket.joinPoolSingleToken(
      alice.address,
      testToken.address,
      amountToTokenize.div(10),
      totalSupply.div(21)
    );
    let currentWalletBalance = await pendleMarket.balanceOf(alice.address);
    expect(currentWalletBalance).to.be.gt(initalWalletBalance);
  });

  it("should be able to bootstrap", async () => {
    const amountToTokenize = amountToWei(tokenUSDT, BN.from(100));

    await bootstrapSampleMarket(amountToTokenize);
    let yieldTokenBalance = await pendleXyt.balanceOf(pendleMarket.address);
    let testTokenBalance = await testToken.balanceOf(pendleMarket.address);

    expect(yieldTokenBalance).to.be.equal(amountToTokenize);
    expect(testTokenBalance).to.be.equal(amountToTokenize);
  });

  it("should be able to join a bootstrapped pool", async () => {
    const amountToTokenize = amountToWei(tokenUSDT, BN.from(10));

    await bootstrapSampleMarket(amountToTokenize);

    await testToken.approve(pendleMarket.address, consts.MAX_ALLOWANCE);

    const totalSupply = await pendleMarket.totalSupply();

    await pendle
      .connect(wallet1)
      .addMarketLiquidity(
        consts.FORGE_AAVE,
        consts.MARKET_FACTORY_AAVE,
        pendleXyt.address,
        testToken.address,
        totalSupply,
        amountToTokenize,
        amountToTokenize,
        consts.HIGH_GAS_OVERRIDE
      );

    let yieldTokenBalance = await pendleXyt.balanceOf(pendleMarket.address);
    let testTokenBalance = await testToken.balanceOf(pendleMarket.address);
    let totalSupplyBalance = await pendleMarket.totalSupply();

    expect(yieldTokenBalance).to.be.equal(amountToTokenize.mul(2));
    expect(testTokenBalance).to.be.equal(amountToTokenize.mul(2));
    expect(totalSupplyBalance).to.be.equal(totalSupply.mul(2));
  });

  it("should be able to swap amount out", async () => {
    const amountToTokenize = amountToWei(tokenUSDT, BN.from(100));

    await bootstrapSampleMarket(amountToTokenize);

    await pendle
      .connect(wallet1)
      .swapXytFromToken(
        consts.FORGE_AAVE,
        consts.MARKET_FACTORY_AAVE,
        pendleXyt.address,
        testToken.address,
        amountToTokenize.div(10),
        consts.MAX_ALLOWANCE,
        consts.MAX_ALLOWANCE,
        consts.HIGH_GAS_OVERRIDE
      );

    let yieldTokenBalance = await pendleXyt.balanceOf(pendleMarket.address);
    let testTokenBalance = await testToken.balanceOf(pendleMarket.address);

    expect(yieldTokenBalance).to.be.equal(
      amountToTokenize.sub(amountToTokenize.div(10))
    );
    expect(testTokenBalance.toNumber()).to.be.approximately(111111080, 30);
  });

  it("should be able to swap amount in", async () => {
    const amountToTokenize = amountToWei(tokenUSDT, BN.from(100));

    await bootstrapSampleMarket(amountToTokenize);

    await pendle
      .connect(wallet1)
      .swapXytToToken(
        consts.FORGE_AAVE,
        consts.MARKET_FACTORY_AAVE,
        pendleXyt.address,
        testToken.address,
        amountToTokenize.div(10),
        BN.from(0),
        consts.MAX_ALLOWANCE,
        consts.HIGH_GAS_OVERRIDE
      );

    let yieldTokenBalance = await pendleXyt.balanceOf(pendleMarket.address);
    let testTokenBalance = await testToken.balanceOf(pendleMarket.address);

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
    const amountToTokenize = amountToWei(tokenUSDT, BN.from(100));

    await bootstrapSampleMarket(amountToTokenize);

    let spotPrice = await pendleMarket.spotPrice(
      testToken.address,
      pendleXyt.address
    );

    expect(spotPrice.toNumber()).to.be.approximately(
      1000000000000,
      100000000000
    );
  });

  it("should be able to exit a pool", async () => {
    const amountToTokenize = amountToWei(tokenUSDT, BN.from(100));
    await bootstrapSampleMarket(amountToTokenize);
    await advanceTime(provider, consts.ONE_MONTH);
    const totalSuply = await pendleMarket.totalSupply();

    await pendle.removeMarketLiquidity(
      consts.FORGE_AAVE,
      consts.MARKET_FACTORY_AAVE,
      pendleXyt.address,
      testToken.address,
      totalSuply.div(10),
      amountToTokenize.div(10),
      amountToTokenize.div(10),
      consts.HIGH_GAS_OVERRIDE
    );

    let yieldTokenBalance = await pendleXyt.balanceOf(pendleMarket.address);
    let testTokenBalance = await testToken.balanceOf(pendleMarket.address);

    expect(yieldTokenBalance).to.be.equal(
      amountToTokenize.sub(amountToTokenize.div(10))
    );
    expect(testTokenBalance).to.be.equal(
      amountToTokenize.sub(amountToTokenize.div(10))
    );
  });

  it("should be able to exit a pool with a single xyt token", async () => {
    const amountToTokenize = amountToWei(tokenUSDT, BN.from(100));
    await pendleMarket.bootstrap(
      alice.address,
      amountToTokenize,
      amountToTokenize,
      consts.HIGH_GAS_OVERRIDE
    );

    const initialFutureYieldTokenBalance = await pendleXyt.balanceOf(
      alice.address
    );
    const totalSupply = await pendleMarket.totalSupply();

    await advanceTime(provider, consts.ONE_MONTH);

    await pendleMarket.exitPoolSingleToken(
      alice.address,
      pendleXyt.address,
      totalSupply.div(4),
      amountToTokenize.div(6),
      consts.HIGH_GAS_OVERRIDE
    );

    const currentFutureYieldTokenBalance = await pendleXyt.balanceOf(
      alice.address
    );
    const expectedDifference = 43750000;

    expect(
      currentFutureYieldTokenBalance.sub(initialFutureYieldTokenBalance)
    ).to.be.equal(expectedDifference);
  });

  it("should be able to getReserves", async () => {
    const amountToTokenize = amountToWei(tokenUSDT, BN.from(100));

    await bootstrapSampleMarket(amountToTokenize);

    let [
      xytReserve,
      tokenReserve,
      blockTimestamp,
    ] = await pendleMarket.getReserves();
    expect(xytReserve).to.be.equal(amountToTokenize);
    expect(tokenReserve).to.be.equal(amountToTokenize);
    // TODO: add expect for blockTimestamp @Long
  });

  it("should be able to getMarketReserve", async () => {
    const amountToTokenize = amountToWei(tokenUSDT, BN.from(100));

    await bootstrapSampleMarket(amountToTokenize);

    let [
      xytReserve,
      tokenReserve,
      currentTime,
    ] = await pendle.getMarketReserves(
      consts.FORGE_AAVE,
      consts.MARKET_FACTORY_AAVE,
      pendleXyt.address,
      testToken.address
    );
    expect(xytReserve).to.be.equal(amountToTokenize);
    expect(tokenReserve).to.be.equal(amountToTokenize);
    // TODO: add expect for currentTIme @Long
  });

  it("should be able to getMarketRateToken", async () => {
    const amountToTokenize = amountToWei(tokenUSDT, BN.from(100));

    await bootstrapSampleMarket(amountToTokenize);

    let marketRate = await pendle.getMarketRateToken(
      consts.FORGE_AAVE,
      consts.MARKET_FACTORY_AAVE,
      pendleXyt.address,
      testToken.address
    );
    expect(marketRate.toNumber()).to.be.approximately(
      1000000000000,
      100000000000
    );
  });

  it("should be able to getMarketRateXyt", async () => {
    const amountToTokenize = amountToWei(tokenUSDT, BN.from(100));

    await bootstrapSampleMarket(amountToTokenize);

    let marketRate = await pendle.getMarketRateXyt(
      consts.FORGE_AAVE,
      consts.MARKET_FACTORY_AAVE,
      pendleXyt.address,
      testToken.address
    );
    expect(marketRate.toNumber()).to.be.approximately(
      1000000000000,
      100000000000
    );
  });

  it("should be able to removeMarketLiquidityXyt", async () => {
    // correct but strange
    const amountToTokenize = amountToWei(tokenUSDT, BN.from(100));
    await bootstrapSampleMarket(amountToTokenize);

    const initialFutureYieldTokenBalance = await pendleXyt.balanceOf(
      alice.address
    );
    const totalSupply = await pendleMarket.totalSupply();

    await advanceTime(provider, consts.ONE_MONTH);

    await pendle.removeMarketLiquidityXyt(
      consts.FORGE_AAVE,
      consts.MARKET_FACTORY_AAVE,
      pendleXyt.address,
      testToken.address,
      totalSupply.div(4),
      amountToTokenize.div(6),
      consts.HIGH_GAS_OVERRIDE
    );

    const currentFutureYieldTokenBalance = await pendleXyt.balanceOf(
      alice.address
    );
    const expectedDifference = 43750000;

    expect(
      currentFutureYieldTokenBalance.sub(initialFutureYieldTokenBalance)
    ).to.be.equal(expectedDifference);
  });

  it("should be able to removeMarketLiquidityToken", async () => {
    // maybe correct but wrong name
    const amountToTokenize = amountToWei(tokenUSDT, BN.from(100));

    await bootstrapSampleMarket(amountToTokenize);

    const initialTestTokenBalance = await testToken.balanceOf(alice.address);
    const totalSupply = await pendleMarket.totalSupply();

    await advanceTime(provider, consts.ONE_MONTH);

    await pendle.removeMarketLiquidityToken(
      consts.FORGE_AAVE,
      consts.MARKET_FACTORY_AAVE,
      pendleXyt.address,
      testToken.address,
      totalSupply.div(4),
      amountToTokenize.div(6),
      consts.HIGH_GAS_OVERRIDE
    );

    const currentTestTokenBalance = await testToken.balanceOf(alice.address);
    const expectedDifference = 43750000;

    expect(currentTestTokenBalance.sub(initialTestTokenBalance)).to.be.equal(
      expectedDifference
    );
  });

  it("should be able to addMarketLiquidityToken", async () => {
    const amountToTokenize = amountToWei(tokenUSDT, BN.from(10));

    await bootstrapSampleMarket(amountToTokenize);
    await testToken.approve(pendleMarket.address, consts.MAX_ALLOWANCE);

    let initalLpTokenBal = await pendleMarket.balanceOf(alice.address);
    let initalXytBal = await pendleXyt.balanceOf(alice.address);
    let initalTestTokenBal = await testToken.balanceOf(alice.address);

    let totalSupply = await pendleMarket.totalSupply();
    await pendle.addMarketLiquidityToken(
      consts.FORGE_AAVE,
      consts.MARKET_FACTORY_AAVE,
      pendleXyt.address,
      testToken.address,
      amountToTokenize.div(10),
      totalSupply.div(21)
    );

    let currentLpTokenBal = await pendleMarket.balanceOf(alice.address);
    let currentXytBal = await pendleXyt.balanceOf(alice.address);
    let currentTestTokenBal = await testToken.balanceOf(alice.address);

    expect(currentLpTokenBal).to.be.gt(initalLpTokenBal);
    expect(currentTestTokenBal).to.be.lt(initalTestTokenBal);
    expect(currentXytBal).to.be.equal(initalXytBal);
    // TODO: change gt,lt to approximate @Long
  });

  it("should be able to addMarketLiquidityXyt", async () => {
    const amountToTokenize = amountToWei(tokenUSDT, BN.from(10));

    await bootstrapSampleMarket(amountToTokenize);
    await testToken.approve(pendleMarket.address, consts.MAX_ALLOWANCE);

    let initalLpTokenBal = await pendleMarket.balanceOf(alice.address);
    let initalXytBal = await pendleXyt.balanceOf(alice.address);
    let initalTestTokenBal = await testToken.balanceOf(alice.address);

    let totalSupply = await pendleMarket.totalSupply();
    await pendle.addMarketLiquidityXyt(
      consts.FORGE_AAVE,
      consts.MARKET_FACTORY_AAVE,
      pendleXyt.address,
      testToken.address,
      amountToTokenize.div(10),
      totalSupply.div(21)
    );

    let currentLpTokenBal = await pendleMarket.balanceOf(alice.address);
    let currentXytBal = await pendleXyt.balanceOf(alice.address);
    let currentTestTokenBal = await testToken.balanceOf(alice.address);

    expect(currentLpTokenBal).to.be.gt(initalLpTokenBal);
    expect(currentTestTokenBal).to.be.equal(initalTestTokenBal);
    expect(currentXytBal).to.be.lt(initalXytBal);
    // TODO: change gt,lt to approximate @Long
  });

  it("should be able to getMarketTokenAddresses", async () => {
    let { token, xyt } = await pendle.getMarketTokenAddresses(
      pendleMarket.address
    );
    expect(token).to.be.equal(testToken.address);
    expect(xyt).to.be.equal(pendleXyt.address);
  });

  it("should be able to getAllMarkets", async () => {
    let filter = pendleAaveMarketFactory.filters.MarketCreated();
    let tx = await pendle.createMarket(
      consts.FORGE_AAVE,
      consts.MARKET_FACTORY_AAVE,
      pendleXyt.address,
      tokenUSDT.address,
      consts.T0.add(consts.THREE_MONTH),
      consts.HIGH_GAS_OVERRIDE
    );
    let allEvents = await pendleAaveMarketFactory.queryFilter(
      filter,
      tx.blockHash
    );
    let expectedMarkets: string[] = [];
    allEvents.forEach((event) => {
      expectedMarkets.push(event.args!.market);
    });
    let allMarkets = await pendle.getAllMarkets();
    expect(allMarkets).to.have.members(expectedMarkets);
  });

  it("shouldn't be able to create duplicated markets", async () => {
    await expect(
      pendleAaveMarketFactory.createMarket(
        pendleXyt.address,
        testToken.address,
        consts.T0.add(consts.THREE_MONTH),
        consts.HIGH_GAS_OVERRIDE
      )
    ).to.be.revertedWith("Pendle: market already exists");
  });

  it("AMM's formula should be correct", async () => {
    await AMMTest(
      pendle,
      pendleMarket,
      tokenUSDT,
      testToken,
      pendleXyt,
      bootstrapSampleMarket
    );
  });
});
