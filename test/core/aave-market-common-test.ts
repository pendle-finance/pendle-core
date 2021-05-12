import { expect } from "chai";
import { createFixtureLoader } from "ethereum-waffle";
import { BigNumber as BN, Contract } from "ethers";
import ERC20 from "../../build/artifacts/@openzeppelin/contracts/token/ERC20/ERC20.sol/ERC20.json";
import {
  advanceTime,
  amountToWei,
  approxBigNumber,
  consts,
  errMsg,
  evm_revert,
  evm_snapshot,
  Token,
  tokens,
  bootstrapMarket,
  addMarketLiquiditySingle,
  addMarketLiquidityDualXyt,
  getMarketRateExactOut,
  swapExactOutXytToToken,
  swapExactInXytToToken,
  removeMarketLiquidityDual,
  getMarketRateExactIn,
  removeMarketLiquiditySingle,
} from "../helpers";
import {
  AMMTest,
  AMMNearCloseTest,
  AMMCheckLPNearCloseTest,
} from "./amm-formula-test";
import {
  marketFixture,
  MarketFixture,
  TestEnv,
  Mode,
  parseTestEnvMarketFixture,
} from "./fixtures";

const { waffle } = require("hardhat");
const { provider } = waffle;

export function runTest(isAaveV1: boolean) {
  describe("", async () => {
    const wallets = provider.getWallets();
    const loadFixture = createFixtureLoader(wallets, provider);
    const [alice, bob] = wallets;
    let snapshotId: string;
    let globalSnapshotId: string;
    let env: TestEnv = {} as TestEnv;
    const REF_AMOUNT: BN = amountToWei(BN.from(100), 6);

    async function buildTestEnv() {
      let fixture: MarketFixture = await loadFixture(marketFixture);
      if (isAaveV1)
        await parseTestEnvMarketFixture(alice, Mode.AAVE_V1, env, fixture);
      else await parseTestEnvMarketFixture(alice, Mode.AAVE_V2, env, fixture);
      env.TEST_DELTA = BN.from(60000);
    }

    before(async () => {
      globalSnapshotId = await evm_snapshot();
      await buildTestEnv();
      snapshotId = await evm_snapshot();
    });

    after(async () => {
      await evm_revert(globalSnapshotId);
    });

    beforeEach(async () => {
      await evm_revert(snapshotId);
      snapshotId = await evm_snapshot();
    });

    it("should be able to join a bootstrapped market with a single standard token", async () => {
      await bootstrapMarket(env, alice, REF_AMOUNT);

      let initialWalletBalance = await env.stdMarket.balanceOf(alice.address);

      await addMarketLiquiditySingle(env, alice, REF_AMOUNT.div(10), false);
      let currentWalletBalance = await env.stdMarket.balanceOf(alice.address);
      expect(currentWalletBalance).to.be.gt(initialWalletBalance);
    });

    it("should be able to bootstrap", async () => {
      await bootstrapMarket(env, alice, REF_AMOUNT);
      let xytBalance = await env.xyt.balanceOf(env.stdMarket.address);
      let testTokenBalance = await env.testToken.balanceOf(
        env.stdMarket.address
      );

      expect(xytBalance).to.be.equal(REF_AMOUNT);
      expect(testTokenBalance).to.be.equal(REF_AMOUNT);
    });

    it("should be able to join a bootstrapped pool by dual tokens", async () => {
      await bootstrapMarket(env, alice, REF_AMOUNT);
      const totalSupply = await env.stdMarket.totalSupply();
      await addMarketLiquidityDualXyt(env, bob, REF_AMOUNT);

      let xytBalance = await env.xyt.balanceOf(env.stdMarket.address);
      let testTokenBalance = await env.testToken.balanceOf(
        env.stdMarket.address
      );
      let totalSupplyBalance = await env.stdMarket.totalSupply();

      expect(xytBalance).to.be.equal(REF_AMOUNT.mul(2));
      expect(testTokenBalance).to.be.equal(REF_AMOUNT.mul(2));
      expect(totalSupplyBalance).to.be.equal(totalSupply.mul(2));
    });

    it("should be able to swap amount out", async () => {
      await bootstrapMarket(env, alice, REF_AMOUNT);

      let xytBalanceBefore = await env.xyt.balanceOf(env.stdMarket.address);

      let result: any[] = await getMarketRateExactOut(
        env,
        amountToWei(BN.from(10), 6)
      );

      await swapExactOutXytToToken(env, bob, amountToWei(BN.from(10), 6));

      let xytBalance = await env.xyt.balanceOf(env.stdMarket.address);
      let testTokenBalance = await env.testToken.balanceOf(
        env.stdMarket.address
      );

      approxBigNumber(xytBalance, xytBalanceBefore.add(BN.from(result[1])), 20);
      approxBigNumber(testTokenBalance, REF_AMOUNT.sub(REF_AMOUNT.div(10)), 0);
    });

    it("should be able to swap amount in", async () => {
      await bootstrapMarket(env, alice, REF_AMOUNT);

      await swapExactInXytToToken(env, bob, amountToWei(BN.from(10), 6));

      let xytBalance = await env.xyt.balanceOf(env.stdMarket.address);
      let testTokenBalance = await env.testToken.balanceOf(
        env.stdMarket.address
      );

      approxBigNumber(xytBalance, REF_AMOUNT.add(REF_AMOUNT.div(10)), 30);
      approxBigNumber(
        testTokenBalance,
        REF_AMOUNT.sub(REF_AMOUNT.div(10)),
        REF_AMOUNT.div(100)
      );
    });

    it("should be able to exit a pool by dual tokens", async () => {
      await bootstrapMarket(env, alice, REF_AMOUNT);
      await advanceTime(consts.ONE_MONTH);
      const totalSupply = await env.stdMarket.totalSupply();

      await removeMarketLiquidityDual(env, alice, totalSupply.div(10));

      let xytBalance = await env.xyt.balanceOf(env.stdMarket.address);
      let testTokenBalance = await env.testToken.balanceOf(
        env.stdMarket.address
      );

      expect(xytBalance).to.be.equal(REF_AMOUNT.sub(REF_AMOUNT.div(10)));
      expect(testTokenBalance).to.be.equal(REF_AMOUNT.sub(REF_AMOUNT.div(10)));
    });

    it("the market should still be usable after all liquidity has been withdrawn", async () => {
      await bootstrapMarket(env, alice, REF_AMOUNT);
      let lpBalanceBefore: BN = await env.stdMarket.balanceOf(alice.address);

      await removeMarketLiquidityDual(env, alice, lpBalanceBefore);

      await addMarketLiquidityDualXyt(env, alice, REF_AMOUNT);

      let xytBalance = await env.xyt.balanceOf(env.stdMarket.address);
      let testTokenBalance = await env.testToken.balanceOf(
        env.stdMarket.address
      );

      approxBigNumber(xytBalance, REF_AMOUNT, BN.from(1000));
      approxBigNumber(testTokenBalance, REF_AMOUNT, BN.from(1000));
    });

    it("shouldn't be able to add liquidity by dual tokens after xyt has expired", async () => {
      await bootstrapMarket(env, alice, REF_AMOUNT);

      advanceTime(consts.ONE_YEAR);

      await expect(
        addMarketLiquidityDualXyt(env, alice, REF_AMOUNT)
      ).to.be.revertedWith(errMsg.MARKET_LOCKED);
    });

    it("shouldn't be able to add liquidity by token after xyt has expired", async () => {
      await bootstrapMarket(env, alice, REF_AMOUNT);

      await advanceTime(consts.ONE_YEAR);
      await expect(
        addMarketLiquiditySingle(env, alice, REF_AMOUNT.div(10), false)
      ).to.be.revertedWith(errMsg.MARKET_LOCKED);
    });

    it("shouldn't be able to exit market by single token after the market has expired", async () => {
      await bootstrapMarket(env, alice, REF_AMOUNT);

      await advanceTime(consts.ONE_YEAR);

      await expect(
        removeMarketLiquiditySingle(env, alice, BN.from(100), false)
      ).to.be.revertedWith(errMsg.MARKET_LOCKED);

      await expect(
        removeMarketLiquiditySingle(env, alice, BN.from(100), true)
      ).to.be.revertedWith(errMsg.MARKET_LOCKED);
    });

    it("should be able to exit a pool by dual tokens after xyt has expired", async () => {
      await bootstrapMarket(env, alice, REF_AMOUNT);
      await advanceTime(consts.ONE_YEAR);
      const totalSupply = await env.stdMarket.totalSupply();

      await removeMarketLiquidityDual(env, alice, totalSupply.div(10));

      let xytBalance = await env.xyt.balanceOf(env.stdMarket.address);
      let testTokenBalance = await env.testToken.balanceOf(
        env.stdMarket.address
      );

      expect(xytBalance).to.be.equal(REF_AMOUNT.sub(REF_AMOUNT.div(10)));
      expect(testTokenBalance).to.be.equal(REF_AMOUNT.sub(REF_AMOUNT.div(10)));
    });

    it("should be able to getReserves", async () => {
      await bootstrapMarket(env, alice, REF_AMOUNT);

      let { xytBalance, tokenBalance } = await env.stdMarket.getReserves();
      expect(xytBalance).to.be.equal(REF_AMOUNT);
      expect(tokenBalance).to.be.equal(REF_AMOUNT);
    });

    it("should be able to getMarketReserve", async () => {
      await bootstrapMarket(env, alice, REF_AMOUNT);

      let {
        xytBalance,
        tokenBalance,
      } = await env.marketReader.getMarketReserves(
        env.MARKET_FACTORY_ID,
        env.xyt.address,
        env.testToken.address
      );
      expect(xytBalance).to.be.equal(REF_AMOUNT);
      expect(tokenBalance).to.be.equal(REF_AMOUNT);
    });

    it("should be able to getMarketRateExactOut", async () => {
      await bootstrapMarket(env, alice, REF_AMOUNT);
      let result: any[] = await getMarketRateExactOut(
        env,
        amountToWei(BN.from(10), 6)
      );
      approxBigNumber(result[1], 11111205, 1000);
    });

    it("should be able to getMarketRateExactIn", async () => {
      await bootstrapMarket(env, alice, REF_AMOUNT);
      let result: any[] = await getMarketRateExactIn(
        env,
        amountToWei(BN.from(10), 6)
      );
      approxBigNumber(result[1], 9090839, 1000);
    });

    it("should be able to add market liquidity for a token", async () => {
      await bootstrapMarket(env, alice, REF_AMOUNT);
      await env.testToken.approve(env.stdMarket.address, consts.INF);

      let initialLpTokenBal = await env.stdMarket.balanceOf(alice.address);
      let initialXytBal = await env.xyt.balanceOf(alice.address);
      let initialTestTokenBal = await env.testToken.balanceOf(alice.address);

      await addMarketLiquiditySingle(env, alice, REF_AMOUNT.div(10), false);

      let currentLpTokenBal = await env.stdMarket.balanceOf(alice.address);
      let currentXytBal = await env.xyt.balanceOf(alice.address);
      let currentTestTokenBal = await env.testToken.balanceOf(alice.address);

      expect(currentLpTokenBal).to.be.gt(initialLpTokenBal);
      expect(currentTestTokenBal).to.be.lt(initialTestTokenBal);
      expect(currentXytBal).to.be.equal(initialXytBal);
    });

    it("should be able to add XYT market liquidity", async () => {
      await bootstrapMarket(env, alice, REF_AMOUNT);
      await env.testToken.approve(env.stdMarket.address, consts.INF);

      let initialLpTokenBal = await env.stdMarket.balanceOf(alice.address);
      let initialXytBal = await env.xyt.balanceOf(alice.address);
      let initialTestTokenBal = await env.testToken.balanceOf(alice.address);

      await addMarketLiquiditySingle(env, alice, REF_AMOUNT.div(10), true);

      let currentLpTokenBal = await env.stdMarket.balanceOf(alice.address);
      let currentXytBal = await env.xyt.balanceOf(alice.address);
      let currentTestTokenBal = await env.testToken.balanceOf(alice.address);

      expect(currentLpTokenBal).to.be.gt(initialLpTokenBal);
      expect(currentTestTokenBal).to.be.equal(initialTestTokenBal);
      expect(currentXytBal).to.be.lt(initialXytBal);
    });

    it("should be able to getMarketTokenAddresses", async () => {
      let {
        token: receivedToken,
        xyt: receivedXyt,
      } = await env.marketReader.getMarketTokenAddresses(env.stdMarket.address);
      expect(receivedToken).to.be.equal(env.testToken.address);
      expect(receivedXyt).to.be.equal(env.xyt.address);
    });

    it("shouldn't be able to create duplicated markets", async () => {
      await expect(
        env.router.createMarket(
          env.MARKET_FACTORY_ID,
          env.xyt.address,
          env.testToken.address,
          consts.HIGH_GAS_OVERRIDE
        )
      ).to.be.revertedWith("EXISTED_MARKET");
    });

    it("shouldn't be able to create market with XYT as quote pair", async () => {
      await expect(
        env.router.createMarket(
          env.MARKET_FACTORY_ID,
          env.xyt.address,
          env.xyt2.address,
          consts.HIGH_GAS_OVERRIDE
        )
      ).to.be.revertedWith("XYT_QUOTE_PAIR_FORBIDDEN");
    });

    it("AMM's formulas should be correct for swapExactIn", async () => {
      await AMMTest(env, true);
    });

    it("AMM's formulas should be correct for swapExactOut", async () => {
      await AMMTest(env, false);
    });

    xit("AMM's swap outcome should be correct near the expiry", async () => {
      await env.xyt
        .connect(bob)
        .transfer(alice.address, await env.xyt.balanceOf(bob.address));
      await env.testToken
        .connect(bob)
        .transfer(alice.address, await env.testToken.balanceOf(bob.address));
      await AMMNearCloseTest(env, false);
    });

    xit("AMM's LP outcome should be correct near the expiry", async () => {
      await AMMCheckLPNearCloseTest(env);
    });
  });
}
