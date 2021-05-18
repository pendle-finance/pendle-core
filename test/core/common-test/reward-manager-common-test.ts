import { BigNumber as BN, Wallet, Contract } from 'ethers';
import {
  evm_revert,
  evm_snapshot,
  consts,
  approxBigNumber,
  tokenizeYield,
  redeemUnderlying,
  redeemAfterExpiry,
  advanceTime,
  mineBlock,
  minerStop,
  minerStart
} from '../../helpers';
import {
  routerFixture,
  RouterFixture,
  Mode,
  parseTestEnvRouterFixture,
  TestEnv,
} from '../fixtures';

import hre from 'hardhat';
const { waffle } = hre;
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

    let userInitialYieldToken: BN;

    async function buildTestEnv() {
      let fixture: RouterFixture = await loadFixture(routerFixture);
      console.log(`\tLoaded routerFixture`);
      await parseTestEnvRouterFixture(alice, mode, env, fixture);
      env.TEST_DELTA = BN.from(1500000);
    }

    before(async () => {
      await buildTestEnv();
      globalSnapshotId = await evm_snapshot();

      userInitialYieldToken = (await env.yUSDT.balanceOf(alice.address)).div(4);
      rewardToken = await hre.ethers.getContractAt("TestToken", await env.forge.rewardToken());
      yieldTokenHolder = await env.forge.yieldTokenHolders(env.USDTContract.address, env.EXPIRY);

      await minerStop();
      for (const person of [bob, charlie, dave]) {
        await env.yUSDT.transfer(person.address, userInitialYieldToken);
        await env.yUSDT.connect(person).approve(env.router.address, consts.INF);
      };
      await redeemRewardsFromProtocol([bob, charlie, dave]);
      await mineBlock();
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

    async function redeemRewardsFromProtocol(users: Wallet[]) {
      if (mode == Mode.AAVE_V2) {
        const incentiveController = await hre.ethers.getContractAt("IAaveIncentivesController", consts.AAVE_INCENTIVES_CONTROLLER);
        for (const person of users) {
          await incentiveController.connect(person).claimRewards(
            [env.yUSDT.address],
            consts.INF,
            person.address
          );
        }
      } else if (mode == Mode.COMPOUND) {
        const comptroller = await hre.ethers.getContractAt("IComptroller", consts.COMPOUND_COMPTROLLER_ADDRESS);
        await comptroller.claimComp(
          users.map((u) => u.address),
          [env.yUSDT.address],
          false,
          true
        );
      }
    }

    async function advanceTimeAndBlock(time: BN, blockCount: number) {
      await advanceTime(time);
      for (let i=0;i<blockCount;i++) {
        await mineBlock();
      }
    }

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
      for (const index of [0,1,2]) {
        otBalance[index] = await env.ot.balanceOf(users[index].address);
        rewardBalanceBefore[index] = await rewardToken.balanceOf(users[index].address);
        await env.rewardManager.redeemRewards(env.USDTContract.address, env.EXPIRY, users[index].address);
      };

      await mineBlock();
      await minerStart();

      for (const index of [0,1,2]) {
        const rewardBalanceAfter = await rewardToken.balanceOf(users[index].address);
        rewardEarned[index] = rewardBalanceAfter.sub(rewardBalanceBefore[index]);
        totalRewardEarned = totalRewardEarned.add(rewardEarned[index]);
      };

      for (const index of [0,1,2]) {
        const expectedReward = totalRewardEarned.mul(otBalance[index]).div(otTotalSupply);
        approxBigNumber(rewardEarned[index], expectedReward, BN.from(10));
      };

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
    //    - holds the yUSDT throughout from t0
    //    - redeem incentives directly from protocol at t5
    // Charlie:
    //    - tokenize half of yUSDT at t0
    //    - redeemUnderlying half of his OTs at t2
    //    - redeemAfterExpiry at t4 (after expiry)
    //    - redeemRewards() at t5
    // Dave:
    //    - tokenize 2/3 of yUSDT & empty XYTs at t1
    //    - send 2/3 of his OT to Eve at t3
    //    - redeemRewards() at t5
    // Eve:
    //    - Eve sends half of his OTs back to Dave at t4
    //    - redeemRewards() at t5
    // => At t5, this must hold:
    //       reward(Bob) = reward(Charlie) = reward(Dave) + reward(Eve)
    it('[Only Compound] OT users should receive same rewards as yUSDT holders', async () => {
      if (mode !== Mode.COMPOUND) return;

      //t0
      await tokenizeYield(env, charlie, userInitialYieldToken);

      //t1
      await advanceTimeAndBlock(consts.ONE_DAY.mul(10), 3);
      await tokenizeYield(env, dave, userInitialYieldToken.mul(2).div(3)); // tokenize 2/3 of yUSDT & empty XYTs at t1
      const otMintedDave = await env.ot.balanceOf(dave.address);

      //t2
      await advanceTimeAndBlock(consts.ONE_DAY.mul(10), 3);
      await redeemUnderlying(env, charlie, userInitialYieldToken.div(2)); // redeemUnderlying half of his OTs at t2

      //t3
      await advanceTimeAndBlock(consts.ONE_DAY.mul(10), 3);
      await env.ot.connect(dave).transfer(eve.address, otMintedDave.mul(2).div(3));

      //t4
      await advanceTimeAndBlock(consts.SIX_MONTH, 5);
      await redeemAfterExpiry(env, charlie);
      await env.ot.connect(eve).transfer(dave.address, otMintedDave.div(3));

      //t5
      await advanceTimeAndBlock(consts.ONE_MONTH, 5);

      await minerStop();
      await redeemRewardsFromProtocol([bob, charlie, dave, eve]);
      for (const person of [charlie, dave, eve]) {
        await env.rewardManager.redeemRewards(env.USDTContract.address, env.EXPIRY, person.address);
      }
      await mineBlock();
      await minerStart();

      const bobRewardBalance = await rewardToken.balanceOf(bob.address);
      const charlieRewardBalance = await rewardToken.balanceOf(charlie.address);
      const daveRewardBalance = await rewardToken.balanceOf(dave.address);
      const eveRewardBalance = await rewardToken.balanceOf(eve.address);

      approxBigNumber(
        bobRewardBalance,
        charlieRewardBalance,
        env.TEST_DELTA
      );

      approxBigNumber(
        bobRewardBalance,
        daveRewardBalance.add(eveRewardBalance),
        env.TEST_DELTA
      );
    });

    it('OT users should receive proportionally to their OT balance', async () => {
      await tokenizeYield(env, charlie, userInitialYieldToken);
      const otMinted = await env.ot.balanceOf(charlie.address);

      await advanceTimeAndBlock(consts.ONE_DAY.mul(10), 20);
      await redeemAndCheckRewardAndSendTnx(async () => tokenizeYield(env, dave, userInitialYieldToken.div(2)));

      await advanceTimeAndBlock(consts.ONE_DAY.mul(10), 20);
      await redeemAndCheckRewardAndSendTnx(async () => redeemUnderlying(env, charlie, otMinted.div(3)));

      await advanceTimeAndBlock(consts.ONE_DAY.mul(10), 20);
      await redeemAndCheckRewardAndSendTnx(async () => await env.ot.connect(dave).transfer(eve.address, otMinted.div(4)));

      await advanceTimeAndBlock(consts.SIX_MONTH, 20);
      await redeemAndCheckRewardAndSendTnx(async () => await redeemAfterExpiry(env, charlie));

      await advanceTimeAndBlock(consts.ONE_MONTH, 4);
      await redeemAndCheckRewardAndSendTnx(async () => {});
    });
  });
}
