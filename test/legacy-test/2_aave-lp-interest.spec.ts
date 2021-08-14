import { BigNumber as BN, Wallet } from 'ethers';
import { checkDisabled, marketFixture, MarketFixture, Mode, parseTestEnvMarketFixture, TestEnv } from '../fixtures';
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
  mintXytAave,
  redeemDueInterests,
  redeemLpInterests,
  removeMarketLiquidityDual,
  removeMarketLiquiditySingle,
  swapExactInXytToToken,
  Token,
  tokens,
} from '../helpers';

const { waffle } = require('hardhat');
const { loadFixture, provider } = waffle;

export async function runTest(mode: Mode) {
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
      await parseTestEnvMarketFixture(alice, Mode.AAVE_V2, env, fixture);
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

      await mintXytUSDT(alice, amountXytRef.div(10 ** 6).mul(4));
      amountXytRef = (await env.xyt.balanceOf(alice.address)).div(4);
      for (let user of [bob, charlie, dave]) {
        await env.ot.transfer(user.address, amountXytRef);
        await env.xyt.transfer(user.address, amountXytRef);
      }

      for (let user of [alice, bob, charlie, dave, eve]) {
        await emptyToken(env.yToken, user);
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

    async function mintXytUSDT(user: Wallet, amount: BN) {
      await mintXytAave(USDT, user, amount, env.routerFixture, env.T0.add(consts.SIX_MONTH));
    }

    async function getLPBalance(user: Wallet) {
      return await env.market.balanceOf(user.address);
    }

    async function checkAUSDTBalance(expectedResult: number[]) {
      for (let id = 0; id < 4; id++) {
        approxBigNumber(await env.yToken.balanceOf(wallets[id].address), BN.from(expectedResult[id]), env.TEST_DELTA);
      }
    }

    it('Users should still receive correct amount of LP interest if markets have many addMarketLiquidityDual & swapExactInXytToToken actions', async () => {
      await mintXytUSDT(eve, BN.from(10).pow(5));

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
      //   console.log((await env.yToken.balanceOf(user.address)).toString());
      // }
      const aaveV2ExpectedResult: number[] = [1153260349, 767185299, 817213684, 952028819];
      await checkAUSDTBalance(aaveV2ExpectedResult);
    });

    it('Users should still receive correct amount of LP interest if markets have many addMarketLiquiditySingle & swapExactInXytToToken actions', async () => {
      await mintXytUSDT(eve, BN.from(10).pow(5));

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
      //   console.log((await env.yToken.balanceOf(user.address)).toString());
      // }

      const aaveV1ExpectedResult: number[] = [560854502, 209872643, 204051274, 218780693];
      const aaveV2ExpectedResult: number[] = [1721729362, 653647650, 635600013, 678709999];
      await checkAUSDTBalance(aaveV2ExpectedResult);
    });

    it('Users should still receive correct amount of LP interest if markets have many addMarketLiquiditySingle, removeMarketLiquidityDual, removeMarketLiquiditySingle, swapExactInXytToToken actions', async () => {
      await mintXytUSDT(eve, BN.from(10).pow(5));

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
      //   console.log((await env.yToken.balanceOf(user.address)).toString());
      // }

      const aaveV1ExpectedResult: number[] = [541848416, 209321674, 259943291, 250376098];
      const aaveV2ExpectedResult: number[] = [1661277257, 653315674, 805555834, 774706193];
      await checkAUSDTBalance(aaveV2ExpectedResult);
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

      let expectedResult = await env.yToken.balanceOf(dave.address);
      for (let user of [alice, bob, charlie]) {
        approxBigNumber(await env.yToken.balanceOf(user.address), expectedResult, env.TEST_DELTA);
      }
    });
  });
}

describe('Aave-lp-interest ', function () {
  if (checkDisabled(Mode.AAVE_V2)) return;
  runTest(Mode.AAVE_V2);
});
