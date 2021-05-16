import { BigNumber as BN, Wallet } from 'ethers';
import {
  addMarketLiquidityDualXyt,
  addMarketLiquiditySingle,
  advanceTime,
  approxBigNumber,
  bootstrapMarket,
  consts,
  emptyToken,
  evm_revert,
  evm_snapshot,
  mintOtAndXyt,
  redeemDueInterests,
  redeemLpInterests,
  removeMarketLiquidityDual,
  removeMarketLiquiditySingle,
  swapExactInXytToToken,
  Token,
  tokens,
} from '../../helpers';
import { marketFixture, MarketFixture, Mode, parseTestEnvMarketFixture, TestEnv } from '../fixtures';

import { waffle } from 'hardhat';
const { loadFixture, provider } = waffle;

export function runTest(isAaveV1: boolean) {
  describe('', async () => {
    const wallets = provider.getWallets();
    const [alice, bob, charlie, dave, eve] = wallets;

    let snapshotId: string;
    let globalSnapshotId: string;
    let USDT: Token;
    let amountXytRef = BN.from(10).pow(10);
    let env: TestEnv = {} as TestEnv;

    async function buildTestEnv() {
      let fixture: MarketFixture = await loadFixture(marketFixture);
      if (isAaveV1) await parseTestEnvMarketFixture(alice, Mode.AAVE_V1, env, fixture);
      else await parseTestEnvMarketFixture(alice, Mode.AAVE_V2, env, fixture);
      USDT = tokens.USDT;
      env.TEST_DELTA = BN.from(60000);
    }

    async function redeemAll() {
      for (let user of [alice, bob, charlie, dave]) {
        await redeemDueInterests(env, user);
        await redeemLpInterests(env, user);
      }
    }

    before(async () => {
      await buildTestEnv();
      globalSnapshotId = await evm_snapshot();
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
        await emptyToken(env.yUSDT, user);
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

    async function mintOtAndXytUSDT(user: Wallet, amount: BN) {
      await mintOtAndXyt(USDT, user, amount, env.routerFixture);
    }

    async function getLPBalance(user: Wallet) {
      return await env.market.balanceOf(user.address);
    }

    async function checkAUSDTBalance(expectedResult: number[]) {
      for (let id = 0; id < 4; id++) {
        approxBigNumber(await env.yUSDT.balanceOf(wallets[id].address), BN.from(expectedResult[id]), env.TEST_DELTA);
      }
    }

    it('Users should still receive correct amount of LP interest if markets have many addMarketLiquidityDual & swapExactInXytToToken actions', async () => {
      await mintOtAndXytUSDT(eve, BN.from(10).pow(5));

      await bootstrapMarket(env, alice, BN.from(10).pow(10));

      await advanceTime(consts.FIFTEEN_DAY);
      await addMarketLiquidityDualXyt(env, bob, amountXytRef.div(10));
      await swapExactInXytToToken(env, eve, BN.from(10).pow(9));

      await advanceTime(consts.FIFTEEN_DAY);
      await addMarketLiquidityDualXyt(env, charlie, amountXytRef.div(5));
      await swapExactInXytToToken(env, eve, BN.from(10).pow(9));

      await advanceTime(consts.FIFTEEN_DAY);
      await addMarketLiquidityDualXyt(env, dave, amountXytRef.div(2));

      await advanceTime(consts.ONE_MONTH);
      await addMarketLiquidityDualXyt(env, dave, amountXytRef.div(3));
      await swapExactInXytToToken(env, eve, BN.from(10).pow(10));
      await addMarketLiquidityDualXyt(env, bob, amountXytRef.div(6));

      await advanceTime(consts.ONE_MONTH);
      await addMarketLiquidityDualXyt(env, charlie, amountXytRef.div(3));
      await swapExactInXytToToken(env, eve, BN.from(10).pow(10));
      await addMarketLiquidityDualXyt(env, charlie, amountXytRef.div(3));

      await advanceTime(consts.ONE_MONTH);
      await swapExactInXytToToken(env, eve, BN.from(10).pow(10));
      await addMarketLiquidityDualXyt(env, bob, amountXytRef.div(2));

      await advanceTime(consts.ONE_MONTH);
      await swapExactInXytToToken(env, eve, BN.from(10).pow(10));
      await addMarketLiquidityDualXyt(env, bob, amountXytRef.div(5));

      await redeemAll();

      // for (let user of [alice, bob, charlie, dave]) {
      //   console.log((await env.yUSDT.balanceOf(user.address)).toString());
      // }
      const aaveV1ExpectedResult: number[] = [374114313, 247254533, 263856546, 308333911];
      const aaveV2ExpectedResult: number[] = [4036865024, 2747367514, 2908674421, 3352118785];
      if (isAaveV1) {
        await checkAUSDTBalance(aaveV1ExpectedResult);
      } else {
        await checkAUSDTBalance(aaveV2ExpectedResult);
      }
    });

    it('Users should still receive correct amount of LP interest if markets have many addMarketLiquiditySingle & swapExactInXytToToken actions', async () => {
      await mintOtAndXytUSDT(eve, BN.from(10).pow(5));

      await bootstrapMarket(env, alice, BN.from(10).pow(10));

      await advanceTime(consts.FIFTEEN_DAY);
      await addMarketLiquiditySingle(env, bob, amountXytRef.div(10), true);
      await swapExactInXytToToken(env, eve, BN.from(10).pow(9));

      await advanceTime(consts.FIFTEEN_DAY);
      await addMarketLiquiditySingle(env, charlie, amountXytRef.div(5), true);
      await swapExactInXytToToken(env, eve, BN.from(10).pow(9));

      await advanceTime(consts.FIFTEEN_DAY);
      await addMarketLiquiditySingle(env, dave, amountXytRef.div(2), true);

      await advanceTime(consts.ONE_MONTH);
      await addMarketLiquiditySingle(env, dave, amountXytRef.div(3), true);
      await swapExactInXytToToken(env, eve, BN.from(10).pow(10));
      await addMarketLiquiditySingle(env, bob, amountXytRef.div(6), true);

      await advanceTime(consts.ONE_MONTH);
      await addMarketLiquiditySingle(env, charlie, amountXytRef.div(3), true);
      await swapExactInXytToToken(env, eve, BN.from(10).pow(10));
      await addMarketLiquiditySingle(env, charlie, amountXytRef.div(3), true);

      await advanceTime(consts.ONE_MONTH);
      await swapExactInXytToToken(env, eve, BN.from(10).pow(10));
      await addMarketLiquiditySingle(env, bob, amountXytRef.div(2), true);

      await advanceTime(consts.ONE_MONTH);
      await swapExactInXytToToken(env, eve, BN.from(10).pow(10));
      await addMarketLiquiditySingle(env, bob, amountXytRef.div(5), true);

      await redeemAll();

      // for (let user of [alice, bob, charlie, dave]) {
      //   console.log((await env.yUSDT.balanceOf(user.address)).toString());
      // }

      const aaveV1ExpectedResult: number[] = [560854508, 209872642, 204051257, 218780675];
      const aaveV2ExpectedResult: number[] = [5937256443, 2370247428, 2306560648, 2430958736];
      if (isAaveV1) {
        await checkAUSDTBalance(aaveV1ExpectedResult);
      } else {
        await checkAUSDTBalance(aaveV2ExpectedResult);
      }
    });

    // xit("test 3", async () => {
    //   await mintOtAndXytUSDT(eve, BN.from(10).pow(5));

    //   await bootstrapMarket(env,alice,BN.from(10).pow(10));

    //   await advanceTime(consts.FIFTEEN_DAY);
    //   await addMarketLiquidityDualXyt(env,bob, amountXytRef.div(10));
    //   await addFakeXyt(eve, BN.from(10).pow(9));

    //   await advanceTime(consts.FIFTEEN_DAY);
    //   await addMarketLiquidityDualXyt(env,charlie, amountXytRef.div(5));
    //   await addFakeXyt(eve, BN.from(10).pow(9));

    //   await advanceTime(consts.FIFTEEN_DAY);
    //   await addMarketLiquidityDualXyt(env,dave, amountXytRef.div(2));

    //   await advanceTime(consts.ONE_MONTH);
    //   await addMarketLiquidityDualXyt(env,dave, amountXytRef.div(3));
    //   await addFakeXyt(eve, BN.from(10).pow(10));
    //   await addMarketLiquidityDualXyt(env,bob, amountXytRef.div(6));

    //   await advanceTime(consts.ONE_MONTH);
    //   await addMarketLiquidityDualXyt(env,charlie, amountXytRef.div(3));
    //   await addFakeXyt(eve, BN.from(10).pow(10));
    //   await addMarketLiquidityDualXyt(env,charlie, amountXytRef.div(3));

    //   await advanceTime(consts.ONE_MONTH);
    //   await addFakeXyt(eve, BN.from(10).pow(10));
    //   await addMarketLiquidityDualXyt(env,bob, amountXytRef.div(2));

    //   await advanceTime(consts.ONE_MONTH);
    //   await addFakeXyt(eve, BN.from(10).pow(10));
    //   await addMarketLiquidityDualXyt(env,bob, amountXytRef.div(5));

    //   await redeemAll();

    // for (let user of [alice, bob, charlie, dave]) {
    //   console.log((await env.yUSDT.balanceOf(user.address)).toString());
    // }

    //   console.log(1);
    //   approxBigNumber(
    //     await env.yUSDT.balanceOf(alice.address),
    //     BN.from(803722622),
    //     acceptedDelta
    //   );
    //   console.log(1);
    //   approxBigNumber(
    //     await env.yUSDT.balanceOf(bob.address),
    //     BN.from(803722622),
    //     acceptedDelta
    //   );
    //   console.log(1);
    //   approxBigNumber(
    //     await env.yUSDT.balanceOf(charlie.address),
    //     BN.from(803722622),
    //     acceptedDelta
    //   );
    //   console.log(1);
    //   approxBigNumber(
    //     await env.yUSDT.balanceOf(dave.address),
    //     BN.from(803722622),
    //     acceptedDelta
    //   );
    // });

    it('Users should still receive correct amount of LP interest if markets have many addMarketLiquiditySingle, removeMarketLiquidityDual, removeMarketLiquiditySingle, swapExactInXytToToken actions', async () => {
      await mintOtAndXytUSDT(eve, BN.from(10).pow(5));

      await bootstrapMarket(env, alice, BN.from(10).pow(10));
      await advanceTime(consts.ONE_DAY.mul(5));
      await removeMarketLiquidityDual(env, alice, (await getLPBalance(alice)).div(2));

      await advanceTime(consts.FIFTEEN_DAY);
      await addMarketLiquiditySingle(env, bob, amountXytRef.div(10), true);
      await swapExactInXytToToken(env, eve, BN.from(10).pow(9));

      await advanceTime(consts.FIFTEEN_DAY);
      await removeMarketLiquiditySingle(env, bob, await getLPBalance(bob), true);
      await addMarketLiquidityDualXyt(env, charlie, amountXytRef.div(5));
      await swapExactInXytToToken(env, eve, BN.from(10).pow(9));
      await addMarketLiquidityDualXyt(env, alice, await env.xyt.balanceOf(alice.address));

      await advanceTime(consts.FIFTEEN_DAY);
      await addMarketLiquiditySingle(env, dave, amountXytRef.div(2), true);
      await removeMarketLiquiditySingle(env, charlie, (await getLPBalance(charlie)).div(3), false);

      await advanceTime(consts.ONE_MONTH);
      await addMarketLiquiditySingle(env, dave, amountXytRef.div(3), true);
      await swapExactInXytToToken(env, eve, BN.from(10).pow(10));
      await addMarketLiquiditySingle(env, bob, amountXytRef.div(6), true);

      await advanceTime(consts.ONE_MONTH);
      await removeMarketLiquiditySingle(env, dave, (await getLPBalance(dave)).div(3), true);
      await addMarketLiquiditySingle(env, charlie, amountXytRef.div(3), true);
      await swapExactInXytToToken(env, eve, BN.from(10).pow(10));
      await addMarketLiquidityDualXyt(env, charlie, amountXytRef.div(3));

      await advanceTime(consts.ONE_MONTH);
      await swapExactInXytToToken(env, eve, BN.from(10).pow(10));
      await addMarketLiquiditySingle(env, bob, amountXytRef.div(2), true);
      await swapExactInXytToToken(env, eve, BN.from(10).pow(10));
      await addMarketLiquiditySingle(env, bob, amountXytRef.div(5), true);

      await advanceTime(consts.ONE_MONTH);

      await redeemAll();

      // for (let user of [alice, bob, charlie, dave]) {
      //   console.log((await env.yUSDT.balanceOf(user.address)).toString());
      // }

      const aaveV1ExpectedResult: number[] = [541848481, 209321719, 259943321, 250376127];
      const aaveV2ExpectedResult: number[] = [5706237164, 2385168611, 2873558523, 2750487583];
      if (isAaveV1) {
        await checkAUSDTBalance(aaveV1ExpectedResult);
      } else {
        await checkAUSDTBalance(aaveV2ExpectedResult);
      }
    });

    it('Users should still receive correct amount of LP interest if markets have many addMarketLiquidityDual, removeMarketLiquidityDual actions and they only redeemLpInterests a long time after the XYT has expired', async () => {
      await bootstrapMarket(env, alice, BN.from(10).pow(10));

      await advanceTime(consts.ONE_DAY.mul(5));
      await removeMarketLiquidityDual(env, alice, (await getLPBalance(alice)).div(2));

      await advanceTime(consts.FIFTEEN_DAY);
      await addMarketLiquidityDualXyt(env, bob, amountXytRef.div(10));

      await advanceTime(consts.FIFTEEN_DAY);
      await addMarketLiquidityDualXyt(env, charlie, amountXytRef.div(5));

      await addMarketLiquidityDualXyt(env, alice, (await env.xyt.balanceOf(alice.address)).div(2));

      await advanceTime(consts.FIFTEEN_DAY);

      await advanceTime(consts.ONE_MONTH);
      await addMarketLiquidityDualXyt(env, bob, amountXytRef.div(6));

      await advanceTime(consts.ONE_MONTH);
      await addMarketLiquidityDualXyt(env, charlie, amountXytRef.div(3));
      await addMarketLiquidityDualXyt(env, charlie, amountXytRef.div(3));

      await advanceTime(consts.ONE_MONTH);
      await addMarketLiquidityDualXyt(env, bob, amountXytRef.div(2));
      await addMarketLiquidityDualXyt(env, bob, amountXytRef.div(5));

      await advanceTime(consts.ONE_MONTH.mul(24));

      await redeemAll();
      for (let user of [alice, bob, charlie, dave]) {
        if ((await getLPBalance(user)).gt(0)) {
          await removeMarketLiquidityDual(env, user, await getLPBalance(user));
        }
        if ((await env.ot.balanceOf(user.address)).gt(0)) {
          await env.router.connect(user).redeemAfterExpiry(env.FORGE_ID, USDT.address, env.T0.add(consts.SIX_MONTH));
        }
      }

      let expectedResult = await env.yUSDT.balanceOf(dave.address);
      for (let user of [alice, bob, charlie]) {
        approxBigNumber(await env.yUSDT.balanceOf(user.address), expectedResult, env.TEST_DELTA);
      }
    });
  });
}
