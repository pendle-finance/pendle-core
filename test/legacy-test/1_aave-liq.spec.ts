import chai, { expect } from 'chai';
import { solidity } from 'ethereum-waffle';
import { BigNumber as BN } from 'ethers';
import {
  checkDisabled,
  liquidityMiningFixture,
  LiquidityMiningFixture,
  Mode,
  parseTestEnvLiquidityMiningFixture,
  TestEnv,
} from '../fixtures';
import {
  advanceTime,
  approxBigNumber,
  consts,
  emptyToken,
  errMsg,
  evm_revert,
  evm_snapshot,
  redeemDueInterests,
  redeemLpInterests,
  redeemRewards,
  setTimeNextBlock,
  stake,
  withdraw,
} from '../helpers';
const { waffle } = require('hardhat');
chai.use(solidity);

const { loadFixture, provider } = waffle;

export async function runTest(mode: Mode) {
  describe('', async () => {
    const wallets = provider.getWallets();
    const [alice, bob, charlie, dave, eve] = wallets;
    let snapshotId: string;
    let globalSnapshotId: string;
    let env: TestEnv = {} as TestEnv;

    async function buildTestEnv() {
      let fixture: LiquidityMiningFixture = await loadFixture(liquidityMiningFixture);
      await parseTestEnvLiquidityMiningFixture(alice, Mode.AAVE_V2, env, fixture);
      env.TEST_DELTA = BN.from(60000);
    }

    before(async () => {
      await buildTestEnv();
      globalSnapshotId = await evm_snapshot();

      // await env.data.setInterestUpdateRateDeltaForMarket(BN.from(0));
      for (let user of [bob, charlie, dave]) {
        await redeemDueInterests(env, user);
        await emptyToken(env.yToken, user);
        await emptyToken(env.xyt, user);
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

    // Bob, Dave and Charlie all starts with 0 AUSDTs and 0 XYTs in their wallet
    // Both Bob and Dave has 10% of LP of the Market
    //  - Charlie will receive XYTs equivalent to 10% of whats in the market, and hold it
    //  - Dave just holds the LP tokens
    //  - Bob stake the LP tokens into liq-mining contract, in two transactions
    //=> after 2 months, all three of them should get the same interests
    it('Staking to LP mining, holding LP tokens & holding equivalent XYTs should get same interests', async () => {
      const INITIAL_LP_AMOUNT: BN = await env.market.balanceOf(bob.address);
      await setTimeNextBlock(env.liqParams.START_TIME.add(100));
      const xytBalanceOfMarket = await env.xyt.balanceOf(env.market.address);

      // Charlie holds same equivalent amount of XYTs as 10% of the market
      // which is the same as what Bob and Dave holds
      await env.xyt.transfer(charlie.address, (await env.xyt.balanceOf(env.market.address)).div(10));

      let preBalanceBob = await env.yToken.balanceOf(bob.address);
      let preBalanceDave = await env.yToken.balanceOf(dave.address);
      let preBalanceCharlie = await env.yToken.balanceOf(charlie.address);

      await stake(env, alice, INITIAL_LP_AMOUNT); // Alice also stake into liq-mining
      await stake(env, bob, INITIAL_LP_AMOUNT.div(2));
      await redeemRewards(env, bob);

      await setTimeNextBlock(env.liqParams.START_TIME.add(consts.ONE_MONTH));

      await stake(env, bob, INITIAL_LP_AMOUNT.div(2));

      await setTimeNextBlock(env.liqParams.START_TIME.add(consts.ONE_MONTH.mul(2)));
      await env.liq.redeemLpInterests(env.EXPIRY, bob.address, consts.HG);
      await redeemLpInterests(env, bob);
      await env.liq.redeemLpInterests(env.EXPIRY, bob.address, consts.HG);
      let actualGainBob = (await env.yToken.balanceOf(bob.address)).sub(preBalanceBob);

      await redeemDueInterests(env, charlie);
      const actualGainCharlie = (await env.yToken.balanceOf(charlie.address)).sub(preBalanceCharlie);
      // no redeemLpInterests for charlie since we are not caring about lpInterest for him

      await redeemLpInterests(env, dave);
      let actualGainDave = (await env.yToken.balanceOf(dave.address)).sub(preBalanceDave);

      // console.log(actualGainCharlie.toString(), actualGainDave.toString());
      approxBigNumber(actualGainBob, actualGainDave, consts.TEST_TOKEN_DELTA);
      approxBigNumber(actualGainCharlie, actualGainDave, consts.TEST_TOKEN_DELTA);
    });

    it('test invalid setAllocationSetting', async () => {
      await expect(
        env.liq.setAllocationSetting(
          [env.EXPIRY, env.T0.add(consts.THREE_MONTH), env.T0.add(consts.ONE_MONTH)],
          [
            env.liqParams.TOTAL_NUMERATOR.div(3),
            env.liqParams.TOTAL_NUMERATOR.div(3),
            env.liqParams.TOTAL_NUMERATOR.div(3),
          ],
          consts.HG
        )
      ).to.be.revertedWith(errMsg.INVALID_ALLOCATION);
    });

    it('can stake and withdraw', async () => {
      const FIFTEEN_DAYS = consts.ONE_DAY.mul(15);

      const amountToStake = await env.market.balanceOf(bob.address);

      const pdlBalanceOfContract = await env.pdl.balanceOf(env.liq.address);
      const pdlBalanceOfUser = await env.pdl.balanceOf(bob.address);
      const lpBalanceOfUser = await env.market.balanceOf(bob.address);

      console.log(`\tPDL balance of liq contract before: ${pdlBalanceOfContract}`);
      console.log(`\tPDL balance of user before: ${pdlBalanceOfUser}`);
      console.log(`\tLP balance of user before: ${lpBalanceOfUser}`);

      await advanceTime(env.liqParams.START_TIME.sub(env.T0));
      await stake(env, bob, amountToStake);
      console.log('\tStaked');
      const lpHolderContract = await env.liq.lpHolderForExpiry(env.EXPIRY);
      const aTokenBalanceOfLpHolderContract = await env.yToken.balanceOf(lpHolderContract);
      const aTokenBalanceOfUser = await env.yToken.balanceOf(bob.address);
      console.log(
        `\t[LP interests] aUSDT balance of LpHolder after first staking = ${aTokenBalanceOfLpHolderContract}`
      );
      console.log(`\t[LP interests] aUSDT balance of User after first staking = ${aTokenBalanceOfUser}`);

      await advanceTime(FIFTEEN_DAYS);
      await withdraw(env, bob, amountToStake.div(2));
      await redeemRewards(env, bob);

      const pdlBalanceOfContractAfter = await env.pdl.balanceOf(env.liq.address);
      const pdlBalanceOfUserAfter = await env.pdl.balanceOf(bob.address);
      const expectedPdlBalanceOfUserAfter = env.liqParams.REWARDS_PER_EPOCH[0].div(4);
      console.log(`\tPDL balance of liq contract after: ${pdlBalanceOfContractAfter}`);
      console.log(`\tPDL balance of user after: ${pdlBalanceOfUserAfter}`);
      console.log(`\tExpected PDL balance of user after: ${expectedPdlBalanceOfUserAfter}`);

      // we need to do this properly
      expect(pdlBalanceOfUserAfter.toNumber()).to.be.approximately(
        expectedPdlBalanceOfUserAfter.toNumber(),
        expectedPdlBalanceOfUserAfter.toNumber() / 1000
      );

      console.log(`\t\t\t lpHolderContract aToken bal = ${await env.yToken.balanceOf(lpHolderContract)}`);

      //stake using another user - alice, for the same amount as bob's stake now (amountToStake/2)
      await stake(env, alice, amountToStake.div(2));

      // Now we wait for another 15 days to withdraw (at the very start of epoch 4), then the rewards to be withdrawn for bob should be:
      // From epoch 1: rewardsForEpoch * 2/4    ( 1/4 is released at start of epoch 3, 1/4 is released at start of epoch 4)
      // From epoch 2: (rewardsForEpoch/2 + rewardsForEpoch/2/2) * 2/4  ( first half: get all the rewards = rewardsForEpoch/2, 2nd half: get half)
      // From epoch 3: rewardsForEpoch/2 * 1/4  ( two stakers with the same stake & duration => each gets rewardsForEpoch/2)
      //  Total: rewardsForEpoch * (1/2 + 3/8 + 1/8) = rewardsForEpoch
      await advanceTime(FIFTEEN_DAYS);

      await withdraw(env, bob, amountToStake.div(2));
      await redeemRewards(env, bob);

      const pdlBalanceOfUserAfter2ndTnx = await env.pdl.balanceOf(bob.address);
      const expectedPdlBalanceOfUsersAfter2ndTnx = expectedPdlBalanceOfUserAfter.add(
        env.liqParams.REWARDS_PER_EPOCH[0]
          .div(2)
          .add(env.liqParams.REWARDS_PER_EPOCH[1].mul(3).div(8))
          .add(env.liqParams.REWARDS_PER_EPOCH[2].div(8))
      );

      console.log(`\tPDL balance of user after 2nd withdraw: ${pdlBalanceOfUserAfter2ndTnx}`);
      console.log(`\tExpected PDL balance of user after 2nd withdraw: ${expectedPdlBalanceOfUsersAfter2ndTnx}`);

      console.log(`\t\t\t lpHolderContract aToken bal = ${await env.yToken.balanceOf(lpHolderContract)}`);

      expect(pdlBalanceOfUserAfter2ndTnx.toNumber()).to.be.approximately(
        expectedPdlBalanceOfUsersAfter2ndTnx.toNumber(),
        expectedPdlBalanceOfUsersAfter2ndTnx.toNumber() / 1000
      );

      await withdraw(env, alice, amountToStake.div(2));
      await redeemRewards(env, bob);

      const aTokenBalanceOfLpHolderContractAfter = await env.yToken.balanceOf(lpHolderContract);
      const aTokenBalanceOfUserAfter = await env.yToken.balanceOf(bob.address);

      //now, the LP holding contract should hold almost 0 env.yToken. This means that we have calculated and gave the Lp interests back to the users properly
      console.log(
        `\t[LP interests] aUSDT balance of LpHolder after withdrawing all = ${aTokenBalanceOfLpHolderContractAfter}`
      );
      console.log(`\t[LP interests] aUSDT balance of user after withdrawing all = ${aTokenBalanceOfUserAfter}`);
    });
  });
}

describe('aave-liquidityMining', function () {
  if (checkDisabled(Mode.AAVE_V2)) return;
  runTest(Mode.AAVE_V2);
});
