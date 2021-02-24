import { expect } from "chai";
import { createFixtureLoader } from "ethereum-waffle";
import { BigNumber as BN, Contract } from "ethers";
import {
  advanceTime,
  amountToWei,
  consts,
  evm_revert,
  evm_snapshot,
  getCContract,
  Token,
  tokens,
} from "../helpers";
import { AMMTest } from "./AmmFormula";
import { pendleMarketFixture } from "./fixtures";

const { waffle } = require("hardhat");
const { deployContract, provider } = waffle;

describe("PendleCompoundMarket", async () => {
  const wallets = provider.getWallets();
  const loadFixture = createFixtureLoader(wallets, provider);
  const [alice, bob] = wallets;
  let pendleRouter: Contract;
  let pendleTreasury: Contract;
  let pendleMarketFactory: Contract;
  let pendleData: Contract;
  let pendleOwnershipToken: Contract;
  let pendleXyt: Contract;
  let pendleXyt2: Contract;
  let lendingPoolCore: Contract;
  let pendleCompoundForge: Contract;
  let pendleStdMarket: Contract;
  let pendleEthMarket: Contract;
  let testToken: Contract;
  let cUSDT: Contract;
  let snapshotId: string;
  let globalSnapshotId: string;
  let tokenUSDT: Token;

  before(async () => {
    globalSnapshotId = await evm_snapshot();

    const fixture = await loadFixture(pendleMarketFixture);
    pendleRouter = fixture.core.pendleRouter;
    pendleTreasury = fixture.core.pendleTreasury;
    pendleMarketFactory = fixture.core.pendleCMarketFactory;
    pendleData = fixture.core.pendleData;
    pendleOwnershipToken = fixture.cForge.pendleCOwnershipToken;
    pendleXyt = fixture.cForge.pendleCFutureYieldToken;
    pendleCompoundForge = fixture.cForge.pendleCompoundForge;
    testToken = fixture.testToken;
    pendleStdMarket = fixture.pendleCMarket;
    pendleEthMarket = fixture.pendleEthMarket;
    tokenUSDT = tokens.USDT;
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
      consts.MARKET_FACTORY_COMPOUND,
      pendleXyt.address,
      testToken.address,
      amountToTokenize,
      amountToTokenize,
      consts.HIGH_GAS_OVERRIDE
    );
  }

  it("should be able to join a bootstrapped market with a single standard token", async () => {
    const amountToTokenize = amountToWei(tokenUSDT, BN.from(100));

    await bootstrapSampleMarket(amountToTokenize);

    let totalSupply = await pendleStdMarket.totalSupply();
    let initalWalletBalance = await pendleStdMarket.balanceOf(alice.address);
    await pendleRouter.addMarketLiquiditySingle(
      consts.MARKET_FACTORY_COMPOUND,
      pendleXyt.address,
      testToken.address,
      false,
      amountToTokenize.div(10),
      totalSupply.div(21),
      consts.HIGH_GAS_OVERRIDE
    );
    let currentWalletBalance = await pendleStdMarket.balanceOf(alice.address);
    expect(currentWalletBalance).to.be.gt(initalWalletBalance);
  });

  it("should be able to bootstrap", async () => {
    const amountToTokenize = amountToWei(tokenUSDT, BN.from(100));

    await bootstrapSampleMarket(amountToTokenize);
    let yieldTokenBalance = await pendleXyt.balanceOf(pendleStdMarket.address);
    let testTokenBalance = await testToken.balanceOf(pendleStdMarket.address);

    expect(yieldTokenBalance).to.be.equal(amountToTokenize);
    expect(testTokenBalance).to.be.equal(amountToTokenize);
  });

  it("should be able to join a bootstrapped pool by dual tokens", async () => {
    const amountToTokenize = amountToWei(tokenUSDT, BN.from(10));

    await bootstrapSampleMarket(amountToTokenize);

    const totalSupply = await pendleStdMarket.totalSupply();

    await pendleRouter
      .connect(bob)
      .addMarketLiquidityAll(
        consts.MARKET_FACTORY_COMPOUND,
        pendleXyt.address,
        testToken.address,
        amountToTokenize,
        amountToTokenize,
        totalSupply,
        consts.HIGH_GAS_OVERRIDE
      );

    let yieldTokenBalance = await pendleXyt.balanceOf(pendleStdMarket.address);
    let testTokenBalance = await testToken.balanceOf(pendleStdMarket.address);
    let totalSupplyBalance = await pendleStdMarket.totalSupply();

    expect(yieldTokenBalance).to.be.equal(amountToTokenize.mul(2));
    expect(testTokenBalance).to.be.equal(amountToTokenize.mul(2));
    expect(totalSupplyBalance).to.be.equal(totalSupply.mul(2));
  });

  it("should be able to swap amount out", async () => {
    const amountToTokenize = amountToWei(tokenUSDT, BN.from(100));

    await bootstrapSampleMarket(amountToTokenize);

    let yieldTokenBalanceBefore = await pendleXyt.balanceOf(
      pendleStdMarket.address
    );

    let result = await pendleRouter.getMarketRateExactOut(
      pendleXyt.address,
      testToken.address,
      amountToWei(tokenUSDT, BN.from(10)),
      consts.MARKET_FACTORY_COMPOUND
    );

    await pendleRouter.connect(bob).swapExactOut(
      pendleXyt.address,
      testToken.address,
      // amountToTokenize.div(10), // 100000000 xyt, 500000000000000000000000000000000000000000000 usdt!?
      amountToWei(tokenUSDT, BN.from(10)),
      amountToWei(tokenUSDT, BN.from(100)),
      consts.MAX_ALLOWANCE,
      consts.MARKET_FACTORY_COMPOUND,
      consts.HIGH_GAS_OVERRIDE
    );

    let yieldTokenBalance = await pendleXyt.balanceOf(pendleStdMarket.address);
    let testTokenBalance = await testToken.balanceOf(pendleStdMarket.address);

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
      pendleStdMarket.address
    );

    // let result = await pendleRouter
    //   .getMarketRateExactOut(
    //     pendleXyt.address,
    //     testToken.address,
    //     amountToWei(tokenUSDT, BN.from(10)),
    //     consts.MARKET_FACTORY_COMPOUND
    //   );

    await pendleRouter
      .connect(bob)
      .swapExactIn(
        pendleXyt.address,
        testToken.address,
        amountToWei(tokenUSDT, BN.from(10)),
        BN.from(0),
        consts.MAX_ALLOWANCE,
        consts.MARKET_FACTORY_COMPOUND,
        consts.HIGH_GAS_OVERRIDE
      );

    let yieldTokenBalance = await pendleXyt.balanceOf(pendleStdMarket.address);
    let testTokenBalance = await testToken.balanceOf(pendleStdMarket.address);

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

    let spotPrice = await pendleStdMarket.spotPrice(
      testToken.address,
      pendleXyt.address
    );

    expect(spotPrice.toNumber()).to.be.approximately(
      1000000000000,
      100000000000
    );
  });

  it("should be able to exit a pool by dual tokens", async () => {
    const amountToTokenize = amountToWei(tokenUSDT, BN.from(100));
    await bootstrapSampleMarket(amountToTokenize);
    await advanceTime(provider, consts.ONE_MONTH);
    const totalSupply = await pendleStdMarket.totalSupply();

    await pendleRouter.removeMarketLiquidityAll(
      consts.MARKET_FACTORY_COMPOUND,
      pendleXyt.address,
      testToken.address,
      totalSupply.div(10),
      BN.from(0),
      BN.from(0),
      consts.HIGH_GAS_OVERRIDE
    );

    let yieldTokenBalance = await pendleXyt.balanceOf(pendleStdMarket.address);
    let testTokenBalance = await testToken.balanceOf(pendleStdMarket.address);

    expect(yieldTokenBalance).to.be.equal(
      amountToTokenize.sub(amountToTokenize.div(10))
    );
    expect(testTokenBalance).to.be.equal(
      amountToTokenize.sub(amountToTokenize.div(10))
    );
  });

  // it.only("shouldn't be able to add liquidity by dual tokens after xyt has expired", async () => {
  //   const amountToTokenize = amountToWei(tokenUSDT, BN.from(10));

  //   await bootstrapSampleMarket(amountToTokenize);

  //   const totalSupply = await pendleStdMarket.totalSupply();

  //   advanceTime(provider, consts.ONE_YEAR);
  //   await expect(pendleRouter
  //     .connect(bob)
  //     .addMarketLiquidityAll(
  //       consts.MARKET_FACTORY_COMPOUND,
  //       pendleXyt.address,
  //       testToken.address,
  //       amountToTokenize,
  //       amountToTokenize,
  //       totalSupply,
  //       consts.HIGH_GAS_OVERRIDE
  //     )).to.be.reverted;
  // });

  // it.only("shouldn't be able to add liquidity by xyt after xyt has expired", async () => {
  //   const amountToTokenize = amountToWei(tokenUSDT, BN.from(10));

  //   await bootstrapSampleMarket(amountToTokenize);
  //   await testToken.approve(pendleStdMarket.address, consts.MAX_ALLOWANCE);

  //   let initalLpTokenBal = await pendleStdMarket.balanceOf(alice.address);
  //   let initalXytBal = await pendleXyt.balanceOf(alice.address);
  //   let initalTestTokenBal = await testToken.balanceOf(alice.address);

  //   let totalSupply = await pendleStdMarket.totalSupply();
  //   await advanceTime(provider, consts.ONE_YEAR);
  //   await pendleRouter.addMarketLiquiditySingle( // will fail but by an unintended error
  //     consts.MARKET_FACTORY_COMPOUND,
  //     pendleXyt.address,
  //     testToken.address,
  //     false,
  //     amountToTokenize.div(10),
  //     totalSupply.div(21),
  //     consts.HIGH_GAS_OVERRIDE
  //   );

  //   let currentLpTokenBal = await pendleStdMarket.balanceOf(alice.address);
  //   let currentXytBal = await pendleXyt.balanceOf(alice.address);
  //   let currentTestTokenBal = await testToken.balanceOf(alice.address);

  //   expect(currentLpTokenBal).to.be.gt(initalLpTokenBal);
  //   expect(currentTestTokenBal).to.be.lt(initalTestTokenBal);
  //   expect(currentXytBal).to.be.equal(initalXytBal);
  //   // TODO: change gt,lt to approximate @Long
  // });

  // it.only("should be able to exit market by baseToken after the market has expired", async () => {
  //   const amountToTokenize = amountToWei(tokenUSDT, BN.from(100));
  //   await bootstrapSampleMarket(amountToTokenize);

  //   const totalSupply = await pendleStdMarket.totalSupply();

  //   await advanceTime(provider, consts.ONE_YEAR);

  //   await pendleRouter.removeMarketLiquiditySingle(
  //     consts.MARKET_FACTORY_COMPOUND,
  //     pendleXyt.address,
  //     testToken.address,
  //     false,
  //     totalSupply.div(4),
  //     amountToTokenize.div(6),
  //     consts.HIGH_GAS_OVERRIDE
  //   );
  // });

  // it.only("should be able to exit a pool by dual tokens after xyt has expired", async () => {
  //   const amountToTokenize = amountToWei(tokenUSDT, BN.from(100));
  //   await bootstrapSampleMarket(amountToTokenize);
  //   await advanceTime(provider, consts.ONE_YEAR);
  //   const totalSupply = await pendleStdMarket.totalSupply();

  //   await pendleRouter.removeMarketLiquidityAll(
  //     consts.MARKET_FACTORY_COMPOUND,
  //     pendleXyt.address,
  //     testToken.address,
  //     totalSupply.div(10),
  //     amountToTokenize.div(10),
  //     amountToTokenize.div(10),
  //     consts.HIGH_GAS_OVERRIDE
  //   );

  //   let yieldTokenBalance = await pendleXyt.balanceOf(pendleStdMarket.address);
  //   let testTokenBalance = await testToken.balanceOf(pendleStdMarket.address);

  //   expect(yieldTokenBalance).to.be.equal(
  //     amountToTokenize.sub(amountToTokenize.div(10))
  //   );
  //   expect(testTokenBalance).to.be.equal(
  //     amountToTokenize.sub(amountToTokenize.div(10))
  //   );
  // });

  it("should be able to getReserves", async () => {
    const amountToTokenize = amountToWei(tokenUSDT, BN.from(100));

    await bootstrapSampleMarket(amountToTokenize);

    let [
      xytReserve,
      tokenReserve,
      blockTimestamp,
    ] = await pendleStdMarket.getReserves();
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
      consts.MARKET_FACTORY_COMPOUND,
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
      consts.MARKET_FACTORY_COMPOUND
    );

    expect(result[1].toNumber()).to.be.approximately(11111280, 100);
  });

  it("should be able to getMarketRateExactIn", async () => {
    const amountToTokenize = amountToWei(tokenUSDT, BN.from(100));

    await bootstrapSampleMarket(amountToTokenize);

    let result = await pendleRouter.getMarketRateExactIn(
      testToken.address,
      pendleXyt.address,
      amountToWei(tokenUSDT, BN.from(10)),
      consts.MARKET_FACTORY_COMPOUND
    );

    expect(result[1].toNumber()).to.be.approximately(9091034, 100);
  });

  it("should be able to add market liquidity for a token", async () => {
    const amountToTokenize = amountToWei(tokenUSDT, BN.from(10));

    await bootstrapSampleMarket(amountToTokenize);
    await testToken.approve(pendleStdMarket.address, consts.MAX_ALLOWANCE);

    let initalLpTokenBal = await pendleStdMarket.balanceOf(alice.address);
    let initalXytBal = await pendleXyt.balanceOf(alice.address);
    let initalTestTokenBal = await testToken.balanceOf(alice.address);

    let totalSupply = await pendleStdMarket.totalSupply();
    await pendleRouter.addMarketLiquiditySingle(
      consts.MARKET_FACTORY_COMPOUND,
      pendleXyt.address,
      testToken.address,
      false,
      amountToTokenize.div(10),
      totalSupply.div(21),
      consts.HIGH_GAS_OVERRIDE
    );

    let currentLpTokenBal = await pendleStdMarket.balanceOf(alice.address);
    let currentXytBal = await pendleXyt.balanceOf(alice.address);
    let currentTestTokenBal = await testToken.balanceOf(alice.address);

    expect(currentLpTokenBal).to.be.gt(initalLpTokenBal);
    expect(currentTestTokenBal).to.be.lt(initalTestTokenBal);
    expect(currentXytBal).to.be.equal(initalXytBal);
    // TODO: change gt,lt to approximate @Long
  });

  it("should be able to add XYT market liquidity", async () => {
    const amountToTokenize = amountToWei(tokenUSDT, BN.from(10));

    await bootstrapSampleMarket(amountToTokenize);
    await testToken.approve(pendleStdMarket.address, consts.MAX_ALLOWANCE);

    let initalLpTokenBal = await pendleStdMarket.balanceOf(alice.address);
    let initalXytBal = await pendleXyt.balanceOf(alice.address);
    let initalTestTokenBal = await testToken.balanceOf(alice.address);

    let totalSupply = await pendleStdMarket.totalSupply();
    await pendleRouter.addMarketLiquiditySingle(
      consts.MARKET_FACTORY_COMPOUND,
      pendleXyt.address,
      testToken.address,
      true,
      amountToTokenize.div(10),
      totalSupply.div(21),
      consts.HIGH_GAS_OVERRIDE
    );

    let currentLpTokenBal = await pendleStdMarket.balanceOf(alice.address);
    let currentXytBal = await pendleXyt.balanceOf(alice.address);
    let currentTestTokenBal = await testToken.balanceOf(alice.address);

    expect(currentLpTokenBal).to.be.gt(initalLpTokenBal);
    expect(currentTestTokenBal).to.be.equal(initalTestTokenBal);
    expect(currentXytBal).to.be.lt(initalXytBal);
    // TODO: change gt,lt to approximate @Long
  });

  it("should be able to getMarketTokenAddresses", async () => {
    let { token, xyt } = await pendleRouter.getMarketTokenAddresses(
      pendleStdMarket.address
    );
    expect(token).to.be.equal(testToken.address);
    expect(xyt).to.be.equal(pendleXyt.address);
  });

  it("shouldn't be able to create duplicated markets", async () => {
    await expect(
      pendleRouter.createMarket(
        consts.MARKET_FACTORY_COMPOUND,
        pendleXyt.address,
        testToken.address,
        consts.HIGH_GAS_OVERRIDE
      )
    ).to.be.revertedWith("EXISTED_MARKET");
  });
});
