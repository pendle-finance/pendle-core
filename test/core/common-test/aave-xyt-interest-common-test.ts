import { BigNumber as BN } from 'ethers';
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
  setTimeNextBlock,
  tokenizeYield,
  tokens,
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
  });
}
