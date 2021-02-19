import { expect } from "chai";
import { createFixtureLoader } from "ethereum-waffle";
import { BigNumber as BN, Contract } from "ethers";
import {
  advanceTime,
  amountToWei,
  getAContract,
  getCContract,
  consts,
  evm_revert,
  evm_snapshot,
  Token,
  tokens,
} from "../helpers";
import { AMMTest } from "./AmmFormula";
import { pendleMarketFixture } from "./fixtures";

const { waffle } = require("hardhat");
const { deployContract, provider } = waffle;

describe("pendleAMarket", async () => {
  const wallets = provider.getWallets();
  const loadFixture = createFixtureLoader(wallets, provider);
  const [alice, bob] = wallets;
  let pendleRouter: Contract;
  let pendleTreasury: Contract;
  let pendleMarketFactory: Contract;
  let pendleData: Contract;
  let pendleAOwnershipToken: Contract;
  let pendleAXyt: Contract;
  let pendleCOwnershipToken: Contract;
  let pendleCXyt: Contract;
  let lendingPoolCore: Contract;
  let pendleAaveForge: Contract;
  let pendleCompoundForge: Contract;
  let pendleAMarket: Contract;
  let pendleCMarket: Contract;
  let testToken: Contract;
  let aUSDT: Contract;
  let cUSDT: Contract;
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
    pendleAOwnershipToken = fixture.aForge.pendleOwnershipToken;
    pendleAXyt = fixture.aForge.pendleFutureYieldAToken;
    pendleCOwnershipToken = fixture.cForge.pendleOwnershipToken;
    pendleCXyt = fixture.cForge.pendleFutureYieldCToken;
    pendleAaveForge = fixture.aForge.pendleAaveForge;
    pendleCompoundForge = fixture.cForge.pendleCompoundForge;
    lendingPoolCore = fixture.aave.lendingPoolCore;
    testToken = fixture.testToken;
    pendleAMarket = fixture.pendleAMarket;
    pendleCMarket = fixture.pendleCMarket;
    tokenUSDT = tokens.USDT;
    aUSDT = await getAContract(alice, lendingPoolCore, tokenUSDT);
    cUSDT = await getCContract(alice, tokenUSDT);
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
      consts.MARKET_FACTORY,
      pendleAXyt.address,
      testToken.address,
      amountToTokenize,
      amountToTokenize,
      consts.HIGH_GAS_OVERRIDE
    );
  }

  it("should be able to join a bootstrapped market with a single tokenUSDT", async () => {
    const amountToTokenize = amountToWei(tokenUSDT, BN.from(100));

    await bootstrapSampleMarket(amountToTokenize);

    let totalSupply = await pendleAMarket.totalSupply();
    let initalWalletBalance = await pendleAMarket.balanceOf(alice.address);
    await pendleRouter.addMarketLiquidityToken(
      consts.FORGE_AAVE,
      consts.MARKET_FACTORY,
      pendleAXyt.address,
      testToken.address,
      amountToTokenize.div(10),
      totalSupply.div(21),
      consts.HIGH_GAS_OVERRIDE
    );
    let currentWalletBalance = await pendleAMarket.balanceOf(alice.address);
    expect(currentWalletBalance).to.be.gt(initalWalletBalance);
  });

  it("should be able to bootstrap", async () => {
    const amountToTokenize = amountToWei(tokenUSDT, BN.from(100));

    await bootstrapSampleMarket(amountToTokenize);
    let yieldTokenBalance = await pendleAXyt.balanceOf(pendleAMarket.address);
    let testTokenBalance = await testToken.balanceOf(pendleAMarket.address);

    expect(yieldTokenBalance).to.be.equal(amountToTokenize);
    expect(testTokenBalance).to.be.equal(amountToTokenize);
  });

  it("should be able to join a bootstrapped pool", async () => {
    const amountToTokenize = amountToWei(tokenUSDT, BN.from(10));

    await bootstrapSampleMarket(amountToTokenize);

    const totalSupply = await pendleAMarket.totalSupply();

    await pendleRouter
      .connect(bob)
      .addMarketLiquidity(
        consts.FORGE_AAVE,
        consts.MARKET_FACTORY,
        pendleAXyt.address,
        testToken.address,
        amountToTokenize,
        amountToTokenize,
        totalSupply,
        consts.HIGH_GAS_OVERRIDE
      );

    let yieldTokenBalance = await pendleAXyt.balanceOf(pendleAMarket.address);
    let testTokenBalance = await testToken.balanceOf(pendleAMarket.address);
    let totalSupplyBalance = await pendleAMarket.totalSupply();

    expect(yieldTokenBalance).to.be.equal(amountToTokenize.mul(2));
    expect(testTokenBalance).to.be.equal(amountToTokenize.mul(2));
    expect(totalSupplyBalance).to.be.equal(totalSupply.mul(2));
  });

  it("should be able to swap amount out", async () => {
    const amountToTokenize = amountToWei(tokenUSDT, BN.from(100));

    await bootstrapSampleMarket(amountToTokenize);

    let yieldTokenBalanceBefore = await pendleAXyt.balanceOf(
      pendleAMarket.address
    );

    let result = await pendleRouter.getMarketRateExactOut(
      pendleAXyt.address,
      testToken.address,
      amountToWei(tokenUSDT, BN.from(10)),
      32
    );

    await pendleRouter.connect(bob).swapExactOut(
      pendleAXyt.address,
      testToken.address,
      // amountToTokenize.div(10), // 100000000 xyt, 500000000000000000000000000000000000000000000 usdt!?
      amountToWei(tokenUSDT, BN.from(10)),
      amountToWei(tokenUSDT, BN.from(100)),
      32,
      consts.HIGH_GAS_OVERRIDE
    );

    let yieldTokenBalance = await pendleAXyt.balanceOf(pendleAMarket.address);
    let testTokenBalance = await testToken.balanceOf(pendleAMarket.address);

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

    let yieldTokenBalanceBefore = await pendleAXyt.balanceOf(
      pendleAMarket.address
    );

    // let result = await pendleRouter
    //   .getMarketRateExactOut(
    //     pendleAXyt.address,
    //     testToken.address,
    //     amountToWei(tokenUSDT, BN.from(10)),
    //     32
    //   );

    await pendleRouter
      .connect(bob)
      .swapExactIn(
        pendleAXyt.address,
        testToken.address,
        amountToWei(tokenUSDT, BN.from(10)),
        BN.from(0),
        32,
        consts.HIGH_GAS_OVERRIDE
      );

    let yieldTokenBalance = await pendleAXyt.balanceOf(pendleAMarket.address);
    let testTokenBalance = await testToken.balanceOf(pendleAMarket.address);

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

    let spotPrice = await pendleAMarket.spotPrice(
      testToken.address,
      pendleAXyt.address
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
    const totalSupply = await pendleAMarket.totalSupply();

    await pendleRouter.removeMarketLiquidity(
      consts.FORGE_AAVE,
      consts.MARKET_FACTORY,
      pendleAXyt.address,
      testToken.address,
      totalSupply.div(10),
      amountToTokenize.div(10),
      amountToTokenize.div(10),
      consts.HIGH_GAS_OVERRIDE
    );

    let yieldTokenBalance = await pendleAXyt.balanceOf(pendleAMarket.address);
    let testTokenBalance = await testToken.balanceOf(pendleAMarket.address);

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

  //   const initialFutureYieldTokenBalance = await pendleAXyt.balanceOf(
  //     alice.address
  //   );
  //   const totalSupply = await pendleAMarket.totalSupply();

  //   await advanceTime(provider, consts.ONE_MONTH);

  //   await pendleRouter.removeMarketLiquidityXyt(
  //     consts.FORGE_AAVE,
  //     consts.MARKET_FACTORY,
  //     pendleAXyt.address,
  //     testToken.address,
  //     totalSupply.div(4),
  //     amountToTokenize.div(6),
  //     consts.HIGH_GAS_OVERRIDE
  //   );

  //   const currentFutureYieldTokenBalance = await pendleAXyt.balanceOf(
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
    ] = await pendleAMarket.getReserves();
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
      consts.MARKET_FACTORY,
      pendleAXyt.address,
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
      pendleAXyt.address,
      testToken.address,
      amountToWei(tokenUSDT, BN.from(10)),
      32
    );

    expect(result[1].toNumber()).to.be.approximately(11111111, 100);
  });

  it("should be able to getMarketRateExactIn", async () => {
    const amountToTokenize = amountToWei(tokenUSDT, BN.from(100));

    await bootstrapSampleMarket(amountToTokenize);

    let result = await pendleRouter.getMarketRateExactIn(
      testToken.address,
      pendleAXyt.address,
      amountToWei(tokenUSDT, BN.from(10)),
      32
    );

    expect(result[1].toNumber()).to.be.approximately(9090909, 100);
  });

  // it("should be able to removeMarketLiquidityXyt", async () => {
  //   // correct but strange
  //   const amountToTokenize = amountToWei(tokenUSDT, BN.from(100));
  //   await bootstrapSampleMarket(amountToTokenize);

  //   const initialFutureYieldTokenBalance = await pendleAXyt.balanceOf(
  //     alice.address
  //   );
  //   const totalSupply = await pendleAMarket.totalSupply();

  //   await advanceTime(provider, consts.ONE_MONTH);

  //   await pendleRouter.removeMarketLiquidityXyt(
  //     consts.FORGE_AAVE,
  //     consts.MARKET_FACTORY,
  //     pendleAXyt.address,
  //     testToken.address,
  //     totalSupply.div(4),
  //     amountToTokenize.div(6),
  //     consts.HIGH_GAS_OVERRIDE
  //   );

  //   const currentFutureYieldTokenBalance = await pendleAXyt.balanceOf(
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
  //   const totalSupply = await pendleAMarket.totalSupply();

  //   await advanceTime(provider, consts.ONE_MONTH);

  //   await pendleRouter.removeMarketLiquidityToken(
  //     consts.FORGE_AAVE,
  //     consts.MARKET_FACTORY,
  //     pendleAXyt.address,
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
    await testToken.approve(pendleAMarket.address, consts.MAX_ALLOWANCE);

    let initalLpTokenBal = await pendleAMarket.balanceOf(alice.address);
    let initalXytBal = await pendleAXyt.balanceOf(alice.address);
    let initalTestTokenBal = await testToken.balanceOf(alice.address);

    let totalSupply = await pendleAMarket.totalSupply();
    await pendleRouter.addMarketLiquidityToken(
      consts.FORGE_AAVE,
      consts.MARKET_FACTORY,
      pendleAXyt.address,
      testToken.address,
      amountToTokenize.div(10),
      totalSupply.div(21),
      consts.HIGH_GAS_OVERRIDE
    );

    let currentLpTokenBal = await pendleAMarket.balanceOf(alice.address);
    let currentXytBal = await pendleAXyt.balanceOf(alice.address);
    let currentTestTokenBal = await testToken.balanceOf(alice.address);

    expect(currentLpTokenBal).to.be.gt(initalLpTokenBal);
    expect(currentTestTokenBal).to.be.lt(initalTestTokenBal);
    expect(currentXytBal).to.be.equal(initalXytBal);
    // TODO: change gt,lt to approximate @Long
  });

  it("should be able to addMarketLiquidityXyt", async () => {
    const amountToTokenize = amountToWei(tokenUSDT, BN.from(10));

    await bootstrapSampleMarket(amountToTokenize);
    await testToken.approve(pendleAMarket.address, consts.MAX_ALLOWANCE);

    let initalLpTokenBal = await pendleAMarket.balanceOf(alice.address);
    let initalXytBal = await pendleAXyt.balanceOf(alice.address);
    let initalTestTokenBal = await testToken.balanceOf(alice.address);

    let totalSupply = await pendleAMarket.totalSupply();
    await pendleRouter.addMarketLiquidityXyt(
      consts.FORGE_AAVE,
      consts.MARKET_FACTORY,
      pendleAXyt.address,
      testToken.address,
      amountToTokenize.div(10),
      totalSupply.div(21),
      consts.HIGH_GAS_OVERRIDE
    );

    let currentLpTokenBal = await pendleAMarket.balanceOf(alice.address);
    let currentXytBal = await pendleAXyt.balanceOf(alice.address);
    let currentTestTokenBal = await testToken.balanceOf(alice.address);

    expect(currentLpTokenBal).to.be.gt(initalLpTokenBal);
    expect(currentTestTokenBal).to.be.equal(initalTestTokenBal);
    expect(currentXytBal).to.be.lt(initalXytBal);
    // TODO: change gt,lt to approximate @Long
  });

  it("should be able to getMarketTokenAddresses", async () => {
    let { token, xyt } = await pendleRouter.getMarketTokenAddresses(
      pendleAMarket.address
    );
    expect(token).to.be.equal(testToken.address);
    expect(xyt).to.be.equal(pendleAXyt.address);
  });

  it("shouldn't be able to create duplicated markets", async () => {
    await expect(
      pendleRouter.createMarket(
        consts.FORGE_AAVE,
        consts.MARKET_FACTORY,
        pendleAXyt.address,
        testToken.address,
        consts.HIGH_GAS_OVERRIDE
      )
    ).to.be.revertedWith("Pendle: market already exists");
  });

  it("AMM's formula should be correct", async () => {
    await AMMTest(
      pendleRouter,
      pendleAMarket,
      tokenUSDT,
      testToken,
      pendleAXyt,
      bootstrapSampleMarket
    );
  });
});
