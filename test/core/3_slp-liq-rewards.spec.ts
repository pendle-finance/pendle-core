import chai, { assert, expect } from 'chai';
import { loadFixture, solidity } from 'ethereum-waffle';
import { BigNumber as BN } from 'ethers';
import {
  checkDisabled,
  liquidityMiningFixture,
  Mode,
  parseTestEnvLiquidityMiningFixture,
  TestEnv,
  UserStakeAction,
  wallets,
} from '../fixtures';
import * as scenario from '../fixtures/liquidityMiningScenario.fixture';
import {
  advanceTime,
  approveAll,
  approxBigNumber,
  approxByPercent,
  calcExpectedRewards,
  emptyToken,
  errMsg,
  evm_revert,
  evm_snapshot,
  mintSushiswapLpFixed,
  mintTraderJoeLpFixed,
  redeemLiqRewards,
  setTime,
  setTimeNextBlock,
  stake,
  startOfEpoch,
  withdraw,
} from '../helpers';
import { MiscConsts } from '@pendle/constants';
import { getContract } from '../../pendle-deployment-scripts';

chai.use(solidity);

export async function runTest(mode: Mode) {
  describe('', async () => {
    const [alice, bob, charlie, dave, eve] = wallets;
    let snapshotId: string;
    let globalSnapshotId: string;
    let env: TestEnv = {} as TestEnv;

    async function buildTestEnv() {
      env = await loadFixture(liquidityMiningFixture);
      await parseTestEnvLiquidityMiningFixture(env, mode);
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
      await approveAll([env.yToken], [env.liq]);
      for (let person of wallets) {
        if (mode == Mode.SLP_LIQ) {
          await mintSushiswapLpFixed(env, person);
        } else if (mode == Mode.JLP_LIQ) {
          await mintTraderJoeLpFixed(env, person);
        }
      }
    });

    async function getLpBalanceOfAllUsers(): Promise<BN[]> {
      let res: BN[] = [];
      for (let i = 0; i < wallets.length; i++) {
        res.push(await env.yToken.balanceOf(wallets[i].address));
      }
      return res;
    }

    // [epochs][user][transaction]

    async function doSequence(userStakingData: UserStakeAction[][][]) {
      let flatData: UserStakeAction[] = [];
      let flatEpochId: any[] = [];
      let expectedLpBalance: BN[] = await getLpBalanceOfAllUsers();

      userStakingData.forEach((epochData, epochId) => {
        epochData.forEach((userData) => {
          userData.forEach((userAction) => {
            if (userAction.id != -1) {
              flatEpochId.push(epochId + 1);
              flatData.push(userAction);
            }
          });
        });
      });

      flatData = flatData.sort((a, b) => {
        return a.time.sub(b.time).toNumber();
      });

      for (let i = 0; i < flatData.length; i++) {
        let action = flatData[i];
        if (i != 0) assert(flatData[i - 1].time < flatData[i].time);

        await setTimeNextBlock(action.time);

        if (action.isStaking) {
          await stake(env, wallets[action.id], action.amount);
          expectedLpBalance[action.id] = expectedLpBalance[action.id].sub(action.amount);
        } else {
          await withdraw(env, wallets[action.id], action.amount);
          expectedLpBalance[action.id] = expectedLpBalance[action.id].add(action.amount);
        }
      }

      expect(await getLpBalanceOfAllUsers(), "lp balances don't match expected lp balances").to.be.eql(
        expectedLpBalance
      );
    }

    async function checkEqualRewards(userStakingData: UserStakeAction[][][], epochToCheck: number) {
      let expectedRewards: BN[][] = calcExpectedRewards(userStakingData, env.liqParams, epochToCheck);
      await setTime(startOfEpoch(env.liqParams, epochToCheck));
      let numUser = expectedRewards.length;
      for (let userId = 0; userId < numUser; userId++) {
        await redeemLiqRewards(env, wallets[userId]);
        approxBigNumber(
          await env.pendle.balanceOf(wallets[userId].address),
          expectedRewards[userId][0],
          BN.from(100), // 100 is much better than necessary, but usually the differences are 0
          false
        );
      }
    }

    async function checkEqualRewardsForEpochs(userStakingData: UserStakeAction[][][], epochToCheck: number) {
      for (let i = 0; i < 4; i++) {
        await checkEqualRewards(userStakingData, epochToCheck + i);
      }
    }

    it('test 2', async () => {
      let userStakingData = scenario.scenario04(env.liqParams);
      await doSequence(userStakingData);
      await checkEqualRewardsForEpochs(userStakingData, userStakingData.length + 1);
    });

    it('test 3', async () => {
      let userStakingData = scenario.scenario04(env.liqParams);
      await doSequence(userStakingData);
      await checkEqualRewardsForEpochs(userStakingData, userStakingData.length + 1);
    });

    it('test 4', async () => {
      let userStakingData = scenario.scenario06(env.liqParams);
      await doSequence(userStakingData);
      await checkEqualRewardsForEpochs(userStakingData, userStakingData.length + 1);
    });

    it('test 5', async () => {
      let userStakingData = scenario.scenario07(env.liqParams);
      await doSequence(userStakingData);
      await checkEqualRewardsForEpochs(userStakingData, userStakingData.length + 1);
    });

    it("this test shouldn't crash 1", async () => {
      const amountToStake: BN = await env.market.balanceOf(bob.address);

      await setTimeNextBlock(env.liqParams.START_TIME);
      await stake(env, bob, amountToStake);

      await setTimeNextBlock(env.liqParams.START_TIME.add(env.liqParams.EPOCH_DURATION));
      await withdraw(env, bob, amountToStake);
      await redeemLiqRewards(env, bob);
      await setTimeNextBlock(
        env.liqParams.START_TIME.add(env.liqParams.EPOCH_DURATION).add(env.liqParams.EPOCH_DURATION)
      );
      await redeemLiqRewards(env, bob);
    });

    it("this test shouldn't crash 2", async () => {
      const REF_AMOUNT = BN.from('1000000');
      await setTimeNextBlock(env.liqParams.START_TIME);
      await stake(env, alice, REF_AMOUNT);
      await withdraw(env, alice, REF_AMOUNT);

      await setTimeNextBlock(env.liqParams.START_TIME.add(env.liqParams.EPOCH_DURATION.mul(10)));

      await stake(env, wallets[1], REF_AMOUNT);
      await stake(env, wallets[0], REF_AMOUNT);
    });

    it('emergencyV2 test', async () => {
      await setTimeNextBlock(env.liqParams.START_TIME);
      await stake(env, alice, await env.market.balanceOf(alice.address));
      await env.pausingManagerLiqMiningV2.setLiqMiningLocked(env.liq.address);
      await env.liq.setUpEmergencyMode(eve.address, true);

      const rewardToken = env.pendle;
      const stakeToken = await getContract('IERC20', await env.liq.stakeToken());
      let yieldToken;

      if (mode == Mode.SLP_LIQ) {
        yieldToken = env.SUSHIContract;
      } else {
        yieldToken = env.JOEContract;
      }

      expect(
        (await rewardToken.allowance(await env.liq.address, eve.address)).gt(0) &&
          (await yieldToken.allowance(env.liq.address, eve.address)).gt(0) &&
          (await stakeToken.allowance(env.liq.address, eve.address)).gt(0)
      ).to.be.equal(true);
    });

    it('topUpRewards should work correctly', async () => {
      if (mode == Mode.JLP_LIQ) return;
      /// assuming current epoch is 1
      await env.pendle.connect(eve).transfer(alice.address, await env.pendle.balanceOf(eve.address));

      const amount = BN.from(10 ** 9);

      /// INVALID ARRAYS with different sizes
      await expect(env.liq.topUpRewards([2, 3, 4], [1, 2])).to.be.revertedWith(errMsg.INVALID_ARRAYS);

      await setTimeNextBlock((await env.liq.startTime()).add(1));

      /// INVALID EPOCH ID: 1
      await expect(env.liq.topUpRewards([1, 2, 3], [1, 2, 3])).to.be.revertedWith(errMsg.INVALID_EPOCH_ID);

      /// INVALID EPOCH ID: 99
      await expect(env.liq.topUpRewards([99, 2, 3], [1, 2, 3])).to.be.revertedWith(errMsg.INVALID_EPOCH_ID);

      const epochIdToAdd = [2, 6, 9, 12];
      const amountToTopUp = [amount, amount.mul(1), amount.mul(2), amount.mul(3)];

      await env.liq.topUpRewards(epochIdToAdd, amountToTopUp);
      for (let i = 0; i < epochIdToAdd.length; ++i) {
        const epoch = epochIdToAdd[i];
        const toppedUpReward = amountToTopUp[i];
        let reward: BN = (await env.liq.readEpochData(epoch, MiscConsts.ZERO_ADDRESS)).totalRewards;
        approxBigNumber(reward, env.liqParams.REWARDS_PER_EPOCH[epoch - 1].add(toppedUpReward), 0, true);
      }
    });

    it('stakeFor and withdrawTo', async () => {
      await emptyToken(env, env.yToken, dave);
      await emptyToken(env, env.pendle, alice);
      await emptyToken(env, env.pendle, charlie);

      await setTimeNextBlock(env.liqParams.START_TIME);

      const REF_AMOUNT = BN.from(100000);
      await stake(env, alice, REF_AMOUNT);
      await env.liq.connect(bob).stake(charlie.address, REF_AMOUNT);
      await advanceTime(MiscConsts.THREE_MONTH);
      await withdraw(env, alice, REF_AMOUNT);
      await env.liq.connect(charlie).withdraw(dave.address, REF_AMOUNT);
      await redeemLiqRewards(env, alice);
      await redeemLiqRewards(env, charlie);

      approxBigNumber(await env.yToken.balanceOf(dave.address), REF_AMOUNT, 0);

      approxByPercent(await env.pendle.balanceOf(charlie.address), await env.pendle.balanceOf(alice.address), 100000);
    });
  });
}

describe('SLP-liquidity-mining-rewards', function () {
  if (checkDisabled(Mode.SLP_LIQ)) return;
  runTest(Mode.SLP_LIQ);
});

describe('JLP-liquidity-mining-rewards', function () {
  if (checkDisabled(Mode.JLP_LIQ)) return;
  runTest(Mode.JLP_LIQ);
});
