import { expect } from "chai";
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
  let pendleFutureYieldToken: Contract;
  let lendingPoolCore: Contract;
  let pendleAaveForge: Contract;
  let pendleMarket: Contract;
  let testToken: Contract;
  let aUSDT: Contract;
  let snapshotId: string;
  let globalSnapshotId: string;

  before(async () => {
    globalSnapshotId = await evm_snapshot();

    const fixture = await loadFixture(pendleMarketFixture);
    pendle = fixture.core.pendle;
    pendleTreasury = fixture.core.pendleTreasury;
    pendleAaveMarketFactory = fixture.core.pendleAaveMarketFactory;
    pendleData = fixture.core.pendleData;
    pendleOwnershipToken = fixture.forge.pendleOwnershipToken;
    pendleFutureYieldToken = fixture.forge.pendleFutureYieldToken;
    pendleAaveForge = fixture.forge.pendleAaveForge;
    lendingPoolCore = fixture.aave.lendingPoolCore;
    testToken = fixture.testToken;
    pendleMarket = fixture.pendleMarket;
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

    await pendle.bootStrapMarket(
      constants.FORGE_AAVE,
      constants.MARKET_FACTORY_AAVE,
      pendleFutureYieldToken.address,
      testToken.address,
      amountToTokenize,
      amountToTokenize,
      constants.HIGH_GAS_OVERRIDE
    );
    let yieldTokenBalance = await pendleFutureYieldToken.balanceOf(
      pendleMarket.address
    );
    let testTokenBalance = await testToken.balanceOf(pendleMarket.address);
    let totalSupply = await pendleMarket.totalSupply();

    expect(yieldTokenBalance).to.be.equal(amountToTokenize);
    expect(testTokenBalance).to.be.equal(amountToTokenize);
  });

  it("should be able to join a bootstrapped pool", async () => {
    const token = tokens.USDT;
    const amountToTokenize = amountToWei(token, BigNumber.from(10));

    await pendle.bootStrapMarket(
      constants.FORGE_AAVE,
      constants.MARKET_FACTORY_AAVE,
      pendleFutureYieldToken.address,
      testToken.address,
      amountToTokenize,
      amountToTokenize,
      constants.HIGH_GAS_OVERRIDE
    );

    await testToken.approve(pendleMarket.address, constants.MAX_ALLOWANCE);

    const totalSupply = await pendleMarket.totalSupply();

    await pendle
      .connect(wallet1)
      .addMarketLiquidity(
        constants.FORGE_AAVE,
        constants.MARKET_FACTORY_AAVE,
        pendleFutureYieldToken.address,
        testToken.address,
        totalSupply,
        amountToTokenize,
        amountToTokenize,
        constants.HIGH_GAS_OVERRIDE
      );

    let yieldTokenBalance = await pendleFutureYieldToken.balanceOf(
      pendleMarket.address
    );
    let testTokenBalance = await testToken.balanceOf(pendleMarket.address);
    let totalSupplyBalance = await pendleMarket.totalSupply();

    expect(yieldTokenBalance).to.be.equal(amountToTokenize.mul(2));
    expect(testTokenBalance).to.be.equal(amountToTokenize.mul(2));
    expect(totalSupplyBalance).to.be.equal(totalSupply.mul(2));
  });

  it("should be able to swap amount out", async () => {
    const token = tokens.USDT;
    const amountToTokenize = amountToWei(token, BigNumber.from(100));

    await pendle.bootStrapMarket(
      constants.FORGE_AAVE,
      constants.MARKET_FACTORY_AAVE,
      pendleFutureYieldToken.address,
      testToken.address,
      amountToTokenize,
      amountToTokenize,
      constants.HIGH_GAS_OVERRIDE
    );

    await pendle
      .connect(wallet1)
      .swapXytFromToken(
        constants.FORGE_AAVE,
        constants.MARKET_FACTORY_AAVE,
        pendleFutureYieldToken.address,
        testToken.address,
        amountToTokenize.div(10),
        constants.MAX_ALLOWANCE,
        constants.MAX_ALLOWANCE,
        constants.HIGH_GAS_OVERRIDE
      );

    let yieldTokenBalance = await pendleFutureYieldToken.balanceOf(
      pendleMarket.address
    );
    let testTokenBalance = await testToken.balanceOf(pendleMarket.address);

    expect(yieldTokenBalance).to.be.equal(
      amountToTokenize.sub(amountToTokenize.div(10))
    );
    expect(testTokenBalance.toNumber()).to.be.approximately(111111080, 30);
  });

  it("should be able to swap amount in", async () => {
    const token = tokens.USDT;
    const amountToTokenize = amountToWei(token, BigNumber.from(100));

    await pendle.bootStrapMarket(
      constants.FORGE_AAVE,
      constants.MARKET_FACTORY_AAVE,
      pendleFutureYieldToken.address,
      testToken.address,
      amountToTokenize,
      amountToTokenize,
      constants.HIGH_GAS_OVERRIDE
    );

    await pendle
      .connect(wallet1)
      .swapXytToToken(
        constants.FORGE_AAVE,
        constants.MARKET_FACTORY_AAVE,
        pendleFutureYieldToken.address,
        testToken.address,
        amountToTokenize.div(10),
        BigNumber.from(0),
        constants.MAX_ALLOWANCE,
        constants.HIGH_GAS_OVERRIDE
      );

    let yieldTokenBalance = await pendleFutureYieldToken.balanceOf(
      pendleMarket.address
    );
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

  it("should be able to exit a pool", async () => {
    const token = tokens.USDT;
    const amountToTokenize = amountToWei(token, BigNumber.from(100));
    await pendle.bootStrapMarket(
      constants.FORGE_AAVE,
      constants.MARKET_FACTORY_AAVE,
      pendleFutureYieldToken.address,
      testToken.address,
      amountToTokenize,
      amountToTokenize,
      constants.HIGH_GAS_OVERRIDE
    );
    await advanceTime(provider, constants.ONE_MONTH);
    const totalSuply = await pendleMarket.totalSupply();

    await pendle.removeMarketLiquidity(
      constants.FORGE_AAVE,
      constants.MARKET_FACTORY_AAVE,
      pendleFutureYieldToken.address,
      testToken.address,
      totalSuply.div(10),
      amountToTokenize.div(10),
      amountToTokenize.div(10),
      constants.HIGH_GAS_OVERRIDE
    );

    let yieldTokenBalance = await pendleFutureYieldToken.balanceOf(
      pendleMarket.address
    );
    let testTokenBalance = await testToken.balanceOf(pendleMarket.address);

    expect(yieldTokenBalance).to.be.equal(
      amountToTokenize.sub(amountToTokenize.div(10))
    );
    expect(testTokenBalance).to.be.equal(
      amountToTokenize.sub(amountToTokenize.div(10))
    );
  });
});
