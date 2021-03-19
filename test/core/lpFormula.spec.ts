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
  mintOtAndXyt,
} from "../helpers";
import { marketFixture } from "./fixtures";
import * as scenario from "./fixtures/lpFormulaScenario.fixture";
import {
  TestAddLiq,
  TestRemoveLiq,
} from "./fixtures/lpFormulaScenario.fixture";

const { waffle } = require("hardhat");
const { provider } = waffle;

describe("lpFormula", async () => {
  const wallets = provider.getWallets();
  const loadFixture = createFixtureLoader(wallets, provider);
  const [alice, bob, charlie] = wallets;
  let router: Contract;
  let data: Contract;
  let xyt: Contract;
  let stdMarket: Contract;
  let testToken: Contract;
  let snapshotId: string;
  let globalSnapshotId: string;
  let tokenUSDT: Token;

  before(async () => {
    globalSnapshotId = await evm_snapshot();

    const fixture = await loadFixture(marketFixture);
    router = fixture.core.router;
    data = fixture.core.data;
    xyt = fixture.aForge.aFutureYieldToken;
    testToken = fixture.testToken;
    stdMarket = fixture.aMarket;
    tokenUSDT = tokens.USDT;
    await data.setMarketFees(toFixedPoint("0.0035"), 0); // 0.35%
    for (var person of [alice, bob, charlie]) {
      await mintOtAndXyt(
        provider,
        tokenUSDT,
        person,
        BN.from(10).pow(10),
        router
      );
    }
    snapshotId = await evm_snapshot();
  });

  after(async () => {
    await evm_revert(globalSnapshotId);
  });

  beforeEach(async () => {
    await evm_revert(snapshotId);
    snapshotId = await evm_snapshot();
  });

  async function bootstrapMarket(amountOfXyt: BN, amountOfToken: BN) {
    await router
      .connect(alice)
      .bootstrapMarket(
        consts.MARKET_FACTORY_AAVE,
        xyt.address,
        testToken.address,
        amountOfXyt,
        amountOfToken,
        consts.HIGH_GAS_OVERRIDE
      );
  }

  async function printMarketData() {
    console.log(
      `USDT weight: ${await stdMarket.getWeight(
        testToken.address
      )} USDT balance: ${await stdMarket.getBalance(
        testToken.address
      )} XYT weight: ${await stdMarket.getWeight(
        xyt.address
      )} XYT balance: ${await stdMarket.getBalance(
        xyt.address
      )} totalLp: ${await stdMarket.totalSupply()}`
    );
  }

  async function addLiquiditySingleToken(
    user: Wallet,
    tokenAddress: string,
    amount: BN
  ) {
    if (tokenAddress == testToken.address) {
      await router
        .connect(user)
        .addMarketLiquiditySingle(
          consts.MARKET_FACTORY_AAVE,
          xyt.address,
          testToken.address,
          false,
          amount,
          BN.from(0)
        );
    } else {
      // if (tokenAddress == xyt.address) {
      await router
        .connect(user)
        .addMarketLiquiditySingle(
          consts.MARKET_FACTORY_AAVE,
          xyt.address,
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
      await router
        .connect(user)
        .removeMarketLiquiditySingle(
          consts.MARKET_FACTORY_AAVE,
          xyt.address,
          testToken.address,
          false,
          amount,
          BN.from(0)
        );
      postBalance = await testToken.balanceOf(user.address);
    } else {
      // if (tokenAddress == xyt.address)
      initialBalance = await xyt.balanceOf(user.address);
      await router
        .connect(user)
        .removeMarketLiquiditySingle(
          consts.MARKET_FACTORY_AAVE,
          xyt.address,
          testToken.address,
          true,
          amount,
          BN.from(0)
        );
      postBalance = await xyt.balanceOf(user.address);
    }
    return postBalance.sub(initialBalance);
  }

  async function checkLpBalance(user: Wallet, expected: BN) {
    approxBigNumber(
      await stdMarket.balanceOf(user.address),
      expected,
      consts.TEST_LP_DELTA
    );
  }

  async function runTestAddLiqSingleToken(test: TestAddLiq) {
    const T1 = consts.T0.add(test.timeOffset);
    const T2 = T1.add(consts.ONE_DAY);
    // console.log((await xyt.balanceOf(alice.address)), (await testToken.balanceOf(alice.address)));
    await bootstrapMarket(
      amountToWei(test.initXytAmount, 6),
      amountToWei(test.initTokenAmount, 6)
    );
    // console.log((await xyt.balanceOf(alice.address)), (await testToken.balanceOf(alice.address)));
    await setTimeNextBlock(provider, T1);

    let initialTokenBalance: BN = await testToken.balanceOf(bob.address);
    let initialXytBalance: BN = await xyt.balanceOf(bob.address);
    // console.log((await testToken.balanceOf(bob.address)));
    await addLiquiditySingleToken(
      bob,
      testToken.address,
      amountToWei(test.amountTokenChange, 6)
    );
    await checkLpBalance(bob, test.expectedLpBal1);

    await setTimeNextBlock(provider, T2);
    // console.log((await xyt.balanceOf(bob.address)));
    // console.log(amountToWei(test.amountXytChange, 6));
    await addLiquiditySingleToken(
      bob,
      xyt.address,
      amountToWei(test.amountXytChange, 6)
    );
    await checkLpBalance(bob, test.expectedLpBal1.add(test.expectedLpBal2));

    let finalTokenBalance: BN = await testToken.balanceOf(bob.address);
    let finalXytBalance: BN = await xyt.balanceOf(bob.address);
    approxBigNumber(
      amountToWei(test.amountTokenChange, 6),
      initialTokenBalance.sub(finalTokenBalance),
      consts.TEST_TOKEN_DELTA
    );
    approxBigNumber(
      amountToWei(test.amountXytChange, 6),
      initialXytBalance.sub(finalXytBalance),
      consts.TEST_TOKEN_DELTA
    );
  }

  async function runTestRemoveLiqSingleToken(test: TestRemoveLiq) {
    const T1 = consts.T0.add(test.timeOffset);
    const T2 = T1.add(consts.ONE_DAY);
    await bootstrapMarket(
      amountToWei(test.initXytAmount, 6),
      amountToWei(test.initTokenAmount, 6)
    );

    let lpBalanceAlice: BN = await stdMarket.balanceOf(alice.address);
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
      xyt.address,
      amountToRemove
    );
    approxBigNumber(test.expectedXytDiff, balanceDiff, consts.TEST_TOKEN_DELTA);
    approxBigNumber(
      lpBalanceAlice.sub(totalLpAmountRemoved),
      await stdMarket.balanceOf(alice.address),
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
    const amountOfXyt = amountToWei(BN.from(331), 6);
    const amountOfToken = amountToWei(BN.from(891), 6);
    await bootstrapMarket(amountOfXyt, amountOfToken);

    const totalSupply: BN = await stdMarket.totalSupply();
    // weights: Token: 660606624370, XYT: 438905003406

    let initialXytBalance: BN = await xyt.balanceOf(bob.address);
    let initialTokenBalance: BN = await testToken.balanceOf(bob.address);

    await router
      .connect(bob)
      .addMarketLiquidityAll(
        consts.MARKET_FACTORY_AAVE,
        xyt.address,
        testToken.address,
        initialXytBalance,
        initialTokenBalance,
        totalSupply.mul(3),
        consts.HIGH_GAS_OVERRIDE
      );

    let finalXytBalance = await xyt.balanceOf(bob.address);
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
      await xyt.balanceOf(stdMarket.address),
      amountOfXyt.mul(4),
      BN.from(0)
    );
    approxBigNumber(
      await testToken.balanceOf(stdMarket.address),
      amountOfToken.mul(4),
      BN.from(0)
    );
    approxBigNumber(
      await stdMarket.totalSupply(),
      totalSupply.mul(4),
      BN.from(0)
    );
  });

  it("remove liquidity dual token test 1", async () => {
    const amountOfXyt = amountToWei(BN.from(331), 6);
    const amountOfToken = amountToWei(BN.from(891), 6);
    await bootstrapMarket(amountOfXyt, amountOfToken);

    const totalSupply: BN = await stdMarket.totalSupply();
    // weights: Token: 660606624370, XYT: 438905003406

    let initialXytBalance: BN = await xyt.balanceOf(alice.address);
    let initialTokenBalance: BN = await testToken.balanceOf(alice.address);

    await router.removeMarketLiquidityAll(
      consts.MARKET_FACTORY_AAVE,
      xyt.address,
      testToken.address,
      totalSupply,
      BN.from(0),
      BN.from(0),
      consts.HIGH_GAS_OVERRIDE
    );

    await checkLpBalance(alice, BN.from(0));

    let finalXytBalance = await xyt.balanceOf(alice.address);
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
      await xyt.balanceOf(stdMarket.address),
      BN.from(0),
      BN.from(0)
    );
    approxBigNumber(
      await testToken.balanceOf(stdMarket.address),
      BN.from(0),
      BN.from(0)
    );
    approxBigNumber(await stdMarket.totalSupply(), BN.from(0), BN.from(0));
  });
});
