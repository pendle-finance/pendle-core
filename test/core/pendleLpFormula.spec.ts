import { expect } from "chai";
import { createFixtureLoader } from "ethereum-waffle";
import { BigNumber as BN, Contract, Wallet } from "ethers";
import {
  amountToWei,
  approxBigNumber,
  consts,
  evm_revert,
  evm_snapshot,
  setTimeNextBlock,
  toFixedPoint,
  Token,
  tokens,
} from "../helpers";
import { pendleMarketFixture } from "./fixtures";
import {
  TestAddLiq,
  TestRemoveLiq,
} from "./fixtures/pendleLpFormulaScenario.fixture";
import * as scenario from "./fixtures/pendleLpFormulaScenario.fixture";

const { waffle } = require("hardhat");
const { provider } = waffle;

describe("pendleLpFormula", async () => {
  const wallets = provider.getWallets();
  const loadFixture = createFixtureLoader(wallets, provider);
  const [alice, bob, charlie] = wallets;
  let pendleRouter: Contract;
  let pendleData: Contract;
  let pendleXyt: Contract;
  let pendleStdMarket: Contract;
  let testToken: Contract;
  let snapshotId: string;
  let globalSnapshotId: string;
  let tokenUSDT: Token;

  before(async () => {
    globalSnapshotId = await evm_snapshot();

    const fixture = await loadFixture(pendleMarketFixture);
    pendleRouter = fixture.core.pendleRouter;
    pendleData = fixture.core.pendleData;
    pendleXyt = fixture.aForge.pendleAFutureYieldToken;
    testToken = fixture.testToken;
    pendleStdMarket = fixture.pendleAMarket;
    tokenUSDT = tokens.USDT;
    snapshotId = await evm_snapshot();
  });

  after(async () => {
    await evm_revert(globalSnapshotId);
  });

  beforeEach(async () => {
    await evm_revert(snapshotId);
    snapshotId = await evm_snapshot();
    await pendleData.setMarketFees(toFixedPoint("0.0035"), 0); // 0.35%
  });

  async function bootstrapMarket(amountOfXyt: BN, amountOfToken: BN) {
    await pendleRouter
      .connect(alice)
      .bootstrapMarket(
        consts.MARKET_FACTORY_AAVE,
        pendleXyt.address,
        testToken.address,
        amountOfXyt,
        amountOfToken,
        consts.HIGH_GAS_OVERRIDE
      );
  }

  async function printMarketData() {
    console.log(
      `USDT weight: ${await pendleStdMarket.getWeight(
        testToken.address
      )} USDT balance: ${await pendleStdMarket.getBalance(
        testToken.address
      )} XYT weight: ${await pendleStdMarket.getWeight(
        pendleXyt.address
      )} XYT balance: ${await pendleStdMarket.getBalance(
        pendleXyt.address
      )} totalLp: ${await pendleStdMarket.totalSupply()}`
    );
  }

  async function addLiquiditySingleToken(
    user: Wallet,
    tokenAddress: string,
    amount: BN
  ) {
    if (tokenAddress == testToken.address) {
      await pendleRouter
        .connect(user)
        .addMarketLiquiditySingle(
          consts.MARKET_FACTORY_AAVE,
          pendleXyt.address,
          testToken.address,
          false,
          amount,
          BN.from(0)
        );
    } else {
      // if (tokenAddress == pendleXyt.address) {
      await pendleRouter
        .connect(user)
        .addMarketLiquiditySingle(
          consts.MARKET_FACTORY_AAVE,
          pendleXyt.address,
          testToken.address,
          true,
          amount,
          BN.from(0)
        );
    }
  }

  async function removeLiquiditySingleToken(
    user: Wallet,
    tokenAddress: string,
    amount: BN
  ): Promise<BN> {
    let initialBalance: BN;
    let postBalance: BN;
    if (tokenAddress == testToken.address) {
      initialBalance = await testToken.balanceOf(user.address);
      await pendleRouter
        .connect(user)
        .removeMarketLiquiditySingle(
          consts.MARKET_FACTORY_AAVE,
          pendleXyt.address,
          testToken.address,
          false,
          amount,
          BN.from(0)
        );
      postBalance = await testToken.balanceOf(user.address);
    } else {
      // if (tokenAddress == pendleXyt.address)
      initialBalance = await pendleXyt.balanceOf(user.address);
      await pendleRouter
        .connect(user)
        .removeMarketLiquiditySingle(
          consts.MARKET_FACTORY_AAVE,
          pendleXyt.address,
          testToken.address,
          true,
          amount,
          BN.from(0)
        );
      postBalance = await pendleXyt.balanceOf(user.address);
    }
    return postBalance.sub(initialBalance);
  }

  async function checkLpBalance(user: Wallet, expected: BN) {
    approxBigNumber(
      await pendleStdMarket.balanceOf(user.address),
      expected,
      consts.TEST_LP_DELTA
    );
  }

  async function runTestAddLiqSingleToken(test: TestAddLiq) {
    const T1 = consts.T0.add(test.timeOffset);
    const T2 = T1.add(consts.ONE_DAY);
    await bootstrapMarket(
      amountToWei(tokenUSDT, test.initXytAmount),
      amountToWei(tokenUSDT, test.initTokenAmount)
    );

    await setTimeNextBlock(provider, T1);

    let initialTokenBalance: BN = await testToken.balanceOf(bob.address);
    let initialXytBalance: BN = await pendleXyt.balanceOf(bob.address);
    await addLiquiditySingleToken(
      bob,
      testToken.address,
      amountToWei(tokenUSDT, test.amountTokenChange)
    );
    await checkLpBalance(bob, test.expectedLpBal1);

    await setTimeNextBlock(provider, T2);
    await addLiquiditySingleToken(
      bob,
      pendleXyt.address,
      amountToWei(tokenUSDT, test.amountXytChange)
    );
    await checkLpBalance(bob, test.expectedLpBal1.add(test.expectedLpBal2));

    let finalTokenBalance: BN = await testToken.balanceOf(bob.address);
    let finalXytBalance: BN = await pendleXyt.balanceOf(bob.address);
    approxBigNumber(
      amountToWei(tokenUSDT, test.amountTokenChange),
      initialTokenBalance.sub(finalTokenBalance),
      consts.TEST_TOKEN_DELTA
    );
    approxBigNumber(
      amountToWei(tokenUSDT, test.amountXytChange),
      initialXytBalance.sub(finalXytBalance),
      consts.TEST_TOKEN_DELTA
    );
  }

  async function runTestRemoveLiqSingleToken(test: TestRemoveLiq) {
    const T1 = consts.T0.add(test.timeOffset);
    const T2 = T1.add(consts.ONE_DAY);
    await bootstrapMarket(
      amountToWei(tokenUSDT, test.initXytAmount),
      amountToWei(tokenUSDT, test.initTokenAmount)
    );

    let lpBalanceAlice: BN = await pendleStdMarket.balanceOf(alice.address);
    let totalLpAmountRemoved: BN = BN.from(0);
    let amountToRemove: BN = lpBalanceAlice.mul(test.ratioLpForToken).div(100);
    totalLpAmountRemoved = totalLpAmountRemoved.add(amountToRemove);

    await setTimeNextBlock(provider, T1);
    let balanceDiff: BN = await removeLiquiditySingleToken(
      alice,
      testToken.address,
      amountToRemove
    );
    approxBigNumber(
      test.expectedTokenDiff,
      balanceDiff,
      consts.TEST_TOKEN_DELTA
    );

    await setTimeNextBlock(provider, T2);
    amountToRemove = lpBalanceAlice.mul(test.ratioLpForXyt).div(100);
    totalLpAmountRemoved = totalLpAmountRemoved.add(amountToRemove);
    balanceDiff = await removeLiquiditySingleToken(
      alice,
      pendleXyt.address,
      amountToRemove
    );
    approxBigNumber(test.expectedXytDiff, balanceDiff, consts.TEST_TOKEN_DELTA);
    approxBigNumber(
      lpBalanceAlice.sub(totalLpAmountRemoved),
      await pendleStdMarket.balanceOf(alice.address),
      BN.from(1)
    ); // should remove the exact amount
  }

  // TODO: Investigate why market can handle a large amount of token swapping in
  it("add liquidity with single token test 1", async () => {
    await runTestAddLiqSingleToken(scenario.scenarioAdd01());
  });

  it("add liquidity with single token test 2", async () => {
    await runTestAddLiqSingleToken(scenario.scenarioAdd02());
  });

  it("add liquidity with single token test 3", async () => {
    await runTestAddLiqSingleToken(scenario.scenarioAdd03());
  });

  it("add liquidity with single token test 4", async () => {
    await runTestAddLiqSingleToken(scenario.scenarioAdd04());
  });

  it("add liquidity with single token test 5", async () => {
    await runTestAddLiqSingleToken(scenario.scenarioAdd05());
  });

  it("remove liquidity with single token test 1", async () => {
    await runTestRemoveLiqSingleToken(scenario.scenarioRemove01());
  });

  it("remove liquidity with single token test 2", async () => {
    await runTestRemoveLiqSingleToken(scenario.scenarioRemove02());
  });

  it("remove liquidity with single token test 3", async () => {
    await runTestRemoveLiqSingleToken(scenario.scenarioRemove03());
  });

  it("remove liquidity with single token test 4", async () => {
    await runTestRemoveLiqSingleToken(scenario.scenarioRemove04());
  });

  it("remove liquidity with single token test 5", async () => {
    await runTestRemoveLiqSingleToken(scenario.scenarioRemove04());
  });

  it("add liquidity dual token test 1", async () => {
    const amountOfXyt = amountToWei(tokenUSDT, BN.from(331));
    const amountOfToken = amountToWei(tokenUSDT, BN.from(891));
    await bootstrapMarket(amountOfXyt, amountOfToken);

    const totalSupply: BN = await pendleStdMarket.totalSupply();
    // weights: Token: 660606624370, XYT: 438905003406

    let initialXytBalance: BN = await pendleXyt.balanceOf(bob.address);
    let initialTokenBalance: BN = await testToken.balanceOf(bob.address);

    await pendleRouter
      .connect(bob)
      .addMarketLiquidityAll(
        consts.MARKET_FACTORY_AAVE,
        pendleXyt.address,
        testToken.address,
        initialXytBalance,
        initialTokenBalance,
        totalSupply.mul(3),
        consts.HIGH_GAS_OVERRIDE
      );

    let finalXytBalance = await pendleXyt.balanceOf(bob.address);
    let finalTokenBalance = await testToken.balanceOf(bob.address);
    let amountXytUsed = initialXytBalance.sub(finalXytBalance);
    let amountTokenUsed = initialTokenBalance.sub(finalTokenBalance);

    await checkLpBalance(bob, totalSupply.mul(3));
    approxBigNumber(amountXytUsed, amountOfXyt.mul(3), consts.TEST_TOKEN_DELTA);
    approxBigNumber(
      amountTokenUsed,
      amountOfToken.mul(3),
      consts.TEST_TOKEN_DELTA
    );

    approxBigNumber(
      await pendleXyt.balanceOf(pendleStdMarket.address),
      amountOfXyt.mul(4),
      BN.from(0)
    );
    approxBigNumber(
      await testToken.balanceOf(pendleStdMarket.address),
      amountOfToken.mul(4),
      BN.from(0)
    );
    approxBigNumber(
      await pendleStdMarket.totalSupply(),
      totalSupply.mul(4),
      BN.from(0)
    );
  });

  it("remove liquidity dual token test 1", async () => {
    const amountOfXyt = amountToWei(tokenUSDT, BN.from(331));
    const amountOfToken = amountToWei(tokenUSDT, BN.from(891));
    await bootstrapMarket(amountOfXyt, amountOfToken);

    const totalSupply: BN = await pendleStdMarket.totalSupply();
    // weights: Token: 660606624370, XYT: 438905003406

    let initialXytBalance: BN = await pendleXyt.balanceOf(alice.address);
    let initialTokenBalance: BN = await testToken.balanceOf(alice.address);

    await pendleRouter.removeMarketLiquidityAll(
      consts.MARKET_FACTORY_AAVE,
      pendleXyt.address,
      testToken.address,
      totalSupply,
      BN.from(0),
      BN.from(0),
      consts.HIGH_GAS_OVERRIDE
    );

    await checkLpBalance(alice, BN.from(0));

    let finalXytBalance = await pendleXyt.balanceOf(alice.address);
    let finalTokenBalance = await testToken.balanceOf(alice.address);
    let amountXytReceived = finalXytBalance.sub(initialXytBalance);
    let amountTokenReceived = finalTokenBalance.sub(initialTokenBalance);

    approxBigNumber(amountXytReceived, amountOfXyt, consts.TEST_TOKEN_DELTA);
    approxBigNumber(
      amountTokenReceived,
      amountOfToken,
      consts.TEST_TOKEN_DELTA
    );

    approxBigNumber(
      await pendleXyt.balanceOf(pendleStdMarket.address),
      BN.from(0),
      BN.from(0)
    );
    approxBigNumber(
      await testToken.balanceOf(pendleStdMarket.address),
      BN.from(0),
      BN.from(0)
    );
    approxBigNumber(
      await pendleStdMarket.totalSupply(),
      BN.from(0),
      BN.from(0)
    );
  });
});
