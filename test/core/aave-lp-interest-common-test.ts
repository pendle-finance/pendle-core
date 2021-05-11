import { createFixtureLoader } from "ethereum-waffle";
import { BigNumber as BN, Wallet } from "ethers";
import {
  advanceTime,
  approxBigNumber,
  consts,
  emptyToken,
  evm_revert,
  evm_snapshot,
  mintOtAndXyt,
  Token,
  tokens,
} from "../helpers";
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
    const [alice, bob, charlie, dave, eve] = wallets;
    let snapshotId: string;
    let globalSnapshotId: string;
    let USDT: Token;
    let amountXytRef = BN.from(10).pow(10);
    let env: TestEnv = {} as TestEnv;

    async function buildTestEnv() {
      let fixture: MarketFixture = await loadFixture(marketFixture);
      if (isAaveV1)
        await parseTestEnvMarketFixture(alice, Mode.AAVE_V1, env, fixture);
      else await parseTestEnvMarketFixture(alice, Mode.AAVE_V2, env, fixture);
      USDT = tokens.USDT;
      env.TEST_DELTA = BN.from(60000);
    }

    async function redeemAll() {
      for (let user of [alice, bob, charlie, dave]) {
        await env.router.redeemLpInterests(
          env.stdMarket.address,
          user.address,
          consts.HIGH_GAS_OVERRIDE
        );
        await env.router.redeemDueInterests(
          env.FORGE_ID,
          USDT.address,
          env.T0.add(consts.SIX_MONTH),
          user.address,
          consts.HIGH_GAS_OVERRIDE
        );
      }
    }

    before(async () => {
      globalSnapshotId = await evm_snapshot();
      await buildTestEnv();
      for (let user of [alice, bob, charlie, dave, eve]) {
        await emptyToken(env.ot, user);
        await emptyToken(env.xyt, user);
      }

      await mintOtAndXytUSDT(alice, amountXytRef.div(10 ** 6).mul(4));
      amountXytRef = (await env.xyt.balanceOf(alice.address)).div(4);
      for (let user of [bob, charlie, dave]) {
        await env.ot.transfer(user.address, amountXytRef);
        await env.xyt.transfer(user.address, amountXytRef);
      }

      for (let user of [alice, bob, charlie, dave, eve]) {
        await emptyToken(env.aUSDT, user);
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

    async function bootstrapSampleMarket(amount: BN) {
      await env.router.bootstrapMarket(
        env.MARKET_FACTORY_ID,
        env.xyt.address,
        env.testToken.address,
        amount,
        await env.testToken.balanceOf(alice.address),
        consts.HIGH_GAS_OVERRIDE
      );
    }

    async function addMarketLiquidityDualByXyt(user: Wallet, amountXyt: BN) {
      await env.router
        .connect(user)
        .addMarketLiquidityDual(
          env.MARKET_FACTORY_ID,
          env.xyt.address,
          env.testToken.address,
          amountXyt,
          consts.INF,
          amountXyt,
          BN.from(0),
          consts.HIGH_GAS_OVERRIDE
        );
    }

    async function addMarketLiquidityToken(user: Wallet, amount: BN) {
      await env.router
        .connect(user)
        .addMarketLiquiditySingle(
          env.MARKET_FACTORY_ID,
          env.xyt.address,
          env.testToken.address,
          false,
          amount,
          BN.from(0),
          consts.HIGH_GAS_OVERRIDE
        );
    }

    async function addMarketLiquidityXyt(user: Wallet, amount: BN) {
      await env.router
        .connect(user)
        .addMarketLiquiditySingle(
          env.MARKET_FACTORY_ID,
          env.xyt.address,
          env.testToken.address,
          true,
          amount,
          BN.from(0),
          consts.HIGH_GAS_OVERRIDE
        );
    }

    async function removeMarketLiquidityDual(user: Wallet, amount: BN) {
      await env.router
        .connect(user)
        .removeMarketLiquidityDual(
          env.MARKET_FACTORY_ID,
          env.xyt.address,
          env.testToken.address,
          amount,
          BN.from(0),
          BN.from(0),
          consts.HIGH_GAS_OVERRIDE
        );
    }

    async function removeMarketLiquidityXyt(user: Wallet, amount: BN) {
      await env.router
        .connect(user)
        .removeMarketLiquiditySingle(
          env.MARKET_FACTORY_ID,
          env.xyt.address,
          env.testToken.address,
          true,
          amount,
          BN.from(0),
          consts.HIGH_GAS_OVERRIDE
        );
    }

    async function removeMarketLiquidityToken(user: Wallet, amount: BN) {
      await env.router
        .connect(user)
        .removeMarketLiquiditySingle(
          env.MARKET_FACTORY_ID,
          env.xyt.address,
          env.testToken.address,
          false,
          amount,
          BN.from(0),
          consts.HIGH_GAS_OVERRIDE
        );
    }

    async function mintOtAndXytUSDT(user: Wallet, amount: BN) {
      await mintOtAndXyt(
        USDT,
        user,
        amount,
        env.routerFixture,
      );
    }

    async function swapExactInTokenToXyt(user: Wallet, inAmount: BN) {
      await env.router
        .connect(user)
        .swapExactIn(
          env.testToken.address,
          env.xyt.address,
          inAmount,
          BN.from(0),
          env.MARKET_FACTORY_ID,
          consts.HIGH_GAS_OVERRIDE
        );
    }

    async function swapExactInXytToToken(user: Wallet, inAmount: BN) {
      await env.router
        .connect(user)
        .swapExactIn(
          env.xyt.address,
          env.testToken.address,
          inAmount,
          BN.from(0),
          env.MARKET_FACTORY_ID,
          consts.HIGH_GAS_OVERRIDE
        );
    }

    async function addFakeXyt(user: Wallet, amount: BN) {
      await env.xyt.connect(user).transfer(env.stdMarket.address, amount);
    }

    async function getLPBalance(user: Wallet) {
      return await env.stdMarket.balanceOf(user.address);
    }

    async function checkAUSDTBalance(expectedResult: number[]) {
      for (let id = 0; id < 4; id++) {
        approxBigNumber(
          await env.aUSDT.balanceOf(wallets[id].address),
          BN.from(expectedResult[id]),
          env.TEST_DELTA
        );
      }
    }

    it("test 1", async () => {
      await mintOtAndXytUSDT(eve, BN.from(10).pow(5));

      await bootstrapSampleMarket(BN.from(10).pow(10));

      await advanceTime(consts.FIFTEEN_DAY);
      await addMarketLiquidityDualByXyt(bob, amountXytRef.div(10));
      await swapExactInXytToToken(eve, BN.from(10).pow(9));

      await advanceTime(consts.FIFTEEN_DAY);
      await addMarketLiquidityDualByXyt(charlie, amountXytRef.div(5));
      await swapExactInXytToToken(eve, BN.from(10).pow(9));

      await advanceTime(consts.FIFTEEN_DAY);
      await addMarketLiquidityDualByXyt(dave, amountXytRef.div(2));

      await advanceTime(consts.ONE_MONTH);
      await addMarketLiquidityDualByXyt(dave, amountXytRef.div(3));
      await swapExactInXytToToken(eve, BN.from(10).pow(10));
      await addMarketLiquidityDualByXyt(bob, amountXytRef.div(6));

      await advanceTime(consts.ONE_MONTH);
      await addMarketLiquidityDualByXyt(charlie, amountXytRef.div(3));
      await swapExactInXytToToken(eve, BN.from(10).pow(10));
      await addMarketLiquidityDualByXyt(charlie, amountXytRef.div(3));

      await advanceTime(consts.ONE_MONTH);
      await swapExactInXytToToken(eve, BN.from(10).pow(10));
      await addMarketLiquidityDualByXyt(bob, amountXytRef.div(2));

      await advanceTime(consts.ONE_MONTH);
      await swapExactInXytToToken(eve, BN.from(10).pow(10));
      await addMarketLiquidityDualByXyt(bob, amountXytRef.div(5));

      await redeemAll();

      // for (let user of [alice, bob, charlie, dave]) {
      //   console.log((await env.aUSDT.balanceOf(user.address)).toString());
      // }
      const aaveV1ExpectedResult: number[] = [
        374114313,
        247254533,
        263856546,
        308333911,
      ];
      const aaveV2ExpectedResult: number[] = [
        4036865024,
        2747367514,
        2908674421,
        3352118785,
      ];
      if (isAaveV1) {
        await checkAUSDTBalance(aaveV1ExpectedResult);
      } else {
        await checkAUSDTBalance(aaveV2ExpectedResult);
      }
    });

    it("test 2", async () => {
      await mintOtAndXytUSDT(eve, BN.from(10).pow(5));

      await bootstrapSampleMarket(BN.from(10).pow(10));

      await advanceTime(consts.FIFTEEN_DAY);
      await addMarketLiquidityXyt(bob, amountXytRef.div(10));
      await swapExactInXytToToken(eve, BN.from(10).pow(9));

      await advanceTime(consts.FIFTEEN_DAY);
      await addMarketLiquidityXyt(charlie, amountXytRef.div(5));
      await swapExactInXytToToken(eve, BN.from(10).pow(9));

      await advanceTime(consts.FIFTEEN_DAY);
      await addMarketLiquidityXyt(dave, amountXytRef.div(2));

      await advanceTime(consts.ONE_MONTH);
      await addMarketLiquidityXyt(dave, amountXytRef.div(3));
      await swapExactInXytToToken(eve, BN.from(10).pow(10));
      await addMarketLiquidityXyt(bob, amountXytRef.div(6));

      await advanceTime(consts.ONE_MONTH);
      await addMarketLiquidityXyt(charlie, amountXytRef.div(3));
      await swapExactInXytToToken(eve, BN.from(10).pow(10));
      await addMarketLiquidityXyt(charlie, amountXytRef.div(3));

      await advanceTime(consts.ONE_MONTH);
      await swapExactInXytToToken(eve, BN.from(10).pow(10));
      await addMarketLiquidityXyt(bob, amountXytRef.div(2));

      await advanceTime(consts.ONE_MONTH);
      await swapExactInXytToToken(eve, BN.from(10).pow(10));
      await addMarketLiquidityXyt(bob, amountXytRef.div(5));

      await redeemAll();

      // for (let user of [alice, bob, charlie, dave]) {
      //   console.log((await env.aUSDT.balanceOf(user.address)).toString());
      // }

      const aaveV1ExpectedResult: number[] = [
        560854508,
        209872642,
        204051257,
        218780675,
      ];
      const aaveV2ExpectedResult: number[] = [
        5937256443,
        2370247428,
        2306560648,
        2430958736,
      ];
      if (isAaveV1) {
        await checkAUSDTBalance(aaveV1ExpectedResult);
      } else {
        await checkAUSDTBalance(aaveV2ExpectedResult);
      }
    });

    // xit("test 3", async () => {
    //   await mintOtAndXytUSDT(eve, BN.from(10).pow(5));

    //   await bootstrapSampleMarket(BN.from(10).pow(10));

    //   await advanceTime(consts.FIFTEEN_DAY);
    //   await addMarketLiquidityDualByXyt(bob, amountXytRef.div(10));
    //   await addFakeXyt(eve, BN.from(10).pow(9));

    //   await advanceTime(consts.FIFTEEN_DAY);
    //   await addMarketLiquidityDualByXyt(charlie, amountXytRef.div(5));
    //   await addFakeXyt(eve, BN.from(10).pow(9));

    //   await advanceTime(consts.FIFTEEN_DAY);
    //   await addMarketLiquidityDualByXyt(dave, amountXytRef.div(2));

    //   await advanceTime(consts.ONE_MONTH);
    //   await addMarketLiquidityDualByXyt(dave, amountXytRef.div(3));
    //   await addFakeXyt(eve, BN.from(10).pow(10));
    //   await addMarketLiquidityDualByXyt(bob, amountXytRef.div(6));

    //   await advanceTime(consts.ONE_MONTH);
    //   await addMarketLiquidityDualByXyt(charlie, amountXytRef.div(3));
    //   await addFakeXyt(eve, BN.from(10).pow(10));
    //   await addMarketLiquidityDualByXyt(charlie, amountXytRef.div(3));

    //   await advanceTime(consts.ONE_MONTH);
    //   await addFakeXyt(eve, BN.from(10).pow(10));
    //   await addMarketLiquidityDualByXyt(bob, amountXytRef.div(2));

    //   await advanceTime(consts.ONE_MONTH);
    //   await addFakeXyt(eve, BN.from(10).pow(10));
    //   await addMarketLiquidityDualByXyt(bob, amountXytRef.div(5));

    //   await redeemAll();

    // for (let user of [alice, bob, charlie, dave]) {
    //   console.log((await env.aUSDT.balanceOf(user.address)).toString());
    // }

    //   console.log(1);
    //   approxBigNumber(
    //     await env.aUSDT.balanceOf(alice.address),
    //     BN.from(803722622),
    //     acceptedDelta
    //   );
    //   console.log(1);
    //   approxBigNumber(
    //     await env.aUSDT.balanceOf(bob.address),
    //     BN.from(803722622),
    //     acceptedDelta
    //   );
    //   console.log(1);
    //   approxBigNumber(
    //     await env.aUSDT.balanceOf(charlie.address),
    //     BN.from(803722622),
    //     acceptedDelta
    //   );
    //   console.log(1);
    //   approxBigNumber(
    //     await env.aUSDT.balanceOf(dave.address),
    //     BN.from(803722622),
    //     acceptedDelta
    //   );
    // });

    it("test 4", async () => {
      await mintOtAndXytUSDT(eve, BN.from(10).pow(5));

      await bootstrapSampleMarket(BN.from(10).pow(10));
      await advanceTime(consts.ONE_DAY.mul(5));
      await removeMarketLiquidityDual(
        alice,
        (await getLPBalance(alice)).div(2)
      );

      await advanceTime(consts.FIFTEEN_DAY);
      await addMarketLiquidityXyt(bob, amountXytRef.div(10));
      await swapExactInXytToToken(eve, BN.from(10).pow(9));

      await advanceTime(consts.FIFTEEN_DAY);
      await removeMarketLiquidityXyt(bob, await getLPBalance(bob));
      await addMarketLiquidityDualByXyt(charlie, amountXytRef.div(5));
      await swapExactInXytToToken(eve, BN.from(10).pow(9));
      await addMarketLiquidityDualByXyt(
        alice,
        await env.xyt.balanceOf(alice.address)
      );

      await advanceTime(consts.FIFTEEN_DAY);
      await addMarketLiquidityXyt(dave, amountXytRef.div(2));
      await removeMarketLiquidityToken(
        charlie,
        (await getLPBalance(charlie)).div(3)
      );

      await advanceTime(consts.ONE_MONTH);
      await addMarketLiquidityXyt(dave, amountXytRef.div(3));
      await swapExactInXytToToken(eve, BN.from(10).pow(10));
      await addMarketLiquidityXyt(bob, amountXytRef.div(6));

      await advanceTime(consts.ONE_MONTH);
      await removeMarketLiquidityXyt(dave, (await getLPBalance(dave)).div(3));
      await addMarketLiquidityXyt(charlie, amountXytRef.div(3));
      await swapExactInXytToToken(eve, BN.from(10).pow(10));
      await addMarketLiquidityDualByXyt(charlie, amountXytRef.div(3));

      await advanceTime(consts.ONE_MONTH);
      await swapExactInXytToToken(eve, BN.from(10).pow(10));
      await addMarketLiquidityXyt(bob, amountXytRef.div(2));
      await swapExactInXytToToken(eve, BN.from(10).pow(10));
      await addMarketLiquidityXyt(bob, amountXytRef.div(5));

      await advanceTime(consts.ONE_MONTH);

      await redeemAll();

      // for (let user of [alice, bob, charlie, dave]) {
      //   console.log((await env.aUSDT.balanceOf(user.address)).toString());
      // }

      const aaveV1ExpectedResult: number[] = [
        541848481,
        209321719,
        259943321,
        250376127,
      ];
      const aaveV2ExpectedResult: number[] = [
        5706237164,
        2385168611,
        2873558523,
        2750487583,
      ];
      if (isAaveV1) {
        await checkAUSDTBalance(aaveV1ExpectedResult);
      } else {
        await checkAUSDTBalance(aaveV2ExpectedResult);
      }
    });

    it("test 5", async () => {
      await bootstrapSampleMarket(BN.from(10).pow(10));

      await advanceTime(consts.ONE_DAY.mul(5));
      await removeMarketLiquidityDual(
        alice,
        (await getLPBalance(alice)).div(2)
      );

      await advanceTime(consts.FIFTEEN_DAY);
      await addMarketLiquidityDualByXyt(bob, amountXytRef.div(10));

      await advanceTime(consts.FIFTEEN_DAY);
      await addMarketLiquidityDualByXyt(charlie, amountXytRef.div(5));

      await addMarketLiquidityDualByXyt(
        alice,
        (await env.xyt.balanceOf(alice.address)).div(2)
      );

      await advanceTime(consts.FIFTEEN_DAY);

      await advanceTime(consts.ONE_MONTH);
      await addMarketLiquidityDualByXyt(bob, amountXytRef.div(6));

      await advanceTime(consts.ONE_MONTH);
      await addMarketLiquidityDualByXyt(charlie, amountXytRef.div(3));
      await addMarketLiquidityDualByXyt(charlie, amountXytRef.div(3));

      await advanceTime(consts.ONE_MONTH);
      await addMarketLiquidityDualByXyt(bob, amountXytRef.div(2));
      await addMarketLiquidityDualByXyt(bob, amountXytRef.div(5));

      await advanceTime(consts.ONE_MONTH.mul(24));

      for (let user of [alice, bob, charlie, dave]) {
        if ((await getLPBalance(user)).gt(0)) {
          await removeMarketLiquidityDual(user, await getLPBalance(user));
        }
        if ((await env.ot.balanceOf(user.address)).gt(0)) {
          await env.router
            .connect(user)
            .redeemAfterExpiry(
              env.FORGE_ID,
              USDT.address,
              env.T0.add(consts.SIX_MONTH)
            );
        }
      }

      let expectedResult = await env.aUSDT.balanceOf(dave.address);
      for (let user of [alice, bob, charlie]) {
        approxBigNumber(
          await env.aUSDT.balanceOf(user.address),
          expectedResult,
          env.TEST_DELTA
        );
      }
    });
  });
}
