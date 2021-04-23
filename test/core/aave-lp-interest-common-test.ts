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
    const amountXytRef = BN.from(10).pow(10);
    let testEnv: TestEnv = {} as TestEnv;

    async function buildCommonTestEnv() {
      fixture = await loadFixture(marketFixture);
      router = fixture.core.router;
      testToken = fixture.testToken;
      tokenUSDT = tokens.USDT;
      aaveForge = fixture.aForge.aaveForge;
      aaveV2Forge = fixture.a2Forge.aaveV2Forge;
    }

    async function buildTestEnvV1() {
      ot = fixture.aForge.aOwnershipToken;
      xyt = fixture.aForge.aFutureYieldToken;
      stdMarket = fixture.aMarket;
      aUSDT = await getAContract(alice, aaveForge, tokens.USDT);
      testEnv.MARKET_FACTORY_ID = consts.MARKET_FACTORY_AAVE;
      testEnv.T0 = consts.T0;
      testEnv.FORGE_ID = consts.FORGE_AAVE;
      testEnv.TEST_DELTA = BN.from(10000);
    }

    async function buildTestEnvV2() {
      ot = fixture.a2Forge.a2OwnershipToken;
      xyt = fixture.a2Forge.a2FutureYieldToken;
      stdMarket = fixture.a2Market;
      aUSDT = await getAContract(alice, aaveV2Forge, tokens.USDT);
      testEnv.MARKET_FACTORY_ID = consts.MARKET_FACTORY_AAVE_V2;
      testEnv.T0 = consts.T0_A2;
      testEnv.FORGE_ID = consts.FORGE_AAVE_V2;
      testEnv.TEST_DELTA = BN.from(30000);
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
      for (let user of [alice, bob, charlie, dave]) {
        await mintOtAndXytUSDT(user, amountXytRef.div(10 ** 6));
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
          consts.MAX_ALLOWANCE,
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
          consts.MAX_ALLOWANCE,
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
          consts.MAX_ALLOWANCE,
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

      for (let user of [alice, bob, charlie, dave]) {
        await router
          .connect(user)
          .claimLpInterests([stdMarket.address], consts.HIGH_GAS_OVERRIDE);
        await router
          .connect(user)
          .redeemDueInterests(
            testEnv.FORGE_ID,
            tokenUSDT.address,
            testEnv.T0.add(consts.SIX_MONTH),
            false,
            consts.HIGH_GAS_OVERRIDE
          );
      }

      // for (let user of [alice, bob, charlie, dave]) {
      //   console.log((await aUSDT.balanceOf(user.address)).toString());
      // }
      const aaveV1ExpectedResult: number[] = [
        1309016354,
        871918760,
        928448406,
        1080957012,
      ];
      const aaveV2ExpectedResult: number[] = [
        2519453551,
        1694659957,
        1799740815,
        2085691898,
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

      for (let user of [alice, bob, charlie, dave]) {
        await router
          .connect(user)
          .claimLpInterests([stdMarket.address], consts.HIGH_GAS_OVERRIDE);
        await router
          .connect(user)
          .redeemDueInterests(
            testEnv.FORGE_ID,
            tokenUSDT.address,
            testEnv.T0.add(consts.SIX_MONTH),
            false,
            consts.HIGH_GAS_OVERRIDE
          );
      }

      // for (let user of [alice, bob, charlie, dave]) {
      //   console.log((await aUSDT.balanceOf(user.address)).toString());
      // }

      const aaveV1ExpectedResult: number[] = [
        1952642702,
        743422701,
        722918925,
        771345798,
      ];
      const aaveV2ExpectedResult: number[] = [
        3734456132,
        1452822861,
        1413153412,
        1499113849,
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

    //   for (let user of [alice, bob, charlie, dave]) {
    //     await router
    //       .connect(user)
    //       .claimLpInterests([stdMarket.address], consts.HIGH_GAS_OVERRIDE);
    //     await router
    //       .connect(user)
    //       .redeemDueInterests(
    //         testEnv.FORGE_ID,
    //         tokenUSDT.address,
    //         testEnv.T0.add(consts.SIX_MONTH),
    //         false,
    //         consts.HIGH_GAS_OVERRIDE
    //       );
    //   }

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

      for (let user of [alice, bob, charlie, dave]) {
        await router
          .connect(user)
          .claimLpInterests([stdMarket.address], consts.HIGH_GAS_OVERRIDE);
        await router
          .connect(user)
          .redeemDueInterests(
            testEnv.FORGE_ID,
            tokenUSDT.address,
            testEnv.T0.add(consts.SIX_MONTH),
            false,
            consts.HIGH_GAS_OVERRIDE
          );
      }

      // for (let user of [alice, bob, charlie, dave]) {
      //   console.log((await aUSDT.balanceOf(user.address)).toString());
      // }

      const aaveV1ExpectedResult: number[] = [
        1883631743,
        743350097,
        915310884,
        879998610,
      ];
      const aaveV2ExpectedResult: number[] = [
        3596111612,
        1457043034,
        1775911778,
        1703759955,
      ];
      if (isAaveV1) {
        await checkAUSDTBalance(aaveV1ExpectedResult);
      } else {
        await checkAUSDTBalance(aaveV2ExpectedResult);
      }
    });
  });
}
