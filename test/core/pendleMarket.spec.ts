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
  const [alice, bob] = wallets;
  let pendleRouter: Contract;
  let pendleTreasury: Contract;
  let pendleMarketFactory: Contract;
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
    pendleRouter = fixture.core.pendleRouter;
    pendleTreasury = fixture.core.pendleTreasury;
    pendleMarketFactory = fixture.core.pendleMarketFactory;
    pendleData = fixture.core.pendleData;
    pendleOwnershipToken = fixture.forge.pendleOwnershipToken;
    pendleXyt = fixture.forge.pendleFutureYieldToken;
    pendleAaveForge = fixture.forge.pendleAaveForge;
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
    await pendleRouter.bootstrapMarket(
      consts.FORGE_AAVE,
      consts.MARKET_FACTORY_AAVE,
      pendleXyt.address,
      testToken.address,
      amountToTokenize,
      amountToTokenize,
      consts.HIGH_GAS_OVERRIDE
    );
  }

  it("should be able to join a bootstrapped market with a single tokenUSDT", async () => {
    const amountToTokenize = amountToWei(tokenUSDT, BN.from(100));

    await bootstrapSampleMarket(amountToTokenize);

    let totalSupply = await pendleMarket.totalSupply();
    let initalWalletBalance = await pendleMarket.balanceOf(alice.address);
    await pendleRouter.addMarketLiquidityToken(
      consts.FORGE_AAVE,
      consts.MARKET_FACTORY_AAVE,
      pendleXyt.address,
      testToken.address,
      amountToTokenize.div(10),
      totalSupply.div(21),
      consts.HIGH_GAS_OVERRIDE
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

    const totalSupply = await pendleMarket.totalSupply();

    await pendleRouter
      .connect(bob)
      .addMarketLiquidity(
        consts.FORGE_AAVE,
        consts.MARKET_FACTORY_AAVE,
        pendleXyt.address,
        testToken.address,
        amountToTokenize,
        amountToTokenize,
        totalSupply,
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

    let yieldTokenBalanceBefore = await pendleXyt.balanceOf(
      pendleMarket.address
    );

    let result = await pendleRouter.getMarketRateExactOut(
      pendleXyt.address,
      testToken.address,
      amountToWei(tokenUSDT, BN.from(10)),
      consts.MARKET_FACTORY_AAVE
    );

    await pendleRouter.connect(bob).swapExactOut(
      pendleXyt.address,
      testToken.address,
      // amountToTokenize.div(10), // 100000000 xyt, 500000000000000000000000000000000000000000000 usdt!?
      amountToWei(tokenUSDT, BN.from(10)),
      amountToWei(tokenUSDT, BN.from(100)),
      consts.MAX_ALLOWANCE,
      consts.MARKET_FACTORY_AAVE,
      consts.HIGH_GAS_OVERRIDE
    );

    let yieldTokenBalance = await pendleXyt.balanceOf(pendleMarket.address);
    let testTokenBalance = await testToken.balanceOf(pendleMarket.address);

    expect(yieldTokenBalance.toNumber()).to.be.approximately(
      yieldTokenBalanceBefore.add(BN.from(result[1])).toNumber(),
      20
    );
    expect(testTokenBalance).to.be.equal(
      amountToTokenize.sub(amountToTokenize.div(10))
    );
  });

  it("should be able to swap amount in", async () => {
    const amountToTokenize = amountToWei(tokenUSDT, BN.from(100));

    await bootstrapSampleMarket(amountToTokenize);

    let yieldTokenBalanceBefore = await pendleXyt.balanceOf(
      pendleMarket.address
    );

    // let result = await pendleRouter
    //   .getMarketRateExactOut(
    //     pendleXyt.address,
    //     testToken.address,
    //     amountToWei(tokenUSDT, BN.from(10)),
    //     consts.MARKET_FACTORY_AAVE
    //   );

    await pendleRouter
      .connect(bob)
      .swapExactIn(
        pendleXyt.address,
        testToken.address,
        amountToWei(tokenUSDT, BN.from(10)),
        BN.from(0),
        consts.MAX_ALLOWANCE,
        consts.MARKET_FACTORY_AAVE,
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
    const totalSupply = await pendleMarket.totalSupply();

    await pendleRouter.removeMarketLiquidity(
      consts.FORGE_AAVE,
      consts.MARKET_FACTORY_AAVE,
      pendleXyt.address,
      testToken.address,
      totalSupply.div(10),
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

  // it("should be able to exit a pool with a single xyt token", async () => {
  //   const amountToTokenize = amountToWei(tokenUSDT, BN.from(100));
  //   await bootstrapSampleMarket(amountToTokenize);

  //   const initialFutureYieldTokenBalance = await pendleXyt.balanceOf(
  //     alice.address
  //   );
  //   const totalSupply = await pendleMarket.totalSupply();

  //   await advanceTime(provider, consts.ONE_MONTH);

  //   await pendleRouter.removeMarketLiquidityXyt(
  //     consts.FORGE_AAVE,
  //     consts.MARKET_FACTORY_AAVE,
  //     pendleXyt.address,
  //     testToken.address,
  //     totalSupply.div(4),
  //     amountToTokenize.div(6),
  //     consts.HIGH_GAS_OVERRIDE
  //   );

  //   const currentFutureYieldTokenBalance = await pendleXyt.balanceOf(
  //     alice.address
  //   );
  //   const expectedDifference = 43750000;

  //   expect(
  //     currentFutureYieldTokenBalance.sub(initialFutureYieldTokenBalance)
  //   ).to.be.equal(expectedDifference);
  // });

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
    ] = await pendleRouter.getMarketReserves(
      consts.FORGE_AAVE,
      consts.MARKET_FACTORY_AAVE,
      pendleXyt.address,
      testToken.address
    );
    expect(xytReserve).to.be.equal(amountToTokenize);
    expect(tokenReserve).to.be.equal(amountToTokenize);
    // TODO: add expect for currentTIme @Long
  });

  it("should be able to getMarketRateExactOut", async () => {
    const amountToTokenize = amountToWei(tokenUSDT, BN.from(100));

    await bootstrapSampleMarket(amountToTokenize);

    let result = await pendleRouter.getMarketRateExactOut(
      pendleXyt.address,
      testToken.address,
      amountToWei(tokenUSDT, BN.from(10)),
      consts.MARKET_FACTORY_AAVE
    );

    expect(result[1].toNumber()).to.be.approximately(11111111, 100);
  });

  it("should be able to getMarketRateExactIn", async () => {
    const amountToTokenize = amountToWei(tokenUSDT, BN.from(100));

    await bootstrapSampleMarket(amountToTokenize);

    let result = await pendleRouter.getMarketRateExactIn(
      testToken.address,
      pendleXyt.address,
      amountToWei(tokenUSDT, BN.from(10)),
      consts.MARKET_FACTORY_AAVE
    );

    expect(result[1].toNumber()).to.be.approximately(9090909, 100);
  });

  // it("should be able to removeMarketLiquidityXyt", async () => {
  //   // correct but strange
  //   const amountToTokenize = amountToWei(tokenUSDT, BN.from(100));
  //   await bootstrapSampleMarket(amountToTokenize);

  //   const initialFutureYieldTokenBalance = await pendleXyt.balanceOf(
  //     alice.address
  //   );
  //   const totalSupply = await pendleMarket.totalSupply();

  //   await advanceTime(provider, consts.ONE_MONTH);

  //   await pendleRouter.removeMarketLiquidityXyt(
  //     consts.FORGE_AAVE,
  //     consts.MARKET_FACTORY_AAVE,
  //     pendleXyt.address,
  //     testToken.address,
  //     totalSupply.div(4),
  //     amountToTokenize.div(6),
  //     consts.HIGH_GAS_OVERRIDE
  //   );

  //   const currentFutureYieldTokenBalance = await pendleXyt.balanceOf(
  //     alice.address
  //   );
  //   const expectedDifference = 43750000;

  //   expect(
  //     currentFutureYieldTokenBalance.sub(initialFutureYieldTokenBalance)
  //   ).to.be.equal(expectedDifference);
  // });

  // it("should be able to removeMarketLiquidityToken", async () => {
  //   // maybe correct but wrong name
  //   const amountToTokenize = amountToWei(tokenUSDT, BN.from(100));

  //   await bootstrapSampleMarket(amountToTokenize);

  //   const initialTestTokenBalance = await testToken.balanceOf(alice.address);
  //   const totalSupply = await pendleMarket.totalSupply();

  //   await advanceTime(provider, consts.ONE_MONTH);

  //   await pendleRouter.removeMarketLiquidityToken(
  //     consts.FORGE_AAVE,
  //     consts.MARKET_FACTORY_AAVE,
  //     pendleXyt.address,
  //     testToken.address,
  //     totalSupply.div(4),
  //     amountToTokenize.div(6),
  //     consts.HIGH_GAS_OVERRIDE
  //   );

  //   const currentTestTokenBalance = await testToken.balanceOf(alice.address);
  //   const expectedDifference = 43750000;

  //   expect(currentTestTokenBalance.sub(initialTestTokenBalance)).to.be.equal(
  //     expectedDifference
  //   );
  // });

  it("should be able to addMarketLiquidityToken", async () => {
    const amountToTokenize = amountToWei(tokenUSDT, BN.from(10));

    await bootstrapSampleMarket(amountToTokenize);
    await testToken.approve(pendleMarket.address, consts.MAX_ALLOWANCE);

    let initalLpTokenBal = await pendleMarket.balanceOf(alice.address);
    let initalXytBal = await pendleXyt.balanceOf(alice.address);
    let initalTestTokenBal = await testToken.balanceOf(alice.address);

    let totalSupply = await pendleMarket.totalSupply();
    await pendleRouter.addMarketLiquidityToken(
      consts.FORGE_AAVE,
      consts.MARKET_FACTORY_AAVE,
      pendleXyt.address,
      testToken.address,
      amountToTokenize.div(10),
      totalSupply.div(21),
      consts.HIGH_GAS_OVERRIDE
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
    await pendleRouter.addMarketLiquidityXyt(
      consts.FORGE_AAVE,
      consts.MARKET_FACTORY_AAVE,
      pendleXyt.address,
      testToken.address,
      amountToTokenize.div(10),
      totalSupply.div(21),
      consts.HIGH_GAS_OVERRIDE
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
    let { token, xyt } = await pendleRouter.getMarketTokenAddresses(
      pendleMarket.address
    );
    expect(token).to.be.equal(testToken.address);
    expect(xyt).to.be.equal(pendleXyt.address);
  });

  it("shouldn't be able to create duplicated markets", async () => {
    await expect(
      pendleRouter.createMarket(
        consts.FORGE_AAVE,
        consts.MARKET_FACTORY_AAVE,
        pendleXyt.address,
        testToken.address,
        consts.HIGH_GAS_OVERRIDE
      )
    ).to.be.revertedWith("Pendle: market already exists");
  });

  it("AMM's formula should be correct", async () => {
    await AMMTest(
      pendleRouter,
      pendleMarket,
      tokenUSDT,
      testToken,
      pendleXyt,
      bootstrapSampleMarket
    );
  });
});
