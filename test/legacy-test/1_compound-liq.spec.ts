import { expect } from 'chai';
import { BigNumber as BN, Contract } from 'ethers';
import { checkDisabled, LiqParams, liquidityMiningFixture, Mode } from '../fixtures';
import { advanceTime, consts, evm_revert, evm_snapshot, getCContract, tokens } from '../helpers';

const { waffle } = require('hardhat');
const { loadFixture, provider } = waffle;

export async function runTest(mode: Mode) {
  describe('', async () => {
    const wallets = provider.getWallets();
    const [alice, bob, charlie, dave, eve] = wallets;
    let liq: Contract;
    let market: Contract;
    let pdl: Contract;
    let params: LiqParams;
    let cUSDT: Contract;
    let snapshotId: string;
    let globalSnapshotId: string;
    let EXPIRY: BN = consts.T0_C.add(consts.SIX_MONTH);
    before(async () => {
      const fixture = await loadFixture(liquidityMiningFixture);
      globalSnapshotId = await evm_snapshot();
      liq = fixture.cLiquidityMining;
      market = fixture.cMarket;
      params = fixture.params;
      pdl = fixture.pdl;
      cUSDT = await getCContract(alice, tokens.USDT);
      snapshotId = await evm_snapshot();
    });

    after(async () => {
      await evm_revert(globalSnapshotId);
    });

    beforeEach(async () => {
      await evm_revert(snapshotId);
      snapshotId = await evm_snapshot();
    });

    it('can stake and withdraw', async () => {
      const FIFTEEN_DAYS = consts.ONE_DAY.mul(15);

      const amountToStake = await market.balanceOf(bob.address); //1e17 LP = 0.1 LP

      const pdlBalanceOfContract = await pdl.balanceOf(liq.address);
      const pdlBalanceOfUser = await pdl.balanceOf(bob.address);
      const lpBalanceOfUser = await market.balanceOf(bob.address);

      console.log(`\tPDL balance of liq contract before: ${pdlBalanceOfContract}`);
      console.log(`\tPDL balance of user before: ${pdlBalanceOfUser}`);
      console.log(`\tLP balance of user before: ${lpBalanceOfUser}`);

      await advanceTime(params.START_TIME.sub(consts.T0_C));
      await liq.connect(bob).stake(EXPIRY, amountToStake, consts.HG);
      console.log('\tStaked');
      const lpHolderContract = await liq.lpHolderForExpiry(EXPIRY);
      const cTokenBalanceOfLpHolderContract = await cUSDT.balanceOf(lpHolderContract);
      const cTokenBalanceOfUser = await cUSDT.balanceOf(bob.address);
      console.log(
        `\t[LP interests] cUSDT balance of LpHolder after first staking = ${cTokenBalanceOfLpHolderContract}`
      );
      console.log(`\t[LP interests] cUSDT balance of User after first staking = ${cTokenBalanceOfUser}`);

      await advanceTime(FIFTEEN_DAYS);
      await liq.connect(bob).withdraw(EXPIRY, amountToStake.div(BN.from(2)), consts.HG);
      await liq.redeemRewards(EXPIRY, bob.address);

      const pdlBalanceOfContractAfter = await pdl.balanceOf(liq.address);
      const pdlBalanceOfUserAfter = await pdl.balanceOf(bob.address);
      const expectedPdlBalanceOfUserAfter = params.REWARDS_PER_EPOCH[0].div(4);
      console.log(`\tPDL balance of liq contract after: ${pdlBalanceOfContractAfter}`);
      console.log(`\tPDL balance of user after: ${pdlBalanceOfUserAfter}`);
      console.log(`\tExpected PDL balance of user after: ${expectedPdlBalanceOfUserAfter}`);

      // we need to do this properly
      expect(pdlBalanceOfUserAfter.toNumber()).to.be.approximately(
        expectedPdlBalanceOfUserAfter.toNumber(),
        expectedPdlBalanceOfUserAfter.toNumber() / 1000
      );

      //stake using another user - alice, for the same amount as bob's stake now (amountToStake/2)
      await liq.stake(EXPIRY, amountToStake.div(2), consts.HG);

      // Now we wait for another 15 days to withdraw (at the very start of epoch 4), then the rewards to be withdrawn for bob should be:
      // From epoch 1: rewardsForEpoch[0] * 2/4    ( 1/4 is released at start of epoch 3, 1/4 is released at start of epoch 4)
      // From epoch 2: (rewardsForEpoch[1]/2 + rewardsForEpoch[1]/2/2) * 2/4  ( first half: get all the rewards = rewardsForEpoch/2, 2nd half: get half)
      // From epoch 3: rewardsForEpoch[2]/2 * 1/4  ( two stakers with the same stake & duration => each gets rewardsForEpoch/2)
      //  Total: rewardsForEpoch[0] * 1/2 + rewardsForEpoch[1]*3/8 + rewardsForEpoch[2]*1/8)
      await advanceTime(FIFTEEN_DAYS);

      // console.log(`abi = ${liq.abi}`);
      // console.log(liq);

      const { interests } = await liq.callStatic.redeemLpInterests(EXPIRY, alice.address);
      const { rewards } = await liq.callStatic.redeemRewards(EXPIRY, alice.address);
      console.log(`\tInterests for alice = ${interests}`);
      console.log(`\tRewards available for epochs from now: ${rewards}`);

      await liq.connect(bob).withdraw(EXPIRY, amountToStake.div(BN.from(2)), consts.HG);
      await liq.redeemRewards(EXPIRY, bob.address);

      const pdlBalanceOfUserAfter2ndTnx = await pdl.balanceOf(bob.address);
      const expectedPdlBalanceOfUsersAfter2ndTnx = expectedPdlBalanceOfUserAfter.add(
        params.REWARDS_PER_EPOCH[0]
          .div(2)
          .add(params.REWARDS_PER_EPOCH[1].mul(3).div(8))
          .add(params.REWARDS_PER_EPOCH[2].div(8))
      );
      console.log(`\tPDL balance of user after 2nd withdraw: ${pdlBalanceOfUserAfter2ndTnx}`);
      console.log(`\tExpected PDL balance of user after 2nd withdraw: ${expectedPdlBalanceOfUsersAfter2ndTnx}`);

      expect(pdlBalanceOfUserAfter2ndTnx.toNumber()).to.be.approximately(
        expectedPdlBalanceOfUsersAfter2ndTnx.toNumber(),
        expectedPdlBalanceOfUsersAfter2ndTnx.toNumber() / 1000
      );

      await liq.withdraw(EXPIRY, amountToStake.div(2), consts.HG);
      const cTokenBalanceOfLpHolderContractAfter = await cUSDT.balanceOf(lpHolderContract);
      const cTokenBalanceOfUserAfter = await cUSDT.balanceOf(bob.address);

      //now, the LP holding contract should hold almost 0 cUSDT. This means that we have calculated and gave the Lp interests back to the users properly
      console.log(
        `\t[LP interests] cUSDT balance of LpHolder after withdrawing all = ${cTokenBalanceOfLpHolderContractAfter}`
      );
      console.log(`\t[LP interests] cUSDT balance of user after withdrawing all = ${cTokenBalanceOfUserAfter}`);
    });
  });
}

describe('compound-liquidityMining', function () {
  if (checkDisabled(Mode.COMPOUND)) return;
  runTest(Mode.COMPOUND);
});
