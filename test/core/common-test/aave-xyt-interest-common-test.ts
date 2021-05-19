import { expect } from 'chai';
import { BigNumber as BN, Wallet } from 'ethers';
import {
  amountToWei,
  approxBigNumber,
  consts,
  evm_revert,
  evm_snapshot,
  mintAaveToken,
  randomNumber,
  redeemDueInterests,
  redeemUnderlying,
  redeemAfterExpiry,
  setTimeNextBlock,
  tokenizeYield,
  tokens,
  Token,
  transferToken
} from '../../helpers';
import { Mode, parseTestEnvRouterFixture, routerFixture, RouterFixture, TestEnv } from '../fixtures';
import testData from '../fixtures/yieldTokenizeAndRedeem.scenario.json';

import { waffle } from 'hardhat';
const { loadFixture, provider } = waffle;

interface YieldTest {
  type: string;
  user: number;
  amount: number;
  timeDelta: number;
}

export function runTest(isAaveV1: boolean) {
  describe('', async () => {
    const wallets = provider.getWallets();
    const [alice, bob, charlie, dave, eve] = wallets;

    let snapshotId: string;
    let globalSnapshotId: string;
    let env: TestEnv = {} as TestEnv;

    async function buildTestEnv() {
      let fixture: RouterFixture = await loadFixture(routerFixture);
      if (isAaveV1) await parseTestEnvRouterFixture(alice, Mode.AAVE_V1, env, fixture);
      else await parseTestEnvRouterFixture(alice, Mode.AAVE_V2, env, fixture);
      env.TEST_DELTA = BN.from(6000);
    }

    before(async () => {
      await buildTestEnv();
      globalSnapshotId = await evm_snapshot();
      for (var person of [bob, charlie, dave, eve]) {
        await mintAaveToken(tokens.USDT, person, env.INITIAL_YIELD_TOKEN_AMOUNT, isAaveV1);
        await env.yUSDT.connect(person).approve(env.router.address, consts.INF);
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
        await env.xyt.connect(eve).transfer(env.forge.yieldTokenHolders(tokens.USDT.address, env.EXPIRY), await env.xyt.balanceOf(eve.address));
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
      const expectedBalance = await env.yUSDT.balanceOf(dave.address);
      for (var person of [alice, bob, charlie]) {
        approxBigNumber(await env.yUSDT.balanceOf(person.address), expectedBalance, env.TEST_DELTA);
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

    it("xyt interests should be the same regardless actions users took", async() => {
      let amountToMove: BN = BN.from(100000000);
      let amountToTokenize: BN = amountToMove.mul(10);
      let period = env.EXPIRY.sub(env.T0).div(10);

      async function transferXyt(from: Wallet, to: Wallet, amount: BN) {
        await env.xyt.connect(from).transfer(
          to.address,
          amount,
          consts.HIGH_GAS_OVERRIDE
        );
      }

      async function transferYieldToken(from: Wallet, to: Wallet, amount: BN) {
        await env.yUSDT.connect(from).transfer(
          to.address,
          amount,
          consts.HIGH_GAS_OVERRIDE
        );
      }

      async function removeYieldToken(user: Wallet, amountToKeep: BN) {
        await transferYieldToken(user, eve,
          (await env.yUSDT.connect(user).balanceOf(user.address)).sub(amountToKeep),
        );
      }

      await removeYieldToken(alice, amountToTokenize.mul(2));
      for(let person of [bob, charlie, dave]) {
        removeYieldToken(person, BN.from(0));
      }

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
      
      for(let person of [alice, bob, charlie, dave]) {
        await redeemAfterExpiry(env, person);
      }


      await setTimeNextBlock(env.T0.add(period.mul(20).add(10)));
      await transferYieldToken(bob, charlie, BN.from(1));

      let alice_yieldToken = (await env.yUSDT.balanceOf(alice.address));
      let bcd_yeildToken = ((await env.yUSDT.balanceOf(bob.address))).add(
        (await env.yUSDT.balanceOf(charlie.address))
      ).add(
        (await env.yUSDT.balanceOf(dave.address))
      );

      approxBigNumber(
        alice_yieldToken,
        bcd_yeildToken,
        BN.from(100),
        true
      );      
    });

    it("Should get 0 interests for the 2th or later time using redeemAfterExpiry", async () => {
      const amount = BN.from(1000000000);
      const period = env.EXPIRY.sub(env.T0);

      async function tryRedeemDueInterests(expected?: BN) {
        await redeemDueInterests(env, bob);
        let interestClaimed = (await env.router.connect(alice).callStatic.redeemDueInterests(
          env.FORGE_ID, 
          tokens.USDT.address, 
          env.EXPIRY, 
          alice.address, 
          consts.HIGH_GAS_OVERRIDE
        ));
        if (expected != null)
          approxBigNumber(interestClaimed, expected, 0, true);
        else
          expect(interestClaimed.toNumber()).to.be.greaterThan(1);
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

      for(let i = 0; i < 3; ++i) {
        await tryRedeemDueInterests(BN.from(0));
      }
    });
  });
}
