import chai, { expect } from 'chai';
import { solidity } from 'ethereum-waffle';
import { BigNumber as BN, Contract, Wallet } from 'ethers';
import { Mode, parseTestEnvRouterFixture, routerFixture, RouterFixture, TestEnv } from '../../fixtures';
import {
  advanceTime,
  advanceTimeAndBlock,
  approxBigNumber,
  consts,
  errMsg,
  evm_revert,
  evm_snapshot,
  getContractAt,
  mineAllPendingTransactions,
  minerStart,
  minerStop,
  redeemAfterExpiry,
  redeemRewardsFromProtocol,
  redeemUnderlying,
  tokenizeYield,
} from '../../helpers';
chai.use(solidity);

const { waffle } = require('hardhat');
const { loadFixture, provider } = waffle;

export function runTest(mode: Mode) {
  describe('', async () => {
    const wallets = provider.getWallets();
    const [alice, bob, charlie, dave, eve] = wallets;
    let snapshotId: string;
    let globalSnapshotId: string;
    let env: TestEnv = {} as TestEnv;
    let rewardToken: Contract;
    let yieldTokenHolder: string;
    let tokenToStake: String;
    let exchangeRate: BN;
    let compoundDenom: BN;

    let userInitialYieldToken: BN;

    function toUnderlyingAmount(amount: BN) {
      return amount.mul(exchangeRate).div(compoundDenom);
    }

    async function buildTestEnv() {
      let fixture: RouterFixture = await loadFixture(routerFixture);
      await parseTestEnvRouterFixture(alice, mode, env, fixture);
      env.TEST_DELTA = BN.from(1500000);

      if (mode == Mode.SUSHISWAP_COMPLEX) {
        tokenToStake = env.underlyingAsset.address;
      } else {
        tokenToStake = env.USDTContract.address;
      }
      exchangeRate = await env.forge.callStatic.getExchangeRate(env.underlyingAsset.address);
      compoundDenom = BN.from('1000000000000000000');
    }

    before(async () => {
      await buildTestEnv();
      globalSnapshotId = await evm_snapshot();

      userInitialYieldToken = (await env.yToken.balanceOf(alice.address)).div(4);
      rewardToken = await getContractAt('TestToken', await env.forge.rewardToken());
      yieldTokenHolder = await env.forge.yieldTokenHolders(tokenToStake, env.EXPIRY);

      await minerStop();
      for (const person of [bob, charlie, dave]) {
        await env.yToken.transfer(person.address, userInitialYieldToken);
        await env.yToken.connect(person).approve(env.router.address, consts.INF);
      }
      await redeemRewardsFromProtocol(env, [bob, charlie, dave]);
      await mineAllPendingTransactions();
      await minerStart();

      snapshotId = await evm_snapshot();
    });

    after(async () => {
      await evm_revert(globalSnapshotId);
    });

    beforeEach(async () => {
      await evm_revert(snapshotId);
      snapshotId = await evm_snapshot();
    });

    // check that the new rewards are distributed proportionally to OT balances
    async function redeemAndCheckRewardAndSendTnx(transaction: any) {
      await minerStop();
      const users = [charlie, dave, eve];
      const rewardBalanceBefore: BN[] = new Array(3);
      const otBalance: BN[] = new Array(3);
      const rewardEarned: BN[] = new Array(3);
      const otTotalSupply = await env.ot.totalSupply();
      let totalRewardEarned = BN.from(0);
      await transaction();
      for (const index of [0, 1, 2]) {
        otBalance[index] = await env.ot.balanceOf(users[index].address);
        rewardBalanceBefore[index] = await rewardToken.balanceOf(users[index].address);
        await env.rewardManager
          .connect(users[index])
          .redeemRewards(tokenToStake, env.EXPIRY, users[index].address, consts.HG);
      }

      await mineAllPendingTransactions();
      await minerStart();

      for (const index of [0, 1, 2]) {
        const rewardBalanceAfter = await rewardToken.balanceOf(users[index].address);
        rewardEarned[index] = rewardBalanceAfter.sub(rewardBalanceBefore[index]);
        totalRewardEarned = totalRewardEarned.add(rewardEarned[index]);
      }

      for (const index of [0, 1, 2]) {
        const expectedReward = totalRewardEarned.mul(otBalance[index]).div(otTotalSupply);
        approxBigNumber(rewardEarned[index], expectedReward, BN.from(10));
      }

      const rewardLeftInYieldTokenHolder = await rewardToken.balanceOf(yieldTokenHolder);
      approxBigNumber(rewardLeftInYieldTokenHolder, BN.from(0), BN.from(10));
    }

    // async function printForgeStatus() {
    //   console.log(`\n\tYieldTokenHolder = ${yieldTokenHolder}`);
    //   const rewardBalance = await rewardToken.balanceOf(yieldTokenHolder);
    //   console.log(`\tReward token balance of yieldTokenHolder = ${rewardBalance}`);
    //   console.log(`\t Total OT supply = ${await env.ot.totalSupply()}`);
    // }

    // Bob:
    //    - holds the yToken throughout from t0
    //    - redeem incentives directly from protocol at t5
    // Charlie:
    //    - tokenize half of yToken at t0
    //    - redeemUnderlying half of his OTs at t2
    //    - redeemAfterExpiry at t4 (after expiry)
    //    - redeemRewards() at t5
    // Dave:
    //    - tokenize 2/3 of yToken & empty XYTs at t1
    //    - send 2/3 of his OT to Eve at t3
    //    - redeemRewards() at t5
    // Eve:
    //    - Eve sends half of his OTs back to Dave at t4
    //    - redeemRewards() at t5
    // => At t5, this must hold:
    //       reward(Bob) = reward(Charlie) = reward(Dave) + reward(Eve)
    it('OT users should receive same rewards as yToken holders', async () => {
      //t0
      await tokenizeYield(env, charlie, userInitialYieldToken);

      //t1
      await advanceTimeAndBlock(consts.ONE_DAY.mul(10), 3);
      await tokenizeYield(env, dave, userInitialYieldToken.mul(2).div(3)); // tokenize 2/3 of yToken & empty XYTs at t1
      const otMintedDave = await env.ot.balanceOf(dave.address);

      //t2
      await advanceTimeAndBlock(consts.ONE_DAY.mul(10), 3);
      await redeemUnderlying(env, charlie, toUnderlyingAmount(userInitialYieldToken.div(2))); // redeemUnderlying half of his OTs at t2

      //t3
      await advanceTimeAndBlock(consts.ONE_DAY.mul(10), 3);
      await env.ot.connect(dave).transfer(eve.address, toUnderlyingAmount(otMintedDave.mul(2).div(3)));

      //t4
      await advanceTimeAndBlock(consts.SIX_MONTH, 5);
      await redeemAfterExpiry(env, charlie);
      await env.ot.connect(eve).transfer(dave.address, toUnderlyingAmount(otMintedDave.div(3)));

      //t5
      await advanceTimeAndBlock(consts.ONE_MONTH, 5);

      await minerStop();
      await redeemRewardsFromProtocol(env, [bob, charlie, dave, eve]);
      for (const person of [charlie, dave, eve]) {
        await env.rewardManager.redeemRewards(tokenToStake, env.EXPIRY, person.address);
      }
      await mineAllPendingTransactions();
      await minerStart();

      const bobRewardBalance = await rewardToken.balanceOf(bob.address);
      const charlieRewardBalance = await rewardToken.balanceOf(charlie.address);
      const daveRewardBalance = await rewardToken.balanceOf(dave.address);
      const eveRewardBalance = await rewardToken.balanceOf(eve.address);

      approxBigNumber(bobRewardBalance, charlieRewardBalance, env.TEST_DELTA);

      approxBigNumber(bobRewardBalance, daveRewardBalance.add(eveRewardBalance), env.TEST_DELTA);
    });

    it('OT users should receive proportionally to their OT balance', async () => {
      await tokenizeYield(env, charlie, userInitialYieldToken);
      const otMinted = await env.ot.balanceOf(charlie.address);

      await advanceTimeAndBlock(consts.ONE_DAY.mul(10), 20);
      await redeemAndCheckRewardAndSendTnx(
        async () => await tokenizeYield(env, alice, userInitialYieldToken.div(2), dave.address)
      );

      await advanceTimeAndBlock(consts.ONE_DAY.mul(10), 20);
      await redeemAndCheckRewardAndSendTnx(async () => await redeemUnderlying(env, charlie, otMinted.div(3)));

      await advanceTimeAndBlock(consts.ONE_DAY.mul(10), 20);
      await redeemAndCheckRewardAndSendTnx(
        async () => await env.ot.connect(dave).transfer(eve.address, otMinted.div(4), consts.HG)
      );

      await advanceTimeAndBlock(consts.SIX_MONTH, 20);
      await redeemAndCheckRewardAndSendTnx(async () => await redeemAfterExpiry(env, charlie));

      await advanceTimeAndBlock(consts.ONE_MONTH, 4);
      await redeemAndCheckRewardAndSendTnx(async () => {});
    });

    it('Reward manager should work normally after updating updateFrequency to INF', async () => {
      let amount = userInitialYieldToken.div(10);
      for (let person of [bob, charlie, dave, eve]) {
        await tokenizeYield(env, alice, amount, person.address);
      }

      await advanceTime(consts.ONE_MONTH);
      await env.rewardManager.setUpdateFrequency([tokenToStake], [BN.from(10 ** 9)], consts.HG);

      for (let person of [bob, charlie, dave, eve]) {
        await env.ot.connect(person).transfer(alice.address, toUnderlyingAmount(amount.div(2)), consts.LG);

        await advanceTime(consts.ONE_MONTH);
        await env.rewardManager.redeemRewards(tokenToStake, env.EXPIRY, person.address, consts.HG);
      }

      // Try updateParamLManual
      for (let person of [bob, charlie, dave, eve]) {
        await env.ot.connect(person).transfer(alice.address, toUnderlyingAmount(amount.div(2)), consts.LG);

        await advanceTime(consts.ONE_MONTH);
        await env.rewardManager.redeemRewards(tokenToStake, env.EXPIRY, person.address, consts.HG);
        await env.rewardManager.connect(person).updateParamLManual(tokenToStake, env.EXPIRY, consts.HG);
      }
    });

    it('updateFrequency should work correctly', async () => {
      /*
        Scenario: Set updateFrequency to 4
        Flow:
          bob transfer ot (low gas) -> success
          charlie transfer ot(low gas) -> success
          dave transfer ot (low gas) -> success
          eve transfer ot (low gas) -> failed
          eve transfer ot again (high gas) -> success
      */
      const amount = userInitialYieldToken.div(10);
      const amountToTransfer = amount.div(10);
      for (let person of [bob, charlie, dave, eve]) {
        await tokenizeYield(env, alice, amount, person.address);
      }

      await advanceTime(consts.ONE_MONTH);
      await env.rewardManager.setUpdateFrequency([tokenToStake], [4], consts.HG);
      await env.rewardManager.connect(alice).updateParamLManual(tokenToStake, env.EXPIRY, consts.HG);

      for (let t = 0; t < 5; ++t) {
        for (let person of [bob, charlie, dave]) {
          await env.ot.connect(person).transfer(alice.address, toUnderlyingAmount(amountToTransfer), consts.LG);
        }
        await expect(env.ot.connect(eve).transfer(alice.address, toUnderlyingAmount(amountToTransfer), consts.LG)).to.be
          .reverted;
        await env.ot.connect(eve).transfer(alice.address, toUnderlyingAmount(amountToTransfer), consts.HG);
      }
    });

    it('skippingRewards should work correctly', async () => {
      async function redeemRewardsToken(person: Wallet): Promise<BN> {
        let lastBalance: BN = await rewardToken.balanceOf(person.address);
        await env.rewardManager.redeemRewards(tokenToStake, env.EXPIRY, person.address, consts.HG);
        let currentBalance: BN = await rewardToken.balanceOf(person.address);
        return currentBalance.sub(lastBalance);
      }

      async function ensureParamLUnchanged(functionToCall: any) {
        /// This function aims to check the change of paramL before and after a promise function is called
        const paramLBefore: BN = (await env.rewardManager.readRewardData(tokenToStake, env.EXPIRY, alice.address))
          .paramL;
        await functionToCall;
        const paramLAfter: BN = (await env.rewardManager.readRewardData(tokenToStake, env.EXPIRY, alice.address))
          .paramL;
        approxBigNumber(paramLBefore, paramLAfter, 0, false);
      }

      const amount = userInitialYieldToken.div(10);
      for (let person of [bob, charlie, dave, eve]) {
        await tokenizeYield(env, alice, amount, person.address);
      }

      // Should receive pending reward before skippingRewards
      await advanceTime(consts.ONE_MONTH);
      for (let person of [bob, charlie, dave, eve]) {
        expect((await redeemRewardsToken(person)).eq(0)).to.be.equal(false);
      }

      // Should not receive pending reward after skippingRewards
      await env.rewardManager.setSkippingRewards(true);
      await advanceTime(consts.ONE_MONTH);

      for (let person of [bob, charlie, dave, eve]) {
        // ParamL was updated when eve last redeem their reward. Thus, other actors should still receive their pending reward calculated up to that moment.
        if (person.address == eve.address) {
          expect((await redeemRewardsToken(person)).eq(0)).to.be.equal(true);
        } else {
          expect((await redeemRewardsToken(person)).eq(0)).to.be.equal(false);
        }
      }
      // just to see if it affects the skipping rewards.
      await env.rewardManager.setUpdateFrequency([tokenToStake], [2], consts.HG);
      await env.rewardManager.connect(alice).updateParamLManual(tokenToStake, env.EXPIRY, consts.HG);

      for (let person of [bob, charlie, dave, eve]) {
        expect((await redeemRewardsToken(person)).eq(0)).to.be.equal(true);
      }

      // Transfering ot should be cheap
      for (let person of [bob, charlie, dave]) {
        await env.ot.connect(person).transfer(alice.address, toUnderlyingAmount(amount), consts.LG);
      }

      // After skippingRewards, nothing should be able to change paramL
      for (let person of [bob, charlie, dave]) {
        /// redeemRewards
        await ensureParamLUnchanged(redeemRewardsToken(person));
        await ensureParamLUnchanged(env.ot.connect(alice).transfer(person.address, 1, consts.HG));
      }
      await ensureParamLUnchanged(env.rewardManager.setUpdateFrequency([tokenToStake], [2], consts.HG));
      await ensureParamLUnchanged(env.rewardManager.setSkippingRewards(true)); /// Must not set it false here :joy:
      await ensureParamLUnchanged(
        env.rewardManager.connect(alice).updateParamLManual(tokenToStake, env.EXPIRY, consts.HG)
      );
    });

    it('isValidOT modifier should reject redeem interest request on invalid OT token', async () => {
      await expect(env.rewardManager.redeemRewards(consts.RANDOM_ADDRESS, env.EXPIRY, bob.address)).to.be.revertedWith(
        errMsg.INVALID_OT
      );
    });

    it('onlyForge modifier should reject update reward request from non-forge', async () => {
      await expect(env.rewardManager.updatePendingRewards(tokenToStake, env.EXPIRY, alice.address)).to.be.revertedWith(
        errMsg.ONLY_FORGE
      );
    });

    it('setUpdateFrequency should reject inconsistent input array length', async () => {
      await expect(
        env.rewardManager.setUpdateFrequency([tokenToStake], [BN.from(100), consts.RONE])
      ).to.be.revertedWith(errMsg.ARRAY_LENGTH_MISMATCH);
    });

    it('updataParamL should be rejected for underlying asset with no existing yield token holder', async () => {
      await expect(env.rewardManager.updateParamLManual(consts.RANDOM_ADDRESS, alice.address)).to.be.revertedWith(
        errMsg.INVALID_YIELD_TOKEN_HOLDER
      );
    });
  });
}
