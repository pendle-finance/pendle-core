import chai, { expect } from 'chai';
import { solidity } from 'ethereum-waffle';
import { BigNumber as BN, Wallet } from 'ethers';
import { checkDisabled, Mode, parseTestEnvRouterFixture, routerFixture, RouterFixture, TestEnv } from '../fixtures';
import {
  amountToWei,
  approxBigNumber,
  consts,
  errMsg,
  evm_revert,
  evm_snapshot,
  mintAaveV2Token,
  redeemAfterExpiry,
  redeemDueInterests,
  redeemUnderlying,
  setTime,
  setTimeNextBlock,
  Token,
  tokenizeYield,
  tokens,
} from '../helpers';
const { waffle } = require('hardhat');
chai.use(solidity);

const { loadFixture, provider } = waffle;

export async function runTest(mode: Mode) {
  describe('', async () => {
    const wallets = provider.getWallets();
    const [alice, bob, charlie, dave] = wallets;

    let snapshotId: string;
    let globalSnapshotId: string;
    let refAmount: BN;
    let USDT: Token;
    let initialAUSDTbalance: BN;
    let env: TestEnv = {} as TestEnv;

    async function buildTestEnv() {
      let fixture: RouterFixture = await loadFixture(routerFixture);
      await parseTestEnvRouterFixture(alice, Mode.AAVE_V2, env, fixture);
      USDT = tokens.USDT;
      env.TEST_DELTA = BN.from(10000);
    }

    before(async () => {
      await buildTestEnv();
      globalSnapshotId = await evm_snapshot();
      refAmount = amountToWei(env.INITIAL_YIELD_TOKEN_AMOUNT, 6);
      snapshotId = await evm_snapshot();
    });

    after(async () => {
      await evm_revert(globalSnapshotId);
    });

    beforeEach(async () => {
      await evm_revert(snapshotId);
      snapshotId = await evm_snapshot();
      initialAUSDTbalance = await env.yToken.balanceOf(alice.address);
    });

    async function startCalInterest(walletToUse: Wallet, initialAmount: BN) {
      // divide by 10^decimal since mintAaveV2Token will multiply that number back
      await mintAaveV2Token(USDT, walletToUse, initialAmount.div(10 ** USDT.decimal));
    }

    async function getCurInterest(walletToUse: Wallet, initialAmount: BN): Promise<BN> {
      return (await env.yToken.balanceOf(walletToUse.address)).sub(initialAmount);
    }

    it("OT & XYT's underlyingAsset's address should be correct", async () => {
      expect((await env.ot.underlyingAsset()).toLowerCase()).to.be.equal(tokens.USDT.address.toLowerCase());
      expect((await env.xyt.underlyingAsset()).toLowerCase()).to.be.equal(tokens.USDT.address.toLowerCase());
    });

    it('newYieldContract is not possible [if the expiry is in the past ]', async () => {
      let futureTime = env.T0.sub(consts.ONE_MONTH);
      await expect(env.router.newYieldContracts(env.FORGE_ID, USDT.address, futureTime)).to.be.revertedWith(
        errMsg.INVALID_EXPIRY
      );
    });

    it('newYieldContract is not possible [if the expiry is not divisible for expiryDivisor]', async () => {
      let futureTime = env.T0.add(consts.ONE_YEAR);
      if (futureTime.mod(await env.data.expiryDivisor()).eq(0)) {
        futureTime = futureTime.add(1);
      }
      await expect(env.router.newYieldContracts(env.FORGE_ID, USDT.address, futureTime)).to.be.revertedWith(
        errMsg.INVALID_EXPIRY
      );
    });

    it('tokenizeYield', async () => {
      console.log(`aUSDT balance = ${await env.yToken.balanceOf(alice.address)}`);
      let amount = await tokenizeYield(env, alice, refAmount);
      const balanceOwnershipToken = await env.ot.balanceOf(alice.address);
      const balanceFutureYieldToken = await env.xyt.balanceOf(alice.address);
      expect(balanceOwnershipToken).to.be.eq(amount);
      expect(balanceFutureYieldToken).to.be.eq(amount);
    });

    it('redeemUnderlying is not possible [if the yield contract has expired]', async () => {
      await tokenizeYield(env, alice, refAmount);

      await setTimeNextBlock(env.T0.add(consts.ONE_YEAR));

      await expect(redeemUnderlying(env, alice, refAmount)).to.be.revertedWith(errMsg.YIELD_CONTRACT_EXPIRED);
    });

    it('redeemUnderlying [after 1 month]', async () => {
      await startCalInterest(charlie, refAmount);
      let amount = await tokenizeYield(env, alice, refAmount);
      await setTimeNextBlock(env.T0.add(consts.ONE_MONTH));

      await redeemUnderlying(env, alice, amount);

      const finalAUSDTbalance = await env.yToken.balanceOf(alice.address);

      const expectedGain = await getCurInterest(charlie, refAmount);
      expect(finalAUSDTbalance.toNumber()).to.be.approximately(initialAUSDTbalance.add(expectedGain).toNumber(), 10000);
    });

    it('redeemDueInterests [after 1 month]', async () => {
      await startCalInterest(charlie, refAmount);
      await tokenizeYield(env, alice, refAmount);

      await env.ot.transfer(bob.address, await env.ot.balanceOf(alice.address));

      const afterLendingAUSDTbalance = await env.yToken.balanceOf(alice.address);

      await setTimeNextBlock(env.T0.add(consts.ONE_MONTH));

      await redeemDueInterests(env, alice);

      const expectedGain = await getCurInterest(charlie, refAmount);
      const finalAUSDTbalance = await env.yToken.balanceOf(alice.address);

      expect(finalAUSDTbalance.toNumber()).to.be.below(initialAUSDTbalance.toNumber());
      expect(finalAUSDTbalance.toNumber()).to.be.approximately(
        afterLendingAUSDTbalance.add(expectedGain).toNumber(),
        10000
      );
    });

    it('Anybody holding XYTs can redeemDueInterests from it', async () => {
      await startCalInterest(charlie, refAmount);

      let amount = await tokenizeYield(env, alice, refAmount);
      await env.xyt.transfer(bob.address, amount);

      const T1 = env.EXPIRY.sub(1);
      await setTimeNextBlock(T1);

      await redeemDueInterests(env, bob);

      const actualGain = await env.yToken.balanceOf(bob.address);
      const expectedGain = await getCurInterest(charlie, refAmount);

      expect(actualGain.toNumber()).to.be.approximately(expectedGain.toNumber(), 10000);
    });

    it('redeemAfterExpiry [short after expiry]', async () => {
      await startCalInterest(charlie, refAmount);

      let amount = await tokenizeYield(env, alice, refAmount);
      await env.xyt.transfer(bob.address, amount);

      const T1 = env.EXPIRY.sub(1);
      await setTimeNextBlock(T1);

      await redeemDueInterests(env, bob);

      approxBigNumber(
        await env.yToken.balanceOf(bob.address),
        await getCurInterest(charlie, refAmount),
        env.TEST_DELTA,
        false
      );

      await startCalInterest(dave, refAmount);

      const T2 = T1.add(10);
      await setTimeNextBlock(T2);

      await redeemAfterExpiry(env, alice);

      const expectedGain = await getCurInterest(dave, refAmount);
      const finalAUSDTbalance = await env.yToken.balanceOf(alice.address);
      approxBigNumber(finalAUSDTbalance, initialAUSDTbalance.add(expectedGain), env.TEST_DELTA);
    });

    it('redeemAfterExpiry [1 month after expiry]', async () => {
      await startCalInterest(charlie, refAmount);
      let amount = await tokenizeYield(env, alice, refAmount);
      await env.xyt.transfer(bob.address, amount);

      const T1 = env.EXPIRY.sub(1);
      await setTimeNextBlock(T1);

      await redeemDueInterests(env, bob);

      await startCalInterest(dave, refAmount);
      approxBigNumber(
        await env.yToken.balanceOf(bob.address),
        await getCurInterest(charlie, refAmount),
        env.TEST_DELTA
      );

      const T2 = T1.add(consts.ONE_MONTH);
      await setTimeNextBlock(T2);

      await redeemAfterExpiry(env, alice);

      const expectedGain = await getCurInterest(dave, refAmount);
      const finalAUSDTbalance = await env.yToken.balanceOf(alice.address);
      approxBigNumber(finalAUSDTbalance, initialAUSDTbalance.add(expectedGain), env.TEST_DELTA, true);
    });

    it('newYieldContracts', async () => {
      let futureTime = env.EXPIRY.add(consts.ONE_DAY);
      let filter = env.forge.filters.NewYieldContracts();
      let tx = await env.router.newYieldContracts(env.FORGE_ID, USDT.address, futureTime);

      let allEvents = await env.forge.queryFilter(filter, tx.blockHash);
      expect(allEvents.length).to.be.eq(3); // there is two events of the same type before this event
      expect(allEvents[allEvents.length - 1].args!.ot).to.not.eq(0);
      expect(allEvents[allEvents.length - 1].args!.xyt).to.not.eq(0);
      expect(allEvents[allEvents.length - 1].args!.expiry).to.eq(futureTime);
    });

    it('renewYield', async () => {
      await env.router.newYieldContracts(env.FORGE_ID, USDT.address, env.T0.add(consts.ONE_YEAR));
      await startCalInterest(dave, refAmount);
      await tokenizeYield(env, alice, refAmount);
      await setTime(env.T0.add(consts.ONE_MONTH.mul(7)));

      let { amountRenewed } = await env.router.callStatic.renewYield(
        env.FORGE_ID,
        env.EXPIRY,
        USDT.address,
        env.T0.add(consts.ONE_YEAR),
        consts.RONE.div(2), // 50%
        consts.HG
      );

      await env.router.renewYield(
        env.FORGE_ID,
        env.EXPIRY,
        USDT.address,
        env.T0.add(consts.ONE_YEAR),
        consts.RONE.div(2),
        consts.HG
      );

      await setTimeNextBlock(env.T0.add(consts.ONE_MONTH.mul(11)));
      await redeemDueInterests(env, alice, env.T0.add(consts.ONE_YEAR));
      let actualGain = await env.yToken.balanceOf(alice.address);
      let expectedGain = await getCurInterest(dave, amountRenewed);
      approxBigNumber(actualGain, expectedGain, env.TEST_DELTA);
    });

    it('should receive the interest from xyt when do tokenizeYield', async () => {
      await startCalInterest(charlie, refAmount);
      await tokenizeYield(env, alice, refAmount.div(2));

      await setTimeNextBlock(env.T0.add(consts.ONE_MONTH));
      await tokenizeYield(env, alice, refAmount.div(2));

      await redeemDueInterests(env, alice);
      const expectedGain = await getCurInterest(charlie, refAmount);

      // because we have tokenized all aUSDT of alice, curAUSDTbalance will equal to the interest
      // she has received from her xyt
      const curAUSDTbalance = await env.yToken.balanceOf(alice.address);
      approxBigNumber(curAUSDTbalance, expectedGain, env.TEST_DELTA);
    });

    it('newYieldContracts is not possible [if underlyingAsset is invalid]', async () => {
      // random underlyingAsset
      await expect(
        env.router.newYieldContracts(env.FORGE_ID, consts.RANDOM_ADDRESS, env.T0.add(consts.ONE_YEAR))
      ).to.be.revertedWith(errMsg.INVALID_UNDERLYING_ASSET);
    });
  });
}

describe('aaveV2-router', function () {
  if (checkDisabled(Mode.AAVE_V2)) return;
  runTest(Mode.AAVE_V2);
});
