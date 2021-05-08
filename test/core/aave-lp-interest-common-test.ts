import { createFixtureLoader } from "ethereum-waffle";
import { BigNumber as BN, Contract, Wallet } from "ethers";
import {
  advanceTime,
  approxBigNumber,
  consts,
  emptyToken,
  evm_revert,
  evm_snapshot,
  getAContract,
  mintAaveToken,
  mintOtAndXyt,
  Token,
  tokens,
} from "../helpers";
import { marketFixture, MarketFixture } from "./fixtures";

const { waffle } = require("hardhat");
const { provider } = waffle;

interface TestEnv {
  MARKET_FACTORY_ID: string;
  T0: BN;
  FORGE_ID: string;
  TEST_DELTA: BN;
}

export function runTest(isAaveV1: boolean) {
  describe("", async () => {
    const wallets = provider.getWallets();
    const loadFixture = createFixtureLoader(wallets, provider);
    const [alice, bob, charlie, dave, eve] = wallets;
    let router: Contract;
    let fixture: MarketFixture;
    let xyt: Contract;
    let ot: Contract;
    let stdMarket: Contract;
    let testToken: Contract;
    let snapshotId: string;
    let globalSnapshotId: string;
    let aUSDT: Contract;
    let tokenUSDT: Token;
    let aaveForge: Contract;
    let aaveV2Forge: Contract;
    let amountXytRef = BN.from(10).pow(10);
    let testEnv: TestEnv = {} as TestEnv;

    async function buildCommonTestEnv() {
      fixture = await loadFixture(marketFixture);
      router = fixture.core.router;
      testToken = fixture.testToken;
      tokenUSDT = tokens.USDT;
      aaveForge = fixture.aForge.aaveForge;
      aaveV2Forge = fixture.a2Forge.aaveV2Forge;
      testEnv.TEST_DELTA = BN.from(60000);
    }

    async function buildTestEnvV1() {
      ot = fixture.aForge.aOwnershipToken;
      xyt = fixture.aForge.aFutureYieldToken;
      stdMarket = fixture.aMarket;
      aUSDT = await getAContract(alice, aaveForge, tokens.USDT);
      testEnv.MARKET_FACTORY_ID = consts.MARKET_FACTORY_AAVE;
      testEnv.T0 = consts.T0;
      testEnv.FORGE_ID = consts.FORGE_AAVE;
    }

    async function buildTestEnvV2() {
      ot = fixture.a2Forge.a2OwnershipToken;
      xyt = fixture.a2Forge.a2FutureYieldToken;
      stdMarket = fixture.a2Market;
      aUSDT = await getAContract(alice, aaveV2Forge, tokens.USDT);
      testEnv.MARKET_FACTORY_ID = consts.MARKET_FACTORY_AAVE_V2;
      testEnv.T0 = consts.T0_A2;
      testEnv.FORGE_ID = consts.FORGE_AAVE_V2;
    }

    async function redeemAll() {
      for (let user of [alice, bob, charlie, dave]) {
        await router.claimLpInterests(stdMarket.address, user.address, consts.HIGH_GAS_OVERRIDE);
        await router
          .connect(user)
          .redeemDueInterests(
            testEnv.FORGE_ID,
            tokenUSDT.address,
            testEnv.T0.add(consts.SIX_MONTH),
            consts.HIGH_GAS_OVERRIDE
          );
      }
    }

    before(async () => {
      globalSnapshotId = await evm_snapshot();
      await buildCommonTestEnv();
      if (isAaveV1) {
        await buildTestEnvV1();
      } else {
        await buildTestEnvV2();
      }
      for (let user of [alice, bob, charlie, dave, eve]) {
        await emptyToken(ot, user);
        await emptyToken(xyt, user);
      }

      await mintOtAndXytUSDT(alice, amountXytRef.div(10 ** 6).mul(4));
      amountXytRef = (await xyt.balanceOf(alice.address)).div(4);
      for (let user of [bob, charlie, dave]) {
        await ot.transfer(user.address, amountXytRef);
        await xyt.transfer(user.address, amountXytRef);
      }

      for (let user of [alice, bob, charlie, dave, eve]) {
        await emptyToken(aUSDT, user);
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
      await router.bootstrapMarket(
        testEnv.MARKET_FACTORY_ID,
        xyt.address,
        testToken.address,
        amount,
        await testToken.balanceOf(alice.address),
        consts.HIGH_GAS_OVERRIDE
      );
    }

    async function addMarketLiquidityDualByXyt(user: Wallet, amountXyt: BN) {
      await router
        .connect(user)
        .addMarketLiquidityDual(
          testEnv.MARKET_FACTORY_ID,
          xyt.address,
          testToken.address,
          amountXyt,
          consts.INF,
          amountXyt,
          BN.from(0),
          consts.HIGH_GAS_OVERRIDE
        );
    }

    async function addMarketLiquidityToken(user: Wallet, amount: BN) {
      await router
        .connect(user)
        .addMarketLiquiditySingle(
          testEnv.MARKET_FACTORY_ID,
          xyt.address,
          testToken.address,
          false,
          amount,
          BN.from(0),
          consts.HIGH_GAS_OVERRIDE
        );
    }

    async function addMarketLiquidityXyt(user: Wallet, amount: BN) {
      await router
        .connect(user)
        .addMarketLiquiditySingle(
          testEnv.MARKET_FACTORY_ID,
          xyt.address,
          testToken.address,
          true,
          amount,
          BN.from(0),
          consts.HIGH_GAS_OVERRIDE
        );
    }

    async function removeMarketLiquidityDual(user: Wallet, amount: BN) {
      await router
        .connect(user)
        .removeMarketLiquidityDual(
          testEnv.MARKET_FACTORY_ID,
          xyt.address,
          testToken.address,
          amount,
          BN.from(0),
          BN.from(0),
          consts.HIGH_GAS_OVERRIDE
        );
    }

    async function removeMarketLiquidityXyt(user: Wallet, amount: BN) {
      await router
        .connect(user)
        .removeMarketLiquiditySingle(
          testEnv.MARKET_FACTORY_ID,
          xyt.address,
          testToken.address,
          true,
          amount,
          BN.from(0),
          consts.HIGH_GAS_OVERRIDE
        );
    }

    async function removeMarketLiquidityToken(user: Wallet, amount: BN) {
      await router
        .connect(user)
        .removeMarketLiquiditySingle(
          testEnv.MARKET_FACTORY_ID,
          xyt.address,
          testToken.address,
          false,
          amount,
          BN.from(0),
          consts.HIGH_GAS_OVERRIDE
        );
    }

    async function mintOtAndXytUSDT(user: Wallet, amount: BN) {
      await mintOtAndXyt(
        provider,
        tokenUSDT,
        user,
        amount,
        router,
        aaveForge,
        aaveV2Forge
      );
    }

    async function swapExactInTokenToXyt(user: Wallet, inAmount: BN) {
      await router
        .connect(user)
        .swapExactIn(
          testToken.address,
          xyt.address,
          inAmount,
          BN.from(0),
          testEnv.MARKET_FACTORY_ID,
          consts.HIGH_GAS_OVERRIDE
        );
    }

    async function swapExactInXytToToken(user: Wallet, inAmount: BN) {
      await router
        .connect(user)
        .swapExactIn(
          xyt.address,
          testToken.address,
          inAmount,
          BN.from(0),
          testEnv.MARKET_FACTORY_ID,
          consts.HIGH_GAS_OVERRIDE
        );
    }

    async function addFakeXyt(user: Wallet, amount: BN) {
      await xyt.connect(user).transfer(stdMarket.address, amount);
    }

    async function getLPBalance(user: Wallet) {
      return await stdMarket.balanceOf(user.address);
    }

    async function checkAUSDTBalance(expectedResult: number[]) {
      for (let id = 0; id < 4; id++) {
        approxBigNumber(
          await aUSDT.balanceOf(wallets[id].address),
          BN.from(expectedResult[id]),
          testEnv.TEST_DELTA
        );
      }
    }

    it("test 1", async () => {
      await mintOtAndXytUSDT(eve, BN.from(10).pow(5));

      await bootstrapSampleMarket(BN.from(10).pow(10));

      await advanceTime(provider, consts.FIFTEEN_DAY);
      await addMarketLiquidityDualByXyt(bob, amountXytRef.div(10));
      await swapExactInXytToToken(eve, BN.from(10).pow(9));

      await advanceTime(provider, consts.FIFTEEN_DAY);
      await addMarketLiquidityDualByXyt(charlie, amountXytRef.div(5));
      await swapExactInXytToToken(eve, BN.from(10).pow(9));

      await advanceTime(provider, consts.FIFTEEN_DAY);
      await addMarketLiquidityDualByXyt(dave, amountXytRef.div(2));

      await advanceTime(provider, consts.ONE_MONTH);
      await addMarketLiquidityDualByXyt(dave, amountXytRef.div(3));
      await swapExactInXytToToken(eve, BN.from(10).pow(10));
      await addMarketLiquidityDualByXyt(bob, amountXytRef.div(6));

      await advanceTime(provider, consts.ONE_MONTH);
      await addMarketLiquidityDualByXyt(charlie, amountXytRef.div(3));
      await swapExactInXytToToken(eve, BN.from(10).pow(10));
      await addMarketLiquidityDualByXyt(charlie, amountXytRef.div(3));

      await advanceTime(provider, consts.ONE_MONTH);
      await swapExactInXytToToken(eve, BN.from(10).pow(10));
      await addMarketLiquidityDualByXyt(bob, amountXytRef.div(2));

      await advanceTime(provider, consts.ONE_MONTH);
      await swapExactInXytToToken(eve, BN.from(10).pow(10));
      await addMarketLiquidityDualByXyt(bob, amountXytRef.div(5));

      await redeemAll();

      // for (let user of [alice, bob, charlie, dave]) {
      //   console.log((await aUSDT.balanceOf(user.address)).toString());
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

      await advanceTime(provider, consts.FIFTEEN_DAY);
      await addMarketLiquidityXyt(bob, amountXytRef.div(10));
      await swapExactInXytToToken(eve, BN.from(10).pow(9));

      await advanceTime(provider, consts.FIFTEEN_DAY);
      await addMarketLiquidityXyt(charlie, amountXytRef.div(5));
      await swapExactInXytToToken(eve, BN.from(10).pow(9));

      await advanceTime(provider, consts.FIFTEEN_DAY);
      await addMarketLiquidityXyt(dave, amountXytRef.div(2));

      await advanceTime(provider, consts.ONE_MONTH);
      await addMarketLiquidityXyt(dave, amountXytRef.div(3));
      await swapExactInXytToToken(eve, BN.from(10).pow(10));
      await addMarketLiquidityXyt(bob, amountXytRef.div(6));

      await advanceTime(provider, consts.ONE_MONTH);
      await addMarketLiquidityXyt(charlie, amountXytRef.div(3));
      await swapExactInXytToToken(eve, BN.from(10).pow(10));
      await addMarketLiquidityXyt(charlie, amountXytRef.div(3));

      await advanceTime(provider, consts.ONE_MONTH);
      await swapExactInXytToToken(eve, BN.from(10).pow(10));
      await addMarketLiquidityXyt(bob, amountXytRef.div(2));

      await advanceTime(provider, consts.ONE_MONTH);
      await swapExactInXytToToken(eve, BN.from(10).pow(10));
      await addMarketLiquidityXyt(bob, amountXytRef.div(5));

      await redeemAll();

      // for (let user of [alice, bob, charlie, dave]) {
      //   console.log((await aUSDT.balanceOf(user.address)).toString());
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

    //   await advanceTime(provider, consts.FIFTEEN_DAY);
    //   await addMarketLiquidityDualByXyt(bob, amountXytRef.div(10));
    //   await addFakeXyt(eve, BN.from(10).pow(9));

    //   await advanceTime(provider, consts.FIFTEEN_DAY);
    //   await addMarketLiquidityDualByXyt(charlie, amountXytRef.div(5));
    //   await addFakeXyt(eve, BN.from(10).pow(9));

    //   await advanceTime(provider, consts.FIFTEEN_DAY);
    //   await addMarketLiquidityDualByXyt(dave, amountXytRef.div(2));

    //   await advanceTime(provider, consts.ONE_MONTH);
    //   await addMarketLiquidityDualByXyt(dave, amountXytRef.div(3));
    //   await addFakeXyt(eve, BN.from(10).pow(10));
    //   await addMarketLiquidityDualByXyt(bob, amountXytRef.div(6));

    //   await advanceTime(provider, consts.ONE_MONTH);
    //   await addMarketLiquidityDualByXyt(charlie, amountXytRef.div(3));
    //   await addFakeXyt(eve, BN.from(10).pow(10));
    //   await addMarketLiquidityDualByXyt(charlie, amountXytRef.div(3));

    //   await advanceTime(provider, consts.ONE_MONTH);
    //   await addFakeXyt(eve, BN.from(10).pow(10));
    //   await addMarketLiquidityDualByXyt(bob, amountXytRef.div(2));

    //   await advanceTime(provider, consts.ONE_MONTH);
    //   await addFakeXyt(eve, BN.from(10).pow(10));
    //   await addMarketLiquidityDualByXyt(bob, amountXytRef.div(5));

    //   await redeemAll();

    //   // for (let user of [alice, bob, charlie, dave]) {
    //   //   console.log((await aUSDT.balanceOf(user.address)).toString());
    //   // }

    //   console.log(1);
    //   approxBigNumber(
    //     await aUSDT.balanceOf(alice.address),
    //     BN.from(803722622),
    //     acceptedDelta
    //   );
    //   console.log(1);
    //   approxBigNumber(
    //     await aUSDT.balanceOf(bob.address),
    //     BN.from(803722622),
    //     acceptedDelta
    //   );
    //   console.log(1);
    //   approxBigNumber(
    //     await aUSDT.balanceOf(charlie.address),
    //     BN.from(803722622),
    //     acceptedDelta
    //   );
    //   console.log(1);
    //   approxBigNumber(
    //     await aUSDT.balanceOf(dave.address),
    //     BN.from(803722622),
    //     acceptedDelta
    //   );
    // });

    it("test 4", async () => {
      await mintOtAndXytUSDT(eve, BN.from(10).pow(5));

      await bootstrapSampleMarket(BN.from(10).pow(10));
      await advanceTime(provider, consts.ONE_DAY.mul(5));
      await removeMarketLiquidityDual(
        alice,
        (await getLPBalance(alice)).div(2)
      );

      await advanceTime(provider, consts.FIFTEEN_DAY);
      await addMarketLiquidityXyt(bob, amountXytRef.div(10));
      await swapExactInXytToToken(eve, BN.from(10).pow(9));

      await advanceTime(provider, consts.FIFTEEN_DAY);
      await removeMarketLiquidityXyt(bob, await getLPBalance(bob));
      await addMarketLiquidityDualByXyt(charlie, amountXytRef.div(5));
      await swapExactInXytToToken(eve, BN.from(10).pow(9));
      await addMarketLiquidityDualByXyt(
        alice,
        await xyt.balanceOf(alice.address)
      );

      await advanceTime(provider, consts.FIFTEEN_DAY);
      await addMarketLiquidityXyt(dave, amountXytRef.div(2));
      await removeMarketLiquidityToken(
        charlie,
        (await getLPBalance(charlie)).div(3)
      );

      await advanceTime(provider, consts.ONE_MONTH);
      await addMarketLiquidityXyt(dave, amountXytRef.div(3));
      await swapExactInXytToToken(eve, BN.from(10).pow(10));
      await addMarketLiquidityXyt(bob, amountXytRef.div(6));

      await advanceTime(provider, consts.ONE_MONTH);
      await removeMarketLiquidityXyt(dave, (await getLPBalance(dave)).div(3));
      await addMarketLiquidityXyt(charlie, amountXytRef.div(3));
      await swapExactInXytToToken(eve, BN.from(10).pow(10));
      await addMarketLiquidityDualByXyt(charlie, amountXytRef.div(3));

      await advanceTime(provider, consts.ONE_MONTH);
      await swapExactInXytToToken(eve, BN.from(10).pow(10));
      await addMarketLiquidityXyt(bob, amountXytRef.div(2));
      await swapExactInXytToToken(eve, BN.from(10).pow(10));
      await addMarketLiquidityXyt(bob, amountXytRef.div(5));

      await advanceTime(provider, consts.ONE_MONTH);

      await redeemAll();

      // for (let user of [alice, bob, charlie, dave]) {
      //   console.log((await aUSDT.balanceOf(user.address)).toString());
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

      await advanceTime(provider, consts.ONE_DAY.mul(5));
      await removeMarketLiquidityDual(
        alice,
        (await getLPBalance(alice)).div(2)
      );

      await advanceTime(provider, consts.FIFTEEN_DAY);
      await addMarketLiquidityDualByXyt(bob, amountXytRef.div(10));

      await advanceTime(provider, consts.FIFTEEN_DAY);
      await addMarketLiquidityDualByXyt(charlie, amountXytRef.div(5));

      await addMarketLiquidityDualByXyt(
        alice,
        (await xyt.balanceOf(alice.address)).div(2)
      );

      await advanceTime(provider, consts.FIFTEEN_DAY);

      await advanceTime(provider, consts.ONE_MONTH);
      await addMarketLiquidityDualByXyt(bob, amountXytRef.div(6));

      await advanceTime(provider, consts.ONE_MONTH);
      await addMarketLiquidityDualByXyt(charlie, amountXytRef.div(3));
      await addMarketLiquidityDualByXyt(charlie, amountXytRef.div(3));

      await advanceTime(provider, consts.ONE_MONTH);
      await addMarketLiquidityDualByXyt(bob, amountXytRef.div(2));
      await addMarketLiquidityDualByXyt(bob, amountXytRef.div(5));

      await advanceTime(provider, consts.ONE_MONTH.mul(24));

      for (let user of [alice, bob, charlie, dave]) {
        if ((await getLPBalance(user)).gt(0)) {
          await removeMarketLiquidityDual(user, await getLPBalance(user));
        }
        if ((await ot.balanceOf(user.address)).gt(0)) {
          await router
            .connect(user)
            .redeemAfterExpiry(
              testEnv.FORGE_ID,
              tokenUSDT.address,
              testEnv.T0.add(consts.SIX_MONTH)
            );
        }
      }

      let expectedResult = await aUSDT.balanceOf(dave.address);
      for (let user of [alice, bob, charlie]) {
        approxBigNumber(
          await aUSDT.balanceOf(user.address),
          expectedResult,
          testEnv.TEST_DELTA
        );
      }
    });
  });
}
