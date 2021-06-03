import { expect } from 'chai';
import { BigNumber as BN, Wallet } from 'ethers';
import {
  amountToWei,
  mintAaveV2Token,
  approxBigNumber,
  consts,
  evm_revert,
  evm_snapshot,
  randomNumber,
  redeemDueInterests,
  redeemUnderlying,
  redeemAfterExpiry,
  setTimeNextBlock,
  tokenizeYield,
  tokens,
  Token,
  transferToken,
  logTokenBalance,
  advanceTime,
  emptyToken,
} from '../helpers';
import { Mode, parseTestEnvRouterFixture, routerFixture, RouterFixture, TestEnv } from './fixtures';
import testData from './fixtures/yieldTokenizeAndRedeem.scenario.json';

import { waffle } from 'hardhat';
const { loadFixture, provider } = waffle;

interface YieldTest {
  type: string;
  user: number;
  amount: number;
  timeDelta: number;
}

describe('aaveV2-xyt-interest', async () => {
  const wallets = provider.getWallets();
  const [alice, bob, charlie, dave, eve] = wallets;

  let snapshotId: string;
  let globalSnapshotId: string;
  let env: TestEnv = {} as TestEnv;

  async function buildTestEnv() {
    let fixture: RouterFixture = await loadFixture(routerFixture);
    await parseTestEnvRouterFixture(alice, Mode.AAVE_V2, env, fixture);
    env.TEST_DELTA = BN.from(6000);
  }

  before(async () => {
    await buildTestEnv();
    globalSnapshotId = await evm_snapshot();
    for (var person of [bob, charlie, dave, eve]) {
      await mintAaveV2Token(tokens.USDT, person, env.INITIAL_YIELD_TOKEN_AMOUNT);
      await env.yToken.connect(person).approve(env.router.address, consts.INF);
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

  async function addFundsToForge() {
    if (randomNumber(2) == 0) {
      await tokenizeYield(env, eve, BN.from(10 ** 7), env.forge.yieldTokenHolders(tokens.USDT.address, env.EXPIRY));
    } else {
      await tokenizeYield(env, eve, BN.from(10 ** 7));
      await env.xyt
        .connect(eve)
        .transfer(env.forge.yieldTokenHolders(tokens.USDT.address, env.EXPIRY), await env.xyt.balanceOf(eve.address));
    }
  }

  async function runTest(yieldTest: YieldTest[]) {
    let curTime = env.T0;
    for (let id = 0; id < yieldTest.length; id++) {
      if (id % 10 == 0) {
        await addFundsToForge();
      }
      let curTest = yieldTest[id];
      let user = wallets[curTest.user];
      curTime = curTime.add(BN.from(curTest.timeDelta));
      await setTimeNextBlock(curTime);
      if (curTest.type == 'redeemDueInterests') {
        await redeemDueInterests(env, user);
      } else if (curTest.type == 'redeemUnderlying') {
        await redeemUnderlying(env, user, BN.from(curTest.amount));
      } else if (curTest.type == 'tokenizeYield') {
        await tokenizeYield(env, user, BN.from(curTest.amount));
      } else if (curTest.type == 'redeemUnderlyingAll') {
        let balance = await env.ot.balanceOf(user.address);
        await redeemUnderlying(env, user, balance);
      }
    }
    const expectedBalance = await env.yToken.balanceOf(dave.address);
    for (var person of [alice, bob, charlie]) {
      approxBigNumber(await env.yToken.balanceOf(person.address), expectedBalance, env.TEST_DELTA);
    }
  }
  it('test 1', async () => {
    await runTest((<any>testData).test1);
  });
  it('test 2', async () => {
    await runTest((<any>testData).test2);
  });
  xit('stress 1 [only enable when necessary]', async () => {
    await runTest((<any>testData).stress1);
  });
  xit('stress 2 [only enable when necessary]', async () => {
    await runTest((<any>testData).stress2);
  });

  it('xyt interests should be the same regardless actions users took', async () => {
    let amountToMove: BN = BN.from(100000000);
    let amountToTokenize: BN = amountToMove.mul(10);
    let period = env.EXPIRY.sub(env.T0).div(10);

    async function transferXyt(from: Wallet, to: Wallet, amount: BN) {
      await env.xyt.connect(from).transfer(to.address, amount, consts.HG);
    }

    async function transferYieldToken(from: Wallet, to: Wallet, amount: BN) {
      await env.yToken.connect(from).transfer(to.address, amount, consts.HG);
    }

    for (let person of [alice, bob, charlie, dave]) {
      await emptyToken(env.yToken, person);
    }
    await env.yToken.connect(eve).transfer(alice.address, amountToTokenize.mul(2), consts.HG);

    await tokenizeYield(env, alice, amountToTokenize, alice.address);
    await tokenizeYield(env, alice, amountToTokenize.div(2), bob.address);
    await tokenizeYield(env, alice, amountToTokenize.div(4), charlie.address);
    await tokenizeYield(env, alice, amountToTokenize.div(4), dave.address);

    await setTimeNextBlock(env.T0.add(period.mul(1)));
    await transferXyt(bob, dave, amountToMove);
    await transferXyt(bob, charlie, amountToMove);

    await setTimeNextBlock(env.T0.add(period.mul(2)));
    await transferXyt(bob, dave, amountToMove);
    await transferXyt(bob, charlie, amountToMove);

    await setTimeNextBlock(env.T0.add(period.mul(3)));
    await redeemDueInterests(env, alice);
    await redeemDueInterests(env, charlie);
    await redeemDueInterests(env, dave);

    await setTimeNextBlock(env.T0.add(period.mul(4)));
    await transferXyt(dave, bob, amountToMove);
    await transferXyt(charlie, bob, amountToMove.mul(2));
    await redeemDueInterests(env, alice);

    await setTimeNextBlock(env.T0.add(period.mul(5)));
    await redeemDueInterests(env, alice);
    await redeemDueInterests(env, charlie);
    await transferXyt(dave, bob, amountToMove);
    await transferXyt(charlie, bob, amountToMove);

    await setTimeNextBlock(env.T0.add(period.mul(6)));
    await transferXyt(bob, dave, amountToMove);
    await transferXyt(bob, charlie, amountToMove);

    await setTimeNextBlock(env.T0.add(period.mul(8)));
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
      .add(await env.yToken.balanceOf(dave.address));

    approxBigNumber(alice_yieldToken, bcd_yieldToken, BN.from(1000), true);
  });

  it('Should get 0 interests for the 2th or later time using redeemAfterExpiry', async () => {
    const amount = BN.from(1000000000);
    const period = env.EXPIRY.sub(env.T0);

    async function tryRedeemDueInterests(expected?: BN) {
      await redeemDueInterests(env, bob);
      let interestClaimed = await env.router
        .connect(alice)
        .callStatic.redeemDueInterests(env.FORGE_ID, tokens.USDT.address, env.EXPIRY, alice.address, consts.HG);
      if (expected != null) approxBigNumber(interestClaimed, expected, 0, true);
      else expect(interestClaimed.toNumber()).to.be.greaterThan(1);
      await redeemDueInterests(env, alice);
    }

    await tokenizeYield(env, alice, amount, alice.address);
    await tokenizeYield(env, alice, amount, bob.address);

    await setTimeNextBlock(env.T0.add(period.div(2)));
    await tryRedeemDueInterests();

    await setTimeNextBlock(env.T0.add(period.sub(consts.ONE_HOUR)));
    await redeemDueInterests(env, bob);

    await setTimeNextBlock(env.T0.add(period).add(10));
    await tryRedeemDueInterests();

    for (let i = 0; i < 3; ++i) {
      await tryRedeemDueInterests(BN.from(0));
    }
  });

  it('Transfering xyt after expiry', async () => {
    const amount = BN.from(1000000000);
    const transferAmount = amount.div(10);

    await emptyToken(env.yToken, bob);
    await emptyToken(env.yToken, charlie);
    await emptyToken(env.yToken, dave);

    await tokenizeYield(env, alice, amount, alice.address);
    await tokenizeYield(env, alice, amount, bob.address);
    await tokenizeYield(env, alice, amount, charlie.address);
    await tokenizeYield(env, alice, amount.mul(2), dave.address);

    /// before expiry
    await advanceTime(consts.THREE_MONTH);

    await env.xyt.connect(bob).transfer(charlie.address, transferAmount, consts.HG);

    /// Fake activity
    await advanceTime(consts.THREE_MONTH.sub(consts.ONE_HOUR));
    await redeemDueInterests(env, alice);

    /// after expiry
    await advanceTime(consts.SIX_MONTH);
    await env.xyt.connect(bob).transfer(charlie.address, transferAmount, consts.HG);

    await env.xyt.connect(charlie).transfer(bob.address, transferAmount.mul(5), consts.HG);

    await redeemAfterExpiry(env, bob);
    await redeemAfterExpiry(env, charlie);
    await redeemAfterExpiry(env, dave);

    const bobBalance: BN = await env.yToken.balanceOf(bob.address);
    const charlieBalance: BN = await env.yToken.balanceOf(charlie.address);
    const daveBalance: BN = await env.yToken.balanceOf(dave.address);

    approxBigNumber(bobBalance.add(charlieBalance), daveBalance, 300, true);
  });
});
