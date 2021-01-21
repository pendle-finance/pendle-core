import { assert, expect } from "chai";
import { Contract, BigNumber } from "ethers";
import { createFixtureLoader } from "ethereum-waffle";

import { pendleMarketFixture } from "./fixtures";
import {
  constants,
  tokens,
  amountToWei,
  getAContract,
  evm_snapshot,
  evm_revert,
  advanceTime,
  Token,
} from "../helpers";
const { waffle } = require("hardhat");
const { deployContract, provider } = waffle;

describe("PendleMarket", async () => {
  const wallets = provider.getWallets();
  const loadFixture = createFixtureLoader(wallets, provider);
  const [wallet, wallet1] = wallets;
  let pendle: Contract;
  let pendleTreasury: Contract;
  let pendleAaveMarketFactory: Contract;
  let pendleData: Contract;
  let pendleOwnershipToken: Contract;
  let pendleXyt: Contract;
  let lendingPoolCore: Contract;
  let pendleAaveForge: Contract;
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
    pendleTreasury = fixture.core.pendleTreasury;
    pendleAaveMarketFactory = fixture.core.pendleAaveMarketFactory;
    pendleData = fixture.core.pendleData;
    pendleOwnershipToken = fixture.forge.pendleOwnershipToken;
    pendleXyt = fixture.forge.pendleFutureYieldToken;
    pendleAaveForge = fixture.forge.pendleAaveForge;
    lendingPoolCore = fixture.aave.lendingPoolCore;
    testToken = fixture.testToken;
    pendleMarket = fixture.pendleMarket;
    tokenUSDT = tokens.USDT;
    aUSDT = await getAContract(wallet, lendingPoolCore, tokenUSDT);
    snapshotId = await evm_snapshot();
  });

  after(async () => {
    await evm_revert(globalSnapshotId);
  });

  beforeEach(async () => {
    await evm_revert(snapshotId);
    snapshotId = await evm_snapshot();
  });

  async function bootstrapSampleMarket(
    amountToTokenize: BigNumber,
    lowLevelCall: boolean = false
  ) {
    if (lowLevelCall == true) {
      await pendleMarket.bootstrap(
        wallet.address,
        amountToTokenize,
        amountToTokenize,
        constants.HIGH_GAS_OVERRIDE
      );
    } else {
      await pendle.bootStrapMarket(
        constants.FORGE_AAVE,
        constants.MARKET_FACTORY_AAVE,
        pendleXyt.address,
        testToken.address,
        amountToTokenize,
        amountToTokenize,
        constants.HIGH_GAS_OVERRIDE
      );
    }
  }

  it("should be able to join a bootstrapped pool with a single tokenUSDT", async () => {
    const amountToTokenize = amountToWei(tokenUSDT, BigNumber.from(10));

    await bootstrapSampleMarket(amountToTokenize);

    await testToken.approve(pendleMarket.address, constants.MAX_ALLOWANCE);
    let totalSupply = await pendleMarket.totalSupply();
    let initalWalletBalance = await pendleMarket.balanceOf(wallet.address);
    await pendleMarket.joinPoolSingleToken(
      wallet.address,
      testToken.address,
      amountToTokenize.div(10),
      totalSupply.div(21)
    );
    let currentWalletBalance = await pendleMarket.balanceOf(wallet.address);
    expect(currentWalletBalance).to.be.gt(initalWalletBalance);
  });

  it("should be able to bootstrap", async () => {
    const amountToTokenize = amountToWei(tokenUSDT, BigNumber.from(100));

    await bootstrapSampleMarket(amountToTokenize);
    let yieldTokenBalance = await pendleXyt.balanceOf(pendleMarket.address);
    let testTokenBalance = await testToken.balanceOf(pendleMarket.address);

    expect(yieldTokenBalance).to.be.equal(amountToTokenize);
    expect(testTokenBalance).to.be.equal(amountToTokenize);
  });

  it("should be able to join a bootstrapped pool", async () => {
    const amountToTokenize = amountToWei(tokenUSDT, BigNumber.from(10));

    await bootstrapSampleMarket(amountToTokenize);

    await testToken.approve(pendleMarket.address, constants.MAX_ALLOWANCE);

    const totalSupply = await pendleMarket.totalSupply();

    await pendle
      .connect(wallet1)
      .addMarketLiquidity(
        constants.FORGE_AAVE,
        constants.MARKET_FACTORY_AAVE,
        pendleXyt.address,
        testToken.address,
        totalSupply,
        amountToTokenize,
        amountToTokenize,
        constants.HIGH_GAS_OVERRIDE
      );

    let yieldTokenBalance = await pendleXyt.balanceOf(pendleMarket.address);
    let testTokenBalance = await testToken.balanceOf(pendleMarket.address);
    let totalSupplyBalance = await pendleMarket.totalSupply();

    expect(yieldTokenBalance).to.be.equal(amountToTokenize.mul(2));
    expect(testTokenBalance).to.be.equal(amountToTokenize.mul(2));
    expect(totalSupplyBalance).to.be.equal(totalSupply.mul(2));
  });

  it("should be able to swap amount out", async () => {
    const amountToTokenize = amountToWei(tokenUSDT, BigNumber.from(100));

    await bootstrapSampleMarket(amountToTokenize);

    await pendle
      .connect(wallet1)
      .swapXytFromToken(
        constants.FORGE_AAVE,
        constants.MARKET_FACTORY_AAVE,
        pendleXyt.address,
        testToken.address,
        amountToTokenize.div(10),
        constants.MAX_ALLOWANCE,
        constants.MAX_ALLOWANCE,
        constants.HIGH_GAS_OVERRIDE
      );

    let yieldTokenBalance = await pendleXyt.balanceOf(pendleMarket.address);
    let testTokenBalance = await testToken.balanceOf(pendleMarket.address);

    expect(yieldTokenBalance).to.be.equal(
      amountToTokenize.sub(amountToTokenize.div(10))
    );
    expect(testTokenBalance.toNumber()).to.be.approximately(111111080, 30);
  });

  it("should be able to swap amount in", async () => {
    const amountToTokenize = amountToWei(tokenUSDT, BigNumber.from(100));

    await bootstrapSampleMarket(amountToTokenize);

    await pendle
      .connect(wallet1)
      .swapXytToToken(
        constants.FORGE_AAVE,
        constants.MARKET_FACTORY_AAVE,
        pendleXyt.address,
        testToken.address,
        amountToTokenize.div(10),
        BigNumber.from(0),
        constants.MAX_ALLOWANCE,
        constants.HIGH_GAS_OVERRIDE
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
    const amountToTokenize = amountToWei(tokenUSDT, BigNumber.from(100));

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
    const amountToTokenize = amountToWei(tokenUSDT, BigNumber.from(100));
    await bootstrapSampleMarket(amountToTokenize);
    await advanceTime(provider, constants.ONE_MONTH);
    const totalSuply = await pendleMarket.totalSupply();

    await pendle.removeMarketLiquidity(
      constants.FORGE_AAVE,
      constants.MARKET_FACTORY_AAVE,
      pendleXyt.address,
      testToken.address,
      totalSuply.div(10),
      amountToTokenize.div(10),
      amountToTokenize.div(10),
      constants.HIGH_GAS_OVERRIDE
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
    const amountToTokenize = amountToWei(tokenUSDT, BigNumber.from(100));
    await pendleMarket.bootstrap(
      wallet.address,
      amountToTokenize,
      amountToTokenize,
      constants.HIGH_GAS_OVERRIDE
    );

    const initialFutureYieldTokenBalance = await pendleXyt.balanceOf(
      wallet.address
    );
    const totalSupply = await pendleMarket.totalSupply();

    await advanceTime(provider, constants.ONE_MONTH);

    await pendleMarket.exitPoolSingleToken(
      wallet.address,
      pendleXyt.address,
      totalSupply.div(4),
      amountToTokenize.div(6),
      constants.HIGH_GAS_OVERRIDE
    );

    const currentFutureYieldTokenBalance = await pendleXyt.balanceOf(
      wallet.address
    );
    const expectedDifference = 43750000;

    expect(
      currentFutureYieldTokenBalance.sub(initialFutureYieldTokenBalance)
    ).to.be.equal(expectedDifference);
  });

  it("should be able to getReserves", async () => {
    const amountToTokenize = amountToWei(tokenUSDT, BigNumber.from(100));

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
    const amountToTokenize = amountToWei(tokenUSDT, BigNumber.from(100));

    await bootstrapSampleMarket(amountToTokenize);

    let [
      xytReserve,
      tokenReserve,
      currentTime,
    ] = await pendle.getMarketReserves(
      constants.FORGE_AAVE,
      constants.MARKET_FACTORY_AAVE,
      pendleXyt.address,
      testToken.address
    );
    expect(xytReserve).to.be.equal(amountToTokenize);
    expect(tokenReserve).to.be.equal(amountToTokenize);
    // TODO: add expect for currentTIme @Long
  });

  it("should be able to getMarketRateToken", async () => {
    const amountToTokenize = amountToWei(tokenUSDT, BigNumber.from(100));

    await bootstrapSampleMarket(amountToTokenize);

    let marketRate = await pendle.getMarketRateToken(
      constants.FORGE_AAVE,
      constants.MARKET_FACTORY_AAVE,
      pendleXyt.address,
      testToken.address
    );
    expect(marketRate.toNumber()).to.be.approximately(
      1000000000000,
      100000000000
    );
  });

  it("should be able to getMarketRateXyt", async () => {
    const amountToTokenize = amountToWei(tokenUSDT, BigNumber.from(100));

    await bootstrapSampleMarket(amountToTokenize);

    let marketRate = await pendle.getMarketRateXyt(
      constants.FORGE_AAVE,
      constants.MARKET_FACTORY_AAVE,
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
    const amountToTokenize = amountToWei(tokenUSDT, BigNumber.from(100));
    await bootstrapSampleMarket(amountToTokenize);

    const initialFutureYieldTokenBalance = await pendleXyt.balanceOf(
      wallet.address
    );
    const totalSupply = await pendleMarket.totalSupply();

    await advanceTime(provider, constants.ONE_MONTH);

    await pendle.removeMarketLiquidityXyt(
      constants.FORGE_AAVE,
      constants.MARKET_FACTORY_AAVE,
      pendleXyt.address,
      testToken.address,
      totalSupply.div(4),
      amountToTokenize.div(6),
      constants.HIGH_GAS_OVERRIDE
    );

    const currentFutureYieldTokenBalance = await pendleXyt.balanceOf(
      wallet.address
    );
    const expectedDifference = 43750000;

    expect(
      currentFutureYieldTokenBalance.sub(initialFutureYieldTokenBalance)
    ).to.be.equal(expectedDifference);
  });

  it("should be able to removeMarketLiquidityToken", async () => {
    // maybe correct but wrong name
    const amountToTokenize = amountToWei(tokenUSDT, BigNumber.from(100));

    await bootstrapSampleMarket(amountToTokenize);

    const initialTestTokenBalance = await testToken.balanceOf(wallet.address);
    const totalSupply = await pendleMarket.totalSupply();

    await advanceTime(provider, constants.ONE_MONTH);

    await pendle.removeMarketLiquidityToken(
      constants.FORGE_AAVE,
      constants.MARKET_FACTORY_AAVE,
      pendleXyt.address,
      testToken.address,
      totalSupply.div(4),
      amountToTokenize.div(6),
      constants.HIGH_GAS_OVERRIDE
    );

    const currentTestTokenBalance = await testToken.balanceOf(wallet.address);
    const expectedDifference = 43750000;

    expect(currentTestTokenBalance.sub(initialTestTokenBalance)).to.be.equal(
      expectedDifference
    );
  });

  it("should be able to addMarketLiquidityToken", async () => {
    const amountToTokenize = amountToWei(tokenUSDT, BigNumber.from(10));

    await bootstrapSampleMarket(amountToTokenize);
    await testToken.approve(pendleMarket.address, constants.MAX_ALLOWANCE);

    let initalLpTokenBal = await pendleMarket.balanceOf(wallet.address);
    let initalXytBal = await pendleXyt.balanceOf(wallet.address);
    let initalTestTokenBal = await testToken.balanceOf(wallet.address);

    let totalSupply = await pendleMarket.totalSupply();
    await pendle.addMarketLiquidityToken(
      constants.FORGE_AAVE,
      constants.MARKET_FACTORY_AAVE,
      pendleXyt.address,
      testToken.address,
      amountToTokenize.div(10),
      totalSupply.div(21)
    );

    let currentLpTokenBal = await pendleMarket.balanceOf(wallet.address);
    let currentXytBal = await pendleXyt.balanceOf(wallet.address);
    let currentTestTokenBal = await testToken.balanceOf(wallet.address);

    expect(currentLpTokenBal).to.be.gt(initalLpTokenBal);
    expect(currentTestTokenBal).to.be.lt(initalTestTokenBal);
    expect(currentXytBal).to.be.equal(initalXytBal);
    // TODO: change gt,lt to approximate @Long
  });

  it("should be able to addMarketLiquidityXyt", async () => {
    const amountToTokenize = amountToWei(tokenUSDT, BigNumber.from(10));

    await bootstrapSampleMarket(amountToTokenize);
    await testToken.approve(pendleMarket.address, constants.MAX_ALLOWANCE);

    let initalLpTokenBal = await pendleMarket.balanceOf(wallet.address);
    let initalXytBal = await pendleXyt.balanceOf(wallet.address);
    let initalTestTokenBal = await testToken.balanceOf(wallet.address);

    let totalSupply = await pendleMarket.totalSupply();
    await pendle.addMarketLiquidityXyt(
      constants.FORGE_AAVE,
      constants.MARKET_FACTORY_AAVE,
      pendleXyt.address,
      testToken.address,
      amountToTokenize.div(10),
      totalSupply.div(21)
    );

    let currentLpTokenBal = await pendleMarket.balanceOf(wallet.address);
    let currentXytBal = await pendleXyt.balanceOf(wallet.address);
    let currentTestTokenBal = await testToken.balanceOf(wallet.address);

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
      constants.FORGE_AAVE,
      constants.MARKET_FACTORY_AAVE,
      pendleXyt.address,
      tokenUSDT.address,
      constants.THREE_MONTH_FROM_NOW,
      constants.HIGH_GAS_OVERRIDE
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
        constants.FORGE_AAVE,
        pendleXyt.address,
        testToken.address,
        constants.THREE_MONTH_FROM_NOW,
        constants.HIGH_GAS_OVERRIDE
      )
    ).to.be.revertedWith("Pendle: market already exists");
  });

  // it.only("should be able to getMarketByUnderlyingToken", async () => {
  // place holder only since the original function is not complete
  // });
});
