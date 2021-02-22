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

describe("pendleCompoundMarket", async () => {
  const wallets = provider.getWallets();
  const loadFixture = createFixtureLoader(wallets, provider);
  const [alice, bob] = wallets;
  let pendleRouter: Contract;
  let pendleTreasury: Contract;
  let pendleData: Contract;
  let pendleAXyt2: Contract;
  let pendleCOwnershipToken: Contract;
  let pendleCXyt: Contract;
  let lendingPoolCore: Contract;
  let pendleCompoundForge: Contract;
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
    pendleData = fixture.core.pendleData;
    pendleCOwnershipToken = fixture.cForge.pendleOwnershipToken;
    pendleCXyt = fixture.cForge.pendleFutureYieldCToken;
    pendleCompoundForge = fixture.cForge.pendleCompoundForge;
    testToken = fixture.testToken;
    pendleCMarket = fixture.pendleCMarket;
    tokenUSDT = tokens.USDT;
    // aUSDT = await getAContract(alice, lendingPoolCore, tokenUSDT);
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
    console.log("amountToTokenize", amountToTokenize.toString());
    console.log("pendleCXyt balanceOf");
    console.log(
      "testToken balanceOf",
      await testToken
        .balanceOf(alice.address)
        .then((result: any) => result.toString())
    );
    await pendleRouter.bootstrapMarket(
      consts.MARKET_FACTORY_COMPOUND,
      pendleCXyt.address,
      testToken.address,
      amountToTokenize,
      amountToTokenize,
      consts.HIGH_GAS_OVERRIDE
    );
  }

  it.only("should be able to join a bootstrapped market with a single token USDT", async () => {
    const amountToTokenize = amountToWei(tokenUSDT, BN.from(100));
    console.log("bootstrapping");
    console.log("amountToTokenize", amountToTokenize.toString());

    await bootstrapSampleMarket(amountToTokenize);

    let totalSupply = await pendleCMarket.totalSupply();
    let initalWalletBalance = await pendleCMarket.balanceOf(alice.address);
    console.log("addMarketLiquiditySingle");
    await pendleRouter.addMarketLiquiditySingle(
      consts.MARKET_FACTORY_COMPOUND,
      pendleCXyt.address,
      testToken.address,
      false,
      amountToTokenize.div(10),
      totalSupply.div(21),
      consts.HIGH_GAS_OVERRIDE
    );
    let currentWalletBalance = await pendleCMarket.balanceOf(alice.address);
    console.log("expecting");
    expect(currentWalletBalance).to.be.gt(initalWalletBalance);
  });

  it.only("should be able to bootstrap", async () => {
    const amountToTokenize = amountToWei(tokenUSDT, BN.from(100));

    await bootstrapSampleMarket(amountToTokenize);
    let yieldTokenBalance = await pendleCXyt.balanceOf(pendleCMarket.address);
    let testTokenBalance = await testToken.balanceOf(pendleCMarket.address);

    expect(yieldTokenBalance).to.be.equal(amountToTokenize);
    expect(testTokenBalance).to.be.equal(amountToTokenize);
  });

  it.only("should be able to join a bootstrapped pool", async () => {
    const amountToTokenize = amountToWei(tokenUSDT, BN.from(10));

    await bootstrapSampleMarket(amountToTokenize);

    const totalSupply = await pendleCMarket.totalSupply();

    await pendleRouter
      .connect(bob)
      .addMarketLiquidityAll(
        consts.MARKET_FACTORY_COMPOUND,
        pendleCXyt.address,
        testToken.address,
        amountToTokenize,
        amountToTokenize,
        totalSupply,
        consts.HIGH_GAS_OVERRIDE
      );

    let yieldTokenBalance = await pendleCXyt.balanceOf(pendleCMarket.address);
    let testTokenBalance = await testToken.balanceOf(pendleCMarket.address);
    let totalSupplyBalance = await pendleCMarket.totalSupply();

    expect(yieldTokenBalance).to.be.equal(amountToTokenize.mul(2));
    expect(testTokenBalance).to.be.equal(amountToTokenize.mul(2));
    expect(totalSupplyBalance).to.be.equal(totalSupply.mul(2));
  });

  it.only("should be able to swap amount out", async () => {
    const amountToTokenize = amountToWei(tokenUSDT, BN.from(100));

    await bootstrapSampleMarket(amountToTokenize);

    let yieldTokenBalanceBefore = await pendleCXyt.balanceOf(
      pendleCMarket.address
    );

    let result = await pendleRouter.getMarketRateExactOut(
      pendleCXyt.address,
      testToken.address,
      amountToWei(tokenUSDT, BN.from(10)),
      consts.MARKET_FACTORY_COMPOUND
    );

    await pendleRouter.connect(bob).swapExactOut(
      pendleCXyt.address,
      testToken.address,
      // amountToTokenize.div(10), // 100000000 xyt, 500000000000000000000000000000000000000000000 usdt!?
      amountToWei(tokenUSDT, BN.from(10)),
      amountToWei(tokenUSDT, BN.from(100)),
      consts.MAX_ALLOWANCE,
      consts.MARKET_FACTORY_COMPOUND,
      consts.HIGH_GAS_OVERRIDE
    );

    let yieldTokenBalance = await pendleCXyt.balanceOf(pendleCMarket.address);
    let testTokenBalance = await testToken.balanceOf(pendleCMarket.address);

    expect(yieldTokenBalance.toNumber()).to.be.approximately(
      yieldTokenBalanceBefore.add(BN.from(result[1])).toNumber(),
      20
    );
    expect(testTokenBalance).to.be.equal(
      amountToTokenize.sub(amountToTokenize.div(10))
    );
  });

  it.only("should be able to swap amount in", async () => {
    const amountToTokenize = amountToWei(tokenUSDT, BN.from(100));

    await bootstrapSampleMarket(amountToTokenize);

    let yieldTokenBalanceBefore = await pendleCXyt.balanceOf(
      pendleCMarket.address
    );

    // let result = await pendleRouter
    //   .getMarketRateExactOut(
    //     pendleCXyt.address,
    //     testToken.address,
    //     amountToWei(tokenUSDT, BN.from(10)),
    //     consts.MARKET_FACTORY_COMPOUND
    //   );

    await pendleRouter
      .connect(bob)
      .swapExactIn(
        pendleCXyt.address,
        testToken.address,
        amountToWei(tokenUSDT, BN.from(10)),
        BN.from(0),
        consts.MAX_ALLOWANCE,
        consts.MARKET_FACTORY_COMPOUND,
        consts.HIGH_GAS_OVERRIDE
      );

    let yieldTokenBalance = await pendleCXyt.balanceOf(pendleCMarket.address);
    let testTokenBalance = await testToken.balanceOf(pendleCMarket.address);

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

  it.only("should be able to get spot price", async () => {
    const amountToTokenize = amountToWei(tokenUSDT, BN.from(100));

    await bootstrapSampleMarket(amountToTokenize);

    let spotPrice = await pendleCMarket.spotPrice(
      testToken.address,
      pendleCXyt.address
    );

    expect(spotPrice.toNumber()).to.be.approximately(
      1000000000000,
      100000000000
    );
  });

  it.only("should be able to exit a pool", async () => {
    const amountToTokenize = amountToWei(tokenUSDT, BN.from(100));
    await bootstrapSampleMarket(amountToTokenize);
    await advanceTime(provider, consts.ONE_MONTH);
    const totalSupply = await pendleCMarket.totalSupply();

    await pendleRouter.removeMarketLiquidityAll(
      consts.MARKET_FACTORY_COMPOUND,
      pendleCXyt.address,
      testToken.address,
      totalSupply.div(10),
      amountToTokenize.div(10),
      amountToTokenize.div(10),
      consts.HIGH_GAS_OVERRIDE
    );

    let yieldTokenBalance = await pendleCXyt.balanceOf(pendleCMarket.address);
    let testTokenBalance = await testToken.balanceOf(pendleCMarket.address);

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

  //   const initialFutureYieldTokenBalance = await pendleCXyt.balanceOf(
  //     alice.address
  //   );
  //   const totalSupply = await pendleCMarket.totalSupply();

  //   await advanceTime(provider, consts.ONE_MONTH);

  //   await pendleRouter.removeMarketLiquidityXyt(
  //     consts.FORGE_AAVE,
  //     consts.MARKET_FACTORY_COMPOUND,
  //     pendleCXyt.address,
  //     testToken.address,
  //     totalSupply.div(4),
  //     amountToTokenize.div(6),
  //     consts.HIGH_GAS_OVERRIDE
  //   );

  //   const currentFutureYieldTokenBalance = await pendleCXyt.balanceOf(
  //     alice.address
  //   );
  //   const expectedDifference = 43750000;

  //   expect(
  //     currentFutureYieldTokenBalance.sub(initialFutureYieldTokenBalance)
  //   ).to.be.equal(expectedDifference);
  // });

  it.only("should be able to getReserves", async () => {
    const amountToTokenize = amountToWei(tokenUSDT, BN.from(100));

    await bootstrapSampleMarket(amountToTokenize);

    let [
      xytReserve,
      tokenReserve,
      blockTimestamp,
    ] = await pendleCMarket.getReserves();
    expect(xytReserve).to.be.equal(amountToTokenize);
    expect(tokenReserve).to.be.equal(amountToTokenize);
    // TODO: add expect for blockTimestamp @Long
  });

  it.only("should be able to getMarketReserve", async () => {
    const amountToTokenize = amountToWei(tokenUSDT, BN.from(100));

    await bootstrapSampleMarket(amountToTokenize);

    let [
      xytReserve,
      tokenReserve,
      currentTime,
    ] = await pendleRouter.getMarketReserves(
      consts.MARKET_FACTORY_COMPOUND,
      pendleCXyt.address,
      testToken.address
    );
    expect(xytReserve).to.be.equal(amountToTokenize);
    expect(tokenReserve).to.be.equal(amountToTokenize);
    // TODO: add expect for currentTIme @Long
  });

  it.only("should be able to getMarketRateExactOut", async () => {
    const amountToTokenize = amountToWei(tokenUSDT, BN.from(100));

    await bootstrapSampleMarket(amountToTokenize);

    let result = await pendleRouter.getMarketRateExactOut(
      pendleCXyt.address,
      testToken.address,
      amountToWei(tokenUSDT, BN.from(10)),
      consts.MARKET_FACTORY_COMPOUND
    );

    expect(result[1].toNumber()).to.be.approximately(11111111, 100);
  });

  it.only("should be able to getMarketRateExactIn", async () => {
    const amountToTokenize = amountToWei(tokenUSDT, BN.from(100));

    await bootstrapSampleMarket(amountToTokenize);

    let result = await pendleRouter.getMarketRateExactIn(
      testToken.address,
      pendleCXyt.address,
      amountToWei(tokenUSDT, BN.from(10)),
      consts.MARKET_FACTORY_COMPOUND
    );

    expect(result[1].toNumber()).to.be.approximately(9090909, 100);
  });

  // it("should be able to removeMarketLiquidityXyt", async () => {
  //   // correct but strange
  //   const amountToTokenize = amountToWei(tokenUSDT, BN.from(100));
  //   await bootstrapSampleMarket(amountToTokenize);

  //   const initialFutureYieldTokenBalance = await pendleCXyt.balanceOf(
  //     alice.address
  //   );
  //   const totalSupply = await pendleCMarket.totalSupply();

  //   await advanceTime(provider, consts.ONE_MONTH);

  //   await pendleRouter.removeMarketLiquidityXyt(
  //     consts.FORGE_AAVE,
  //     consts.MARKET_FACTORY_COMPOUND,
  //     pendleCXyt.address,
  //     testToken.address,
  //     totalSupply.div(4),
  //     amountToTokenize.div(6),
  //     consts.HIGH_GAS_OVERRIDE
  //   );

  //   const currentFutureYieldTokenBalance = await pendleCXyt.balanceOf(
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
  //   const totalSupply = await pendleCMarket.totalSupply();

  //   await advanceTime(provider, consts.ONE_MONTH);

  //   await pendleRouter.removeMarketLiquidityToken(
  //     consts.FORGE_AAVE,
  //     consts.MARKET_FACTORY_COMPOUND,
  //     pendleCXyt.address,
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

  it.only("should be able to add market liquidity for a token", async () => {
    const amountToTokenize = amountToWei(tokenUSDT, BN.from(10));

    await bootstrapSampleMarket(amountToTokenize);
    await testToken.approve(pendleCMarket.address, consts.MAX_ALLOWANCE);

    let initalLpTokenBal = await pendleCMarket.balanceOf(alice.address);
    let initalXytBal = await pendleCXyt.balanceOf(alice.address);
    let initalTestTokenBal = await testToken.balanceOf(alice.address);

    let totalSupply = await pendleCMarket.totalSupply();
    await pendleRouter.addMarketLiquiditySingle(
      consts.MARKET_FACTORY_COMPOUND,
      pendleCXyt.address,
      testToken.address,
      false,
      amountToTokenize.div(10),
      totalSupply.div(21),
      consts.HIGH_GAS_OVERRIDE
    );

    let currentLpTokenBal = await pendleCMarket.balanceOf(alice.address);
    let currentXytBal = await pendleCXyt.balanceOf(alice.address);
    let currentTestTokenBal = await testToken.balanceOf(alice.address);

    expect(currentLpTokenBal).to.be.gt(initalLpTokenBal);
    expect(currentTestTokenBal).to.be.lt(initalTestTokenBal);
    expect(currentXytBal).to.be.equal(initalXytBal);
    // TODO: change gt,lt to approximate @Long
  });

  it.only("should be able to add XYT market liquidity", async () => {
    const amountToTokenize = amountToWei(tokenUSDT, BN.from(10));

    await bootstrapSampleMarket(amountToTokenize);
    await testToken.approve(pendleCMarket.address, consts.MAX_ALLOWANCE);

    let initalLpTokenBal = await pendleCMarket.balanceOf(alice.address);
    let initalXytBal = await pendleCXyt.balanceOf(alice.address);
    let initalTestTokenBal = await testToken.balanceOf(alice.address);

    let totalSupply = await pendleCMarket.totalSupply();
    await pendleRouter.addMarketLiquiditySingle(
      consts.MARKET_FACTORY_COMPOUND,
      pendleCXyt.address,
      testToken.address,
      true,
      amountToTokenize.div(10),
      totalSupply.div(21),
      consts.HIGH_GAS_OVERRIDE
    );

    let currentLpTokenBal = await pendleCMarket.balanceOf(alice.address);
    let currentXytBal = await pendleCXyt.balanceOf(alice.address);
    let currentTestTokenBal = await testToken.balanceOf(alice.address);

    expect(currentLpTokenBal).to.be.gt(initalLpTokenBal);
    expect(currentTestTokenBal).to.be.equal(initalTestTokenBal);
    expect(currentXytBal).to.be.lt(initalXytBal);
    // TODO: change gt,lt to approximate @Long
  });

  it.only("should be able to getMarketTokenAddresses", async () => {
    let { token, xyt } = await pendleRouter.getMarketTokenAddresses(
      pendleCMarket.address
    );
    expect(token).to.be.equal(testToken.address);
    expect(xyt).to.be.equal(pendleCXyt.address);
  });

  it.only("shouldn't be able to create duplicated markets", async () => {
    await expect(
      pendleRouter.createMarket(
        consts.MARKET_FACTORY_COMPOUND,
        pendleCXyt.address,
        testToken.address,
        consts.HIGH_GAS_OVERRIDE
      )
    ).to.be.revertedWith("Pendle: market already exists");
  });

  it.only("shouldn't be able to create market with XYT as quote pair", async () => {
    console.log(`xyt ${pendleCXyt.address}`);
    console.log(`xyt2 ${pendleAXyt2.address}`);
    await expect(
      pendleRouter.createMarket(
        consts.MARKET_FACTORY_COMPOUND,
        pendleCXyt.address,
        pendleAXyt2.address,
        consts.HIGH_GAS_OVERRIDE
      )
    ).to.be.revertedWith("XYT_QUOTE_PAIR_FORBIDDEN");
  });

  it("AMM's formula should be correct", async () => {
    await AMMTest(
      pendleRouter,
      pendleCMarket,
      tokenUSDT,
      testToken,
      pendleCXyt,
      bootstrapSampleMarket
    );
  });
});
