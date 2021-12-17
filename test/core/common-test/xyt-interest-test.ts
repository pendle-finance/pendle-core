import { MiscConsts } from '@pendle/constants';
import { expect } from 'chai';
import { loadFixture } from 'ethereum-waffle';
import { BigNumber as BN, Wallet } from 'ethers';
import { Mode, parseTestEnvRouterFixture, routerFixture, TestEnv, wallets } from '../../fixtures';
import {
  advanceTime,
  approveAll,
  approxBigNumber,
  approxByPercent,
  emptyToken,
  evm_revert,
  evm_snapshot,
  getSushiLpValue,
  mint,
  mintAaveV2Token,
  mintCompoundToken,
  mintKyberDMMFixed,
  mintQiToken,
  mintSushiswapLpFixed,
  mintTraderJoeLpFixed,
  mintXJoe,
  otBalance,
  randomBN,
  randomNumber,
  redeemAfterExpiry,
  redeemDueInterests,
  redeemUnderlying,
  setTimeNextBlock,
  teConsts,
  tokenizeYield,
  yTokenBalance,
} from '../../helpers';

export async function runTest(mode: Mode) {
  describe('', async () => {
    const [alice, bob, charlie, dave, eve] = wallets;

    let snapshotId: string;
    let globalSnapshotId: string;
    let env: TestEnv;
    let amountToMint: BN;

    async function buildTestEnv() {
      env = await loadFixture(routerFixture);
      await parseTestEnvRouterFixture(env, mode);
      amountToMint = BN.from(10 ** 9);
      if (mode == Mode.KYBER_DMM) {
        amountToMint = BN.from(10 ** 7);
      } else if (mode == Mode.WONDERLAND) {
        amountToMint = env.INITIAL_YIELD_TOKEN_AMOUNT.div(10);
      }
    }

    before(async () => {
      await buildTestEnv();
      globalSnapshotId = await evm_snapshot();
      await approveAll([env.yToken], [env.router]);
      for (var person of [bob, charlie, dave, eve]) {
        if (mode == Mode.AAVE_V2)
          await mintAaveV2Token(env, env.underlyingAsset, person, env.INITIAL_YIELD_TOKEN_AMOUNT);
        else if (mode == Mode.COMPOUND || mode == Mode.COMPOUND_V2)
          await mintCompoundToken(env, env.underlyingAsset, person, env.INITIAL_YIELD_TOKEN_AMOUNT);
        else if (mode == Mode.SUSHISWAP_COMPLEX || mode == Mode.SUSHISWAP_SIMPLE)
          await mintSushiswapLpFixed(env, person);
        else if (mode == Mode.BENQI)
          await mintQiToken(env, env.underlyingAsset, person, env.INITIAL_YIELD_TOKEN_AMOUNT);
        else if (mode == Mode.TRADER_JOE) await mintTraderJoeLpFixed(env, person);
        else if (mode == Mode.KYBER_DMM) await mintKyberDMMFixed(env, person);
        else if (mode == Mode.XJOE) await mintXJoe(env, env.xJoe, person, env.INITIAL_YIELD_TOKEN_AMOUNT);
        else if (mode == Mode.WONDERLAND) {
          await mint(env, env.ptokens.wMEMO!, person, BN.from(0));
        }
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

    enum Action {
      TokenizeYield,
      RedeemDueInterests,
      RedeemUnderlying,
    }

    async function addFundsToForge() {
      if (randomNumber(2) == 0) {
        if (mode == Mode.WONDERLAND) {
          await tokenizeYield(
            env,
            eve,
            env.INITIAL_YIELD_TOKEN_AMOUNT.div(100),
            await env.forge.yieldTokenHolders(env.underlyingAsset.address, env.EXPIRY)
          );
        } else {
          await tokenizeYield(
            env,
            eve,
            BN.from(10 ** 7),
            await env.forge.yieldTokenHolders(env.underlyingAsset.address, env.EXPIRY)
          );
        }
      } else {
        if (mode == Mode.WONDERLAND) {
          await tokenizeYield(env, eve, BN.from(env.INITIAL_YIELD_TOKEN_AMOUNT.div(100)));
        } else {
          await tokenizeYield(env, eve, BN.from(10 ** 7));
        }
        await env.xyt
          .connect(eve)
          .transfer(
            await env.forge.yieldTokenHolders(env.underlyingAsset.address, env.EXPIRY),
            await env.xyt.balanceOf(eve.address)
          );
      }
    }

    async function addFakeIncome() {
      await env.addGenericForgeFakeIncome(env);
    }

    it('users should receive the same amount after full withdrawal despite actions they have performed', async () => {
      const totalTime = env.pconsts.misc.SIX_MONTH;
      const numTurns = 20;

      for (let i = 1; i <= numTurns; i++) {
        await addFundsToForge();
        const testTime = env.T0.add(totalTime.div(numTurns).mul(i)).sub(100);
        await setTimeNextBlock(testTime);
        let userID = randomBN(4).toNumber();
        let actionType: Action = randomNumber(3);
        let amount: BN;

        if ((await otBalance(env, wallets[userID])).eq(0)) {
          actionType = Action.TokenizeYield;
        }

        switch (actionType) {
          case Action.TokenizeYield:
            amount = randomBN(await yTokenBalance(env, wallets[userID]));
            await tokenizeYield(env, wallets[userID], amount);
            break;
          case Action.RedeemDueInterests:
            await redeemDueInterests(env, wallets[userID]);
            break;
          case Action.RedeemUnderlying:
            amount = randomBN(await otBalance(env, wallets[userID]));
            await redeemUnderlying(env, wallets[userID], amount);
            break;
          default:
            break;
        }
        await addFakeIncome();
      }

      await setTimeNextBlock(env.EXPIRY.add(MiscConsts.ONE_DAY));
      for (var user of [alice, bob, charlie, dave]) {
        await redeemAfterExpiry(env, user);
      }
      const expectedBalance = await yTokenBalance(env, dave);
      if (mode == Mode.AAVE_V2) {
        for (var person of [alice, bob, charlie]) approxByPercent(await yTokenBalance(env, person), expectedBalance);
      } else if (mode == Mode.COMPOUND || mode == Mode.COMPOUND_V2 || mode == Mode.BENQI || mode == Mode.WONDERLAND) {
        for (var person of [alice, bob, charlie]) approxByPercent(await yTokenBalance(env, person), expectedBalance);
      } else {
        for (var person of [alice, bob, charlie])
          approxBigNumber(await yTokenBalance(env, person), expectedBalance, 10);
      }
    });

    it('users having tokenized yield should receive the same amount of interest as receive directly from platform', async () => {
      if (mode != Mode.SUSHISWAP_COMPLEX && mode != Mode.SUSHISWAP_SIMPLE && mode != Mode.TRADER_JOE) return;

      const totalTime = env.pconsts.misc.SIX_MONTH;
      const numTurns = 20;

      let amountDave: BN = await yTokenBalance(env, dave);
      let preValue: BN = await getSushiLpValue(env, amountDave);

      await tokenizeYield(env, dave, amountDave);
      for (let i = 1; i <= numTurns; i++) {
        await addFundsToForge();
        const testTime = env.T0.add(totalTime.div(numTurns).mul(i)).sub(100);
        await setTimeNextBlock(testTime);
        let userID = randomBN(3).toNumber();
        let actionType: Action = randomNumber(3);
        let amount: BN;

        if ((await otBalance(env, wallets[userID])).eq(0)) {
          actionType = Action.TokenizeYield;
        }

        switch (actionType) {
          case Action.TokenizeYield:
            amount = randomBN(await yTokenBalance(env, wallets[userID]));
            await tokenizeYield(env, wallets[userID], amount);
            break;
          case Action.RedeemDueInterests:
            await redeemDueInterests(env, wallets[userID]);
            break;
          case Action.RedeemUnderlying:
            amount = randomBN(await otBalance(env, wallets[userID]));
            await redeemUnderlying(env, wallets[userID], amount);
            break;
          default:
            break;
        }
        await addFakeIncome();
      }
      await setTimeNextBlock(env.EXPIRY.sub(10));
      await tokenizeYield(env, alice, BN.from(1));

      await setTimeNextBlock(env.EXPIRY.add(100));
      for (var user of [alice, bob, charlie, dave]) {
        await redeemDueInterests(env, user);
      }
      let postValue: BN = await getSushiLpValue(env, amountDave);
      let gainDave: BN = await getSushiLpValue(env, await yTokenBalance(env, dave));
      await approxByPercent(gainDave, postValue.sub(preValue));
    });

    it('xyt interests should be the same regardless actions users took', async () => {
      let amountToTokenize: BN = amountToMint;

      let period = env.EXPIRY.sub(env.T0).div(10);

      async function transferXyt(from: Wallet, to: Wallet, amount: BN) {
        await env.xyt.connect(from).transfer(to.address, amount, teConsts.HG);
      }

      async function transferYieldToken(from: Wallet, to: Wallet, amount: BN) {
        await env.yToken.connect(from).transfer(to.address, amount, teConsts.HG);
      }

      for (let person of [alice, bob, charlie, dave]) {
        await emptyToken(env, env.yToken, person);
      }
      await env.yToken.connect(eve).transfer(alice.address, amountToTokenize.mul(2), teConsts.HG);
      let amountToMove: BN = (await env.xyt.balanceOf(alice.address)).div(10);

      await addFakeIncome();

      await tokenizeYield(env, alice, amountToTokenize, alice.address);
      await tokenizeYield(env, alice, amountToTokenize.div(2), bob.address);
      await tokenizeYield(env, alice, amountToTokenize.div(4), charlie.address);
      await tokenizeYield(env, alice, amountToTokenize.div(4), dave.address);

      await setTimeNextBlock(env.T0.add(period.mul(1)));
      await transferXyt(bob, dave, amountToMove);
      await transferXyt(bob, charlie, amountToMove);

      await setTimeNextBlock(env.T0.add(period.mul(2)));
      await transferXyt(bob, dave, amountToMove);
      await addFakeIncome();
      await transferXyt(bob, charlie, amountToMove);

      await setTimeNextBlock(env.T0.add(period.mul(3)));
      await redeemDueInterests(env, alice);
      await addFakeIncome();
      await redeemDueInterests(env, charlie);
      await addFakeIncome();
      await redeemDueInterests(env, dave);

      await setTimeNextBlock(env.T0.add(period.mul(4)));
      await transferXyt(dave, bob, amountToMove);
      await addFakeIncome();
      await transferXyt(charlie, bob, amountToMove.mul(2));
      await redeemDueInterests(env, alice);

      await setTimeNextBlock(env.T0.add(period.mul(5)));
      await redeemDueInterests(env, alice);
      await addFakeIncome();
      await redeemDueInterests(env, charlie);
      await transferXyt(dave, bob, amountToMove);
      await addFakeIncome();
      await transferXyt(charlie, bob, amountToMove);

      await setTimeNextBlock(env.T0.add(period.mul(6)));
      await transferXyt(bob, dave, amountToMove);
      await addFakeIncome();
      await transferXyt(bob, charlie, amountToMove);

      await setTimeNextBlock(env.T0.add(period.mul(8)));
      await addFakeIncome();
      await transferXyt(dave, charlie, amountToMove);

      await setTimeNextBlock(env.T0.add(period.mul(10).add(10)));

      for (let person of [alice, bob, charlie, dave]) {
        await redeemAfterExpiry(env, person);
      }

      await setTimeNextBlock(env.T0.add(period.mul(20).add(10)));
      await transferYieldToken(bob, charlie, BN.from(1));

      let alice_yieldToken = await env.yToken.balanceOf(alice.address);
      let bcd_yieldToken = (await env.yToken.balanceOf(bob.address))
        .add(await env.yToken.balanceOf(charlie.address))
        .add(await yTokenBalance(env, dave));

      approxByPercent(alice_yieldToken, bcd_yieldToken, 10 ** 5);
    });

    it('Should get 0 interests for the 2th or later time using redeemAfterExpiry', async () => {
      const amount = amountToMint;
      const period = env.EXPIRY.sub(env.T0);

      async function tryRedeemDueInterests(expected?: BN) {
        await redeemDueInterests(env, bob);
        let interestClaimed = await env.router
          .connect(alice)
          .callStatic.redeemDueInterests(
            env.FORGE_ID,
            env.underlyingAsset.address,
            env.EXPIRY,
            alice.address,
            teConsts.HG
          );
        if (expected != null) approxBigNumber(interestClaimed, expected, 0, true);
        else {
          console.log('interest claimed: ', interestClaimed.toNumber());
          expect(interestClaimed.toNumber()).to.be.greaterThan(1);
        }
        await redeemDueInterests(env, alice);
      }

      await addFakeIncome();
      await tokenizeYield(env, alice, amount, alice.address);
      await addFakeIncome();
      await tokenizeYield(env, alice, amount, bob.address);

      await setTimeNextBlock(env.T0.add(period.div(2)));
      await addFakeIncome();
      await tryRedeemDueInterests();

      await setTimeNextBlock(env.T0.add(period.sub(MiscConsts.ONE_HOUR)));
      await addFakeIncome();
      await redeemDueInterests(env, bob);

      await setTimeNextBlock(env.T0.add(period).add(10));
      await addFakeIncome();
      await tryRedeemDueInterests();

      for (let i = 0; i < 3; ++i) {
        await tryRedeemDueInterests(BN.from(0));
      }
    });

    it('Transfering xyt after expiry', async () => {
      const amount = amountToMint;

      await emptyToken(env, env.yToken, bob);
      await emptyToken(env, env.yToken, charlie);
      await emptyToken(env, env.yToken, dave);

      await addFakeIncome();
      await tokenizeYield(env, alice, amount, alice.address);
      await tokenizeYield(env, alice, amount, bob.address);
      await tokenizeYield(env, alice, amount, charlie.address);
      await tokenizeYield(env, alice, amount.mul(2), dave.address);

      const transferAmount = (await env.xyt.balanceOf(bob.address)).div(10);

      /// before expiry
      await advanceTime(MiscConsts.THREE_MONTH);

      await addFakeIncome();
      await env.xyt.connect(bob).transfer(charlie.address, transferAmount, teConsts.HG);

      /// Fake activity
      await advanceTime(MiscConsts.THREE_MONTH.sub(60));
      await redeemDueInterests(env, alice);

      /// after expiry
      await advanceTime(env.pconsts.misc.SIX_MONTH);
      await env.xyt.connect(bob).transfer(charlie.address, transferAmount, teConsts.HG);

      await env.xyt.connect(charlie).transfer(bob.address, transferAmount.mul(5), teConsts.HG);

      await addFakeIncome();
      await redeemAfterExpiry(env, bob);
      await addFakeIncome();
      await redeemAfterExpiry(env, charlie);
      await redeemAfterExpiry(env, dave);

      const bobBalance: BN = await env.yToken.balanceOf(bob.address);
      const charlieBalance: BN = await env.yToken.balanceOf(charlie.address);
      const daveBalance: BN = await yTokenBalance(env, dave);

      approxByPercent(bobBalance.add(charlieBalance), daveBalance, 10 ** 5);
    });

    it('[Only SushiComplex] users should still be able to redeem normally even if the exchangeRate decreases', async () => {
      if (mode != Mode.SUSHISWAP_COMPLEX) return;
      const totalTime = env.pconsts.misc.SIX_MONTH;
      const numTurns = 10;

      let amountDave: BN = await yTokenBalance(env, dave);

      for (let i = 1; i <= numTurns; i++) {
        const testTime = env.T0.add(totalTime.div(numTurns).mul(i)).sub(100);
        await setTimeNextBlock(testTime);

        await addFakeIncome();
        await tokenizeYield(env, dave, amountDave.div(numTurns * 2));

        await mintSushiswapLpFixed(env, eve);
        await redeemUnderlying(env, dave, await env.xyt.balanceOf(dave.address));
      }
      approxBigNumber(await env.xyt.balanceOf(dave.address), 0, 0);
    });
  });
}
