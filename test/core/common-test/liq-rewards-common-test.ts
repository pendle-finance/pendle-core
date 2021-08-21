import { assert, expect } from 'chai';
import { BigNumber as BN } from 'ethers';
import {
  liquidityMiningFixture,
  LiquidityMiningFixture,
  Mode,
  parseTestEnvLiquidityMiningFixture,
  TestEnv,
  UserStakeAction,
} from '../../fixtures';
import * as scenario from '../../fixtures/liquidityMiningScenario.fixture';
import {
  approxBigNumber,
  calcExpectedRewards,
  consts,
  errMsg,
  evm_revert,
  evm_snapshot,
  redeemRewards,
  setTime,
  setTimeNextBlock,
  stake,
  stakeWithPermit,
  startOfEpoch,
  withdraw,
} from '../../helpers';
const { waffle } = require('hardhat');

const { loadFixture, provider } = waffle;

export function runTest(mode: Mode) {
  describe('', async () => {
    const wallets = provider.getWallets();
    const [alice, bob, charlie, dave, eve] = wallets;
    let snapshotId: string;
    let globalSnapshotId: string;
    let env: TestEnv = {} as TestEnv;
    let currentEpoch: number;
    let alloc_setting: BN[];

    async function buildTestEnv() {
      let fixture: LiquidityMiningFixture = await loadFixture(liquidityMiningFixture);
      await parseTestEnvLiquidityMiningFixture(alice, mode, env, fixture);
    }

    before(async () => {
      await buildTestEnv();
      globalSnapshotId = await evm_snapshot();
      snapshotId = await evm_snapshot();
      alloc_setting = env.liqParams.ALLOCATION_SETTING;
    });

    after(async () => {
      await evm_revert(globalSnapshotId);
    });

    beforeEach(async () => {
      await evm_revert(snapshotId);
      snapshotId = await evm_snapshot();
      currentEpoch = 1;
    });

    async function getLpBalanceOfAllUsers(): Promise<BN[]> {
      let res: BN[] = [];
      for (let i = 0; i < wallets.length; i++) {
        res.push(await env.market.balanceOf(wallets[i].address));
      }
      return res;
    }

    // [epochs][user][transaction]

    async function allocSettingForEpoch() {
      currentEpoch += 1;
      if (alloc_setting[currentEpoch].toString() != alloc_setting[currentEpoch - 1].toString()) {
        await setTimeNextBlock(startOfEpoch(env.liqParams, currentEpoch).sub(consts.ONE_HOUR.div(4)));
        await env.liq.setAllocationSetting(
          [env.EXPIRY, env.T0.add(consts.THREE_MONTH)],
          [alloc_setting[currentEpoch], env.liqParams.TOTAL_NUMERATOR.sub(alloc_setting[currentEpoch])],
          consts.HG
        );
      }
    }

    async function doSequence(userStakingData: UserStakeAction[][][], usingAllocationSetting?: Boolean) {
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
        let action: UserStakeAction = flatData[i];
        if (i != 0) assert(flatData[i - 1].time < flatData[i].time);

        while (usingAllocationSetting && currentEpoch < flatEpochId[i]) {
          await allocSettingForEpoch();
        }

        await setTimeNextBlock(action.time);

        if (action.isStaking) {
          await stake(env, wallets[action.id], action.amount);
          expectedLpBalance[action.id] = expectedLpBalance[action.id].sub(action.amount);
        } else {
          await withdraw(env, wallets[action.id], action.amount);
          expectedLpBalance[action.id] = expectedLpBalance[action.id].add(action.amount);
        }
      }

      /* check Lp balances*/
      let actualLpBalance: BN[] = await getLpBalanceOfAllUsers();
      expect(expectedLpBalance, "lp balances don't match expected lp balances").to.be.eql(actualLpBalance);
    }

    async function checkEqualRewards(
      userStakingData: UserStakeAction[][][],
      epochToCheck: number,
      usingAllocationSetting: Boolean
    ) {
      let expectedRewards: BN[][] = calcExpectedRewards(
        userStakingData,
        env.liqParams,
        epochToCheck,
        usingAllocationSetting
      );
      await setTime(startOfEpoch(env.liqParams, epochToCheck));
      let numUser = expectedRewards.length;
      let allocationRateDiv = 1;
      for (let userId = 0; userId < numUser; userId++) {
        await redeemRewards(env, wallets[userId]);
        approxBigNumber(
          await env.pdl.balanceOf(wallets[userId].address),
          expectedRewards[userId][0].div(allocationRateDiv),
          BN.from(100), // 100 is much better than necessary, but usually the differences are 0
          false
        );
      }
    }

    async function checkEqualRewardsForEpochs(
      userStakingData: UserStakeAction[][][],
      epochToCheck: number,
      usingAllocationSetting: Boolean
    ) {
      for (let i = 0; i < 4; i++) {
        let epoch = epochToCheck + i;
        while (usingAllocationSetting && currentEpoch < epoch) {
          await allocSettingForEpoch();
        }
        await checkEqualRewards(userStakingData, epochToCheck + i, usingAllocationSetting);
      }
    }

    it('test 2', async () => {
      let userStakingData: UserStakeAction[][][] = scenario.scenario04(env.liqParams);
      await doSequence(userStakingData);
      await checkEqualRewardsForEpochs(userStakingData, userStakingData.length + 1, false);
    });

    it('test 3', async () => {
      let userStakingData: UserStakeAction[][][] = scenario.scenario04(env.liqParams);
      await doSequence(userStakingData, true);
      await checkEqualRewardsForEpochs(userStakingData, userStakingData.length + 1, true);
    });

    it('test 4', async () => {
      let userStakingData: UserStakeAction[][][] = scenario.scenario06(env.liqParams);
      await doSequence(userStakingData, true);
      await checkEqualRewardsForEpochs(userStakingData, userStakingData.length + 1, true);
    });

    it('test 5', async () => {
      let userStakingData: UserStakeAction[][][] = scenario.scenario07(env.liqParams);
      await doSequence(userStakingData);
      await checkEqualRewardsForEpochs(userStakingData, userStakingData.length + 1, false);
    });

    it("this test shouldn't crash", async () => {
      const amountToStake = await env.market.balanceOf(bob.address);

      await setTimeNextBlock(env.liqParams.START_TIME);
      await stake(env, bob, amountToStake);

      await setTimeNextBlock(env.liqParams.START_TIME.add(env.liqParams.EPOCH_DURATION));
      await withdraw(env, bob, amountToStake);
      await redeemRewards(env, bob);
      await setTimeNextBlock(
        env.liqParams.START_TIME.add(env.liqParams.EPOCH_DURATION).add(env.liqParams.EPOCH_DURATION)
      );
      await redeemRewards(env, bob);
    });

    it('topUpRewards should work correctly', async () => {
      /// assuming current epoch is 1
      await env.pdl.connect(eve).transfer(alice.address, await env.pdl.balanceOf(eve.address));

      const amount = BN.from(10 ** 9);

      /// INVALID ARRAYS with different sizes
      await expect(env.liq.topUpRewards([2, 3, 4], [1, 2])).to.be.revertedWith(errMsg.INVALID_ARRAYS);

      await setTimeNextBlock((await env.liq.startTime()).add(1));

      /// INVALID EPOCH ID: 1
      await expect(env.liq.topUpRewards([1, 2, 3], [1, 2, 3])).to.be.revertedWith(errMsg.INVALID_EPOCH_ID);

      /// INVALID EPOCH ID: 99
      await expect(env.liq.topUpRewards([99, 2, 3], [1, 2, 3])).to.be.revertedWith(errMsg.INVALID_EPOCH_ID);

      /// INVALID EPOCH ID: sumReward = 0
      /// Question: It's an onlyGoverance function but technically we can fill in negative integers but still get away from this error
      await expect(env.liq.topUpRewards([2, 3, 4], [0, 0, 0])).to.be.revertedWith(errMsg.ZERO_FUND);

      const epochIdToAdd = [2, 6, 9, 12];
      const amountToTopUp = [amount, amount.mul(1), amount.mul(2), amount.mul(3)];

      await env.liq.topUpRewards(epochIdToAdd, amountToTopUp);
      for (let i = 0; i < epochIdToAdd.length; ++i) {
        const epoch = epochIdToAdd[i];
        const toppedUpReward = amountToTopUp[i];
        let reward: BN = (await env.liq.readEpochData(epoch)).totalRewards;
        approxBigNumber(reward, env.liqParams.REWARDS_PER_EPOCH[epoch - 1].add(toppedUpReward), 0, true);
      }
    });

    it('stakeWithPermit test', async () => {
      // reverted with this message means the permitting process has finished
      await expect(stakeWithPermit(env, bob, BN.from(1000))).to.be.revertedWith(errMsg.NOT_STARTED);
    });

    it('Read functions should work correctly', async () => {
      await setTimeNextBlock((await env.liq.startTime()).add(1));
      await env.liq.readStakeUnitsForUser(1, alice.address, env.EXPIRY);
      await env.liq.readAvailableRewardsForUser(1, alice.address);
      await env.liq.readExpirySpecificEpochData(1, env.EXPIRY);
      await env.liq.totalRewardsForEpoch(1);
      await env.liq.readUserExpiries(alice.address);
      await env.liq.getBalances(env.EXPIRY, alice.address);
      await env.liq.lpHolderForExpiry(env.EXPIRY);
      await env.liq.readExpiryData(env.EXPIRY);
      await env.liq.readUserSpecificExpiryData(env.EXPIRY, alice.address);
      await env.liq.readAllExpiriesLength();
    });
  });
}
