import { assert, expect } from 'chai';
import { BigNumber as BN } from 'ethers';
import { waffle } from 'hardhat';
import {
  approxBigNumber,
  calcExpectedRewards,
  consts,


  evm_revert,
  evm_snapshot,


  redeemRewards,
  setTime,
  setTimeNextBlock,
  stake,
  startOfEpoch,
  withdraw
} from '../../helpers';
import {
  liquidityMiningFixture,
  LiquidityMiningFixture,
  Mode,
  parseTestEnvLiquidityMiningFixture,
  TestEnv,
  UserStakeAction
} from '../fixtures';
import * as scenario from '../fixtures/liquidityMiningScenario.fixture';

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
          [env.EXPIRY, consts.T0_A2.add(consts.THREE_MONTH)],
          [alloc_setting[currentEpoch], env.liqParams.TOTAL_NUMERATOR.sub(alloc_setting[currentEpoch])],
          consts.HIGH_GAS_OVERRIDE
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
      let expectedRewards: BN[][] = calcExpectedRewards(userStakingData, env.liqParams, epochToCheck, usingAllocationSetting);
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
  });
}
