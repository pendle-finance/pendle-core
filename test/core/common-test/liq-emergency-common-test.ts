import chai, { expect } from 'chai';
import { solidity } from 'ethereum-waffle';
import { BigNumber as BN } from 'ethers';
import {
  advanceTime,
  approxBigNumber,
  consts,
  emptyToken,
  errMsg,
  evm_revert,
  evm_snapshot,
  redeemRewards,
  stake,
  withdraw,
} from '../../helpers';
import {
  liquidityMiningFixture,
  LiquidityMiningFixture,
  Mode,
  parseTestEnvLiquidityMiningFixture,
  TestEnv,
} from '../../fixtures';
const { waffle } = require('hardhat');
chai.use(solidity);

const { loadFixture, provider } = waffle;

export function runTest(mode: Mode) {
  describe('', async () => {
    const wallets = provider.getWallets();
    const [alice, bob, charlie, dave, eve] = wallets;
    let snapshotId: string;
    let globalSnapshotId: string;
    let env: TestEnv = {} as TestEnv;

    async function buildTestEnv() {
      let fixture: LiquidityMiningFixture = await loadFixture(liquidityMiningFixture);
      await parseTestEnvLiquidityMiningFixture(alice, mode, env, fixture);
    }

    before(async () => {
      await buildTestEnv();
      globalSnapshotId = await evm_snapshot();
      snapshotId = await evm_snapshot();
    });

    after(async () => {
      await evm_revert(globalSnapshotId);
    });

    beforeEach(async () => {
      await evm_revert(snapshotId);
      snapshotId = await evm_snapshot();
    });

    async function checkLiquidityMiningEmergency() {
      await expect(env.liq.fund([BN.from(10 ** 9), BN.from(10 ** 9)], consts.HG)).to.be.revertedWith(
        errMsg.LIQ_MINING_PAUSED
      );

      await expect(
        env.liq.topUpRewards([BN.from(100), BN.from(101)], [BN.from(1000), BN.from(1000)], consts.HG)
      ).to.be.revertedWith(errMsg.LIQ_MINING_PAUSED);

      await expect(
        env.liq.setAllocationSetting([env.EXPIRY, env.EXPIRY.add(consts.SIX_MONTH)], [BN.from(1), BN.from(1)])
      ).to.be.revertedWith(errMsg.LIQ_MINING_PAUSED);

      await expect(env.liq.connect(alice).stake(env.EXPIRY, BN.from(1000))).to.be.revertedWith(
        errMsg.LIQ_MINING_PAUSED
      );

      await expect(env.liq.connect(alice).withdraw(env.EXPIRY, BN.from(1000))).to.be.revertedWith(
        errMsg.LIQ_MINING_PAUSED
      );

      await expect(env.liq.connect(alice).redeemRewards(env.EXPIRY, alice.address)).to.be.revertedWith(
        errMsg.LIQ_MINING_PAUSED
      );

      await expect(env.liq.connect(alice).redeemLpInterests(env.EXPIRY, alice.address)).to.be.revertedWith(
        errMsg.LIQ_MINING_PAUSED
      );
    }

    it('Should not be able to take liqMining actions while paused', async () => {
      await env.pausingManager.setPausingAdmin(bob.address, true, consts.HG);
      await env.pausingManager.connect(bob).setLiqMiningPaused(env.liq.address, true, consts.HG);
      await checkLiquidityMiningEmergency();
    });

    it('Should not be able to take liqMining actions after locked', async () => {
      await env.pausingManager.setPausingAdmin(bob.address, true, consts.HG);
      await env.pausingManager.setLiqMiningLocked(env.liq.address, consts.HG);
      await checkLiquidityMiningEmergency();
    });

    it('Should be able to withdraw Lp and PENDLE during emergency', async () => {
      let rewardLeft: BN = BN.from(0);
      for (let reward of env.liqParams.REWARDS_PER_EPOCH) {
        rewardLeft = rewardLeft.add(reward);
      }
      let balanceWithoutReward: BN = (await env.pdl.balanceOf(env.liq.address)).sub(rewardLeft);

      const amount = BN.from(10 ** 5);

      await advanceTime(env.liqParams.EPOCH_DURATION);

      await stake(env, alice, amount);
      let lpHolder = await env.liq.lpHolderForExpiry(env.EXPIRY);

      await advanceTime(env.liqParams.EPOCH_DURATION);

      await stake(env, bob, amount);
      await withdraw(env, alice, amount.div(2));

      await advanceTime(env.liqParams.EPOCH_DURATION);
      await stake(env, alice, amount);
      await stake(env, bob, amount);
      await stake(env, charlie, amount.div(2));

      await redeemRewards(env, alice);
      await redeemRewards(env, bob);
      await redeemRewards(env, charlie);

      for (let person of [alice, bob, charlie]) {
        rewardLeft = rewardLeft.sub(await env.pdl.balanceOf(person.address));
      }

      await env.pausingManager.setPausingAdmin(bob.address, true, consts.HG);
      await env.pausingManager.setLiqMiningLocked(env.liq.address, consts.HG);

      await env.liq.setUpEmergencyMode([env.EXPIRY], dave.address, consts.HG);

      await emptyToken(env.market, eve);
      await emptyToken(env.pdl, eve);

      await env.market
        .connect(dave)
        .transferFrom(lpHolder, eve.address, await env.market.balanceOf(lpHolder), consts.HG);

      await expect(
        env.pdl
          .connect(dave)
          .transferFrom(env.liq.address, eve.address, balanceWithoutReward.add(rewardLeft).add(1), consts.HG)
      ).to.be.reverted;

      await env.pdl
        .connect(dave)
        .transferFrom(env.liq.address, eve.address, await balanceWithoutReward.add(rewardLeft), consts.HG);

      approxBigNumber((await env.pdl.balanceOf(eve.address)).sub(balanceWithoutReward), rewardLeft, BN.from(10), true);

      approxBigNumber(await env.market.balanceOf(eve.address), amount.mul(4), BN.from(10), true);
    });
  });
}
