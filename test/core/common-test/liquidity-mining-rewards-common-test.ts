import { assert, expect } from 'chai';
import { createFixtureLoader } from 'ethereum-waffle';
import { BigNumber as BN } from 'ethers';
import {
  advanceTime,
  approxBigNumber,
  calcExpectedRewards,
  consts,
  emptyToken,
  errMsg,
  evm_revert,
  evm_snapshot,
  redeemDueInterests,
  redeemLpInterests,
  redeemRewards,
  setTime,
  setTimeNextBlock,
  stake,
  startOfEpoch,
  withdraw,
} from '../../helpers';
import {
  liquidityMiningFixture,
  LiquidityMiningFixture,
  Mode,
  parseTestEnvLiquidityMiningFixture,
  TestEnv,
  UserStakeAction,
} from '../fixtures';
import * as scenario from '../fixtures/liquidityMiningScenario.fixture';

const { waffle } = require('hardhat');
const { provider } = waffle;

export function runTest(mode: Mode) {
  describe('', async () => {
    const wallets = provider.getWallets();
    const loadFixture = createFixtureLoader(wallets, provider);
    const [alice, bob, charlie, dave, eve] = wallets;
    let snapshotId: string;
    let globalSnapshotId: string;
    let env: TestEnv = {} as TestEnv;

    async function buildTestEnv() {
      let fixture: LiquidityMiningFixture = await loadFixture(liquidityMiningFixture);
      await parseTestEnvLiquidityMiningFixture(alice, mode, env, fixture);
    }

    before(async () => {
      globalSnapshotId = await evm_snapshot();
      await buildTestEnv();
      snapshotId = await evm_snapshot();
    });

    after(async () => {
      await evm_revert(globalSnapshotId);
    });

    beforeEach(async () => {
      await evm_revert(snapshotId);
      snapshotId = await evm_snapshot();
    });

    async function getLpBalanceOfAllUsers(): Promise<BN[]> {
      let res: BN[] = [];
      for (let i = 0; i < wallets.length; i++) {
        res.push(await env.market.balanceOf(wallets[i].address));
      }
      return res;
    }

    // [epochs][user][transaction]

    async function doSequence(userStakingData: UserStakeAction[][][]) {
      let flatData: UserStakeAction[] = [];
      let expectedLpBalance: BN[] = await getLpBalanceOfAllUsers();

      userStakingData.forEach((epochData) => {
        epochData.forEach((userData) => {
          userData.forEach((userAction) => {
            if (userAction.id != -1) {
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
      _allocationRateDiv?: number
    ) {
      let expectedRewards: BN[][] = calcExpectedRewards(userStakingData, env.liqParams, epochToCheck);
      await setTime(startOfEpoch(env.liqParams, epochToCheck));
      let numUser = expectedRewards.length;
      let allocationRateDiv = _allocationRateDiv !== undefined ? _allocationRateDiv : 1;
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
      _allocationRateDiv?: number
    ) {
      for (let i = 0; i < 4; i++) {
        await checkEqualRewards(userStakingData, epochToCheck + i, _allocationRateDiv);
      }
    }

    it('should be able to receive enough PENDLE rewards - test 2', async () => {
      let userStakingData: UserStakeAction[][][] = scenario.scenario04(env.liqParams);
      await doSequence(userStakingData);
      await checkEqualRewardsForEpochs(userStakingData, userStakingData.length + 1);
    });

    it('should be able to receive enough PENDLE rewards - test 3', async () => {
      await env.liq.setAllocationSetting(
        [env.EXPIRY, consts.T0.add(consts.THREE_MONTH)],
        [env.liqParams.TOTAL_NUMERATOR.div(2), env.liqParams.TOTAL_NUMERATOR.div(2)],
        consts.HIGH_GAS_OVERRIDE
      );
      let userStakingData: UserStakeAction[][][] = scenario.scenario04(env.liqParams);
      await doSequence(userStakingData);
      await checkEqualRewardsForEpochs(userStakingData, userStakingData.length + 1, 2);
    });

    it('should be able to receive enough PENDLE rewards - test 4', async () => {
      await env.liq.setAllocationSetting(
        [env.EXPIRY, consts.T0.add(consts.THREE_MONTH)],
        [env.liqParams.TOTAL_NUMERATOR.div(2), env.liqParams.TOTAL_NUMERATOR.div(2)],
        consts.HIGH_GAS_OVERRIDE
      );
      let userStakingData: UserStakeAction[][][] = scenario.scenario06(env.liqParams);
      await doSequence(userStakingData);
      await checkEqualRewardsForEpochs(userStakingData, userStakingData.length + 1, 2);
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
