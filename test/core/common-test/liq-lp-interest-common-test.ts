import { loadFixture } from 'ethereum-waffle';
import { BigNumber as BN } from 'ethers';
import { liquidityMiningFixture, Mode, parseTestEnvLiquidityMiningFixture, TestEnv, wallets } from '../../fixtures';
import {
  approxBigNumber,
  approxByPercent,
  emptyToken,
  evm_revert,
  evm_snapshot,
  randomBN,
  randomNumber,
  redeemDueInterests,
  redeemLiqInterest,
  redeemLpInterests,
  setTimeNextBlock,
  stake,
  withdraw,
} from '../../helpers';

export function runTest(mode: Mode) {
  describe('', async () => {
    const [alice, bob, charlie, dave, eve] = wallets;
    let snapshotId: string;
    let globalSnapshotId: string;
    let env: TestEnv = {} as TestEnv;

    async function buildTestEnv() {
      env = await loadFixture(liquidityMiningFixture);
      await parseTestEnvLiquidityMiningFixture(env, mode);
      env.TEST_DELTA = BN.from(200);
    }

    before(async () => {
      await buildTestEnv();
      globalSnapshotId = await evm_snapshot();

      // await env.data.setInterestUpdateRateDeltaForMarket(BN.from(0));
      for (let user of [bob, charlie, dave, eve]) {
        // don't no why eve needs to claim twice
        await emptyToken(env, env.xyt, user);
        await redeemDueInterests(env, user);
        await emptyToken(env, env.yToken, user);
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

    it('test 1', async () => {
      await env.xyt.transfer(eve.address, (await env.xyt.balanceOf(env.market.address)).div(10));
      let totalTime = env.pconsts.misc.SIX_MONTH;
      let numTurnsBeforeExpiry = 20;
      let numTurnsAfterExpiry = 6;
      let numTurns = numTurnsBeforeExpiry + numTurnsAfterExpiry;

      let liqBalance: BN[] = [BN.from(0), BN.from(0), BN.from(0), BN.from(0)];
      let lpBalance: BN[] = [];
      for (let i = 0; i < 4; i++) lpBalance.push(await env.market.balanceOf(wallets[i].address));

      for (let i = 1; i <= numTurns; i++) {
        await setTimeNextBlock(env.liqParams.START_TIME.add(totalTime.div(numTurnsBeforeExpiry).mul(i)));
        let userID = randomBN(4).toNumber();
        let actionType: number = randomNumber(3);
        if (liqBalance[userID].eq(0)) {
          actionType = 0;
        }
        if (actionType == 0) {
          let amount = randomBN(lpBalance[userID]);
          await stake(env, wallets[userID], amount);
          liqBalance[userID] = liqBalance[userID].add(amount);
          lpBalance[userID] = lpBalance[userID].sub(amount);
        } else if (actionType == 1) {
          let amount = randomBN(liqBalance[userID]);
          await withdraw(env, wallets[userID], amount);
          liqBalance[userID] = liqBalance[userID].sub(amount);
          lpBalance[userID] = lpBalance[userID].add(amount);
        } else if (actionType == 2) {
          await redeemLiqInterest(env, wallets[userID]);
        }
        if (
          mode == Mode.COMPOUND ||
          mode == Mode.BENQI ||
          mode == Mode.SUSHISWAP_COMPLEX ||
          mode == Mode.SUSHISWAP_SIMPLE ||
          mode == Mode.TRADER_JOE ||
          mode == Mode.XJOE ||
          mode == Mode.WONDERLAND
        ) {
          await env.addGenericForgeFakeIncome(env);
        }
      }

      await redeemDueInterests(env, eve);
      let expectedGain: BN = await env.yToken.balanceOf(eve.address);
      for (let i = 1; i < 4; i++) {
        await redeemLiqInterest(env, wallets[i]);
        await redeemLpInterests(env, wallets[i]);
      }
      for (let i = 1; i < 4; i++) {
        if (mode == Mode.WONDERLAND) {
          approxByPercent(await env.yToken.balanceOf(wallets[i].address), expectedGain, 10 ** 4);
        } else {
          approxBigNumber(await env.yToken.balanceOf(wallets[i].address), expectedGain, env.TEST_DELTA);
        }
        approxBigNumber(await env.market.balanceOf(wallets[i].address), lpBalance[i], 0);
      }
    });
  });
}
