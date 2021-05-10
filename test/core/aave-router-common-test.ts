import { expect } from "chai";
import { createFixtureLoader } from "ethereum-waffle";
import { BigNumber as BN, Wallet } from "ethers";
import {
  amountToWei,
  approxBigNumber,
  consts,
  errMsg,
  evm_revert,
  evm_snapshot,
  mintAaveToken,
  setTime,
  setTimeNextBlock,
  Token,
  tokens,
} from "../helpers";
import {
  Mode,
  parseTestEnvPendleFixture,
  pendleFixture,
  PendleFixture,
  TestEnv,
} from "./fixtures";

const { waffle } = require("hardhat");
const provider = waffle.provider;

export function runTest(isAaveV1: boolean) {
  describe("", async () => {
    const wallets = provider.getWallets();
    const loadFixture = createFixtureLoader(wallets, provider);
    const [alice, bob, charlie, dave] = wallets;

    let fixture: PendleFixture;
    let snapshotId: string;
    let globalSnapshotId: string;
    let refAmount: BN;
    let USDT: Token;
    let initialAUSDTbalance: BN;
    let env: TestEnv = {} as TestEnv;

    async function buildTestEnv() {
      fixture = await loadFixture(pendleFixture);
      if (isAaveV1)
        await parseTestEnvPendleFixture(alice, Mode.AAVE_V1, env, fixture);
      else await parseTestEnvPendleFixture(alice, Mode.AAVE_V2, env, fixture);
      USDT = tokens.USDT;
      env.INITIAL_YIELD_TOKEN_AMOUNT = consts.INITIAL_AAVE_TOKEN_AMOUNT;
      env.TEST_DELTA = BN.from(10000);
      env.EXPIRY = env.T0.add(consts.SIX_MONTH);
    }

    before(async () => {
      globalSnapshotId = await evm_snapshot();
      await buildTestEnv();
      refAmount = amountToWei(env.INITIAL_YIELD_TOKEN_AMOUNT, 6);
      snapshotId = await evm_snapshot();
    });

    after(async () => {
      await evm_revert(globalSnapshotId);
    });

    beforeEach(async () => {
      await evm_revert(snapshotId);
      snapshotId = await evm_snapshot();
      initialAUSDTbalance = await env.aUSDT.balanceOf(alice.address);
    });

    async function tokenizeYield(user: Wallet, amount: BN): Promise<BN> {
      let amountTokenMinted = await env.ot.balanceOf(user.address);
      await env.router.tokenizeYield(
        env.FORGE_ID,
        USDT.address,
        env.EXPIRY,
        amount,
        user.address,
        consts.HIGH_GAS_OVERRIDE
      );
      amountTokenMinted = (await env.ot.balanceOf(user.address)).sub(
        amountTokenMinted
      );
      return amountTokenMinted;
    }

    async function redeemDueInterests(user: Wallet, expiry: BN) {
      await env.router.redeemDueInterests(
        env.FORGE_ID,
        USDT.address,
        expiry,
        user.address
      );
    }

    async function startCalInterest(walletToUse: Wallet, initialAmount: BN) {
      // divide by 10^decimal since mintAaveToken will multiply that number back
      await mintAaveToken(
        provider,
        USDT,
        walletToUse,
        initialAmount.div(10 ** USDT.decimal),
        isAaveV1
      );
    }

    async function getCurInterest(
      walletToUse: Wallet,
      initialAmount: BN
    ): Promise<BN> {
      return (await env.aUSDT.balanceOf(walletToUse.address)).sub(
        initialAmount
      );
    }

    it("underlying asset's address should match the original asset", async () => {
      expect((await env.ot.underlyingAsset()).toLowerCase()).to.be.equal(
        tokens.USDT.address.toLowerCase()
      );
      expect((await env.xyt.underlyingAsset()).toLowerCase()).to.be.equal(
        tokens.USDT.address.toLowerCase()
      );
    });

    it("shouldn't be able to do newYieldContract with an expiry in the past", async () => {
      let futureTime = env.T0.sub(consts.ONE_MONTH);
      await expect(
        env.router.newYieldContracts(env.FORGE_ID, USDT.address, futureTime)
      ).to.be.revertedWith(errMsg.INVALID_EXPIRY);
    });

    it("shouldn't be able to do newYieldContract with an expiry not divisible for expiryDivisor", async () => {
      let futureTime = env.T0.add(consts.ONE_YEAR);
      if (futureTime.mod(await env.data.expiryDivisor()).eq(0)) {
        futureTime = futureTime.add(1);
      }
      await expect(
        env.router.newYieldContracts(env.FORGE_ID, USDT.address, futureTime)
      ).to.be.revertedWith(errMsg.INVALID_EXPIRY);
    });

    it("should be able to deposit aUSDT to get back OT and XYT", async () => {
      let amount = await tokenizeYield(alice, refAmount);
      const balanceOwnershipToken = await env.ot.balanceOf(alice.address);
      const balanceFutureYieldToken = await env.xyt.balanceOf(alice.address);
      expect(balanceOwnershipToken).to.be.eq(amount);
      expect(balanceFutureYieldToken).to.be.eq(amount);
    });

    it("shouldn't be able to call redeemUnderlying if the yield contract has expired", async () => {
      let amount = await tokenizeYield(alice, refAmount);

      await setTimeNextBlock(provider, env.T0.add(consts.ONE_YEAR));

      await expect(
        env.router.redeemUnderlying(
          env.FORGE_ID,
          USDT.address,
          env.EXPIRY,
          refAmount,
          consts.HIGH_GAS_OVERRIDE
        )
      ).to.be.revertedWith(errMsg.YIELD_CONTRACT_EXPIRED);
    });

    it("[After 1 month] should be able to redeem aUSDT to get back OT, XYT and interests $", async () => {
      await startCalInterest(charlie, refAmount);
      let amount = await tokenizeYield(alice, refAmount);
      await setTimeNextBlock(provider, env.T0.add(consts.ONE_MONTH));

      await env.router.redeemUnderlying(
        env.FORGE_ID,
        USDT.address,
        env.EXPIRY,
        amount,
        consts.HIGH_GAS_OVERRIDE
      );

      const finalAUSDTbalance = await env.aUSDT.balanceOf(alice.address);

      const expectedGain = await getCurInterest(charlie, refAmount);
      expect(finalAUSDTbalance.toNumber()).to.be.approximately(
        initialAUSDTbalance.add(expectedGain).toNumber(),
        10000
      );
    });

    it("[After 1 month] should be able to get due interests", async () => {
      await startCalInterest(charlie, refAmount);
      let amount = await tokenizeYield(alice, refAmount);

      await env.ot.transfer(bob.address, await env.ot.balanceOf(alice.address));

      const afterLendingAUSDTbalance = await env.aUSDT.balanceOf(alice.address);

      await setTimeNextBlock(provider, env.T0.add(consts.ONE_MONTH));

      await redeemDueInterests(alice, env.EXPIRY);

      const expectedGain = await getCurInterest(charlie, refAmount);
      const finalAUSDTbalance = await env.aUSDT.balanceOf(alice.address);

      expect(finalAUSDTbalance).to.be.below(initialAUSDTbalance);
      expect(finalAUSDTbalance.toNumber()).to.be.approximately(
        afterLendingAUSDTbalance.add(expectedGain).toNumber(),
        10000
      );
    });

    it("Another wallet should be able to receive interests from XYT", async () => {
      await startCalInterest(charlie, refAmount);

      let amount = await tokenizeYield(alice, refAmount);
      await env.xyt.transfer(bob.address, amount);

      const T1 = env.EXPIRY.sub(1);
      await setTimeNextBlock(provider, T1);

      await redeemDueInterests(bob, env.EXPIRY);

      const actualGain = await env.aUSDT.balanceOf(bob.address);
      const expectedGain = await getCurInterest(charlie, refAmount);

      expect(actualGain.toNumber()).to.be.approximately(
        expectedGain.toNumber(),
        10000
      );
    });

    it("Short after expiry, should be able to redeem aUSDT from OT", async () => {
      await startCalInterest(charlie, refAmount);

      let amount = await tokenizeYield(alice, refAmount);
      await env.xyt.transfer(bob.address, amount);

      const T1 = env.EXPIRY.sub(1);
      await setTimeNextBlock(provider, T1);

      await redeemDueInterests(bob, env.EXPIRY);

      approxBigNumber(
        await env.aUSDT.balanceOf(bob.address),
        await getCurInterest(charlie, refAmount),
        env.TEST_DELTA,
        false
      );

      await startCalInterest(dave, refAmount);

      const T2 = T1.add(10);
      await setTimeNextBlock(provider, T2);

      await env.router.redeemAfterExpiry(
        env.FORGE_ID,
        USDT.address,
        env.EXPIRY
      );

      const expectedGain = await getCurInterest(dave, refAmount);
      const finalAUSDTbalance = await env.aUSDT.balanceOf(alice.address);
      approxBigNumber(
        finalAUSDTbalance,
        initialAUSDTbalance.add(expectedGain),
        env.TEST_DELTA,
        false
      );
    });

    it("One month after expiry, should be able to redeem aUSDT with interest", async () => {
      await startCalInterest(charlie, refAmount);
      let amount = await tokenizeYield(alice, refAmount);
      await env.xyt.transfer(bob.address, amount);

      const T1 = env.EXPIRY.sub(1);
      await setTimeNextBlock(provider, T1);

      await redeemDueInterests(bob, env.EXPIRY);

      await startCalInterest(dave, refAmount);
      approxBigNumber(
        await env.aUSDT.balanceOf(bob.address),
        await getCurInterest(charlie, refAmount),
        env.TEST_DELTA,
        true
      );

      const T2 = T1.add(consts.ONE_MONTH);
      await setTimeNextBlock(provider, T2);

      await env.router.redeemAfterExpiry(
        env.FORGE_ID,
        USDT.address,
        env.EXPIRY
      );

      const expectedGain = await getCurInterest(dave, refAmount);
      const finalAUSDTbalance = await env.aUSDT.balanceOf(alice.address);
      approxBigNumber(
        finalAUSDTbalance,
        initialAUSDTbalance.add(expectedGain),
        env.TEST_DELTA,
        true
      );
    });

    it("Should be able to newYieldContracts", async () => {
      let futureTime = env.EXPIRY.add(consts.ONE_DAY);
      let filter = env.forge.filters.NewYieldContracts();
      let tx = await env.router.newYieldContracts(
        env.FORGE_ID,
        USDT.address,
        futureTime
      );

      let allEvents = await env.forge.queryFilter(filter, tx.blockHash);
      expect(allEvents.length).to.be.eq(3); // there is two events of the same type before this event
      expect(allEvents[allEvents.length - 1].args!.ot).to.not.eq(0);
      expect(allEvents[allEvents.length - 1].args!.xyt).to.not.eq(0);
      expect(allEvents[allEvents.length - 1].args!.expiry).to.eq(futureTime);
    });

    it("Should be able to renewYield", async () => {
      await env.router.newYieldContracts(
        env.FORGE_ID,
        USDT.address,
        env.T0.add(consts.ONE_YEAR)
      );
      await startCalInterest(dave, refAmount);
      await tokenizeYield(alice, refAmount);
      await setTime(provider, env.T0.add(consts.ONE_MONTH.mul(7)));

      let {
        redeemedAmount,
        amountTransferOut,
      } = await env.router.callStatic.renewYield(
        env.FORGE_ID,
        env.EXPIRY,
        USDT.address,
        env.T0.add(consts.ONE_YEAR),
        consts.RONE.div(2), // 50%
        consts.HIGH_GAS_OVERRIDE
      );

      await env.router.renewYield(
        env.FORGE_ID,
        env.EXPIRY,
        USDT.address,
        env.T0.add(consts.ONE_YEAR),
        consts.RONE.div(2),
        consts.HIGH_GAS_OVERRIDE
      );

      let renewedAmount = redeemedAmount.sub(amountTransferOut);
      await setTimeNextBlock(provider, env.T0.add(consts.ONE_MONTH.mul(11)));
      await redeemDueInterests(alice, env.T0.add(consts.ONE_YEAR));
      let actualGain = await env.aUSDT.balanceOf(alice.address);
      let expectedGain = await getCurInterest(dave, renewedAmount);
      approxBigNumber(actualGain, expectedGain, env.TEST_DELTA);
    });

    it("should receive the interest from xyt when do tokenizeYield", async () => {
      await startCalInterest(charlie, refAmount);
      await tokenizeYield(alice, refAmount.div(2));

      await setTimeNextBlock(provider, env.T0.add(consts.ONE_MONTH));
      await tokenizeYield(alice, refAmount.div(2));

      await redeemDueInterests(alice, env.EXPIRY);
      const expectedGain = await getCurInterest(charlie, refAmount);

      // because we have tokenized all aUSDT of alice, curAUSDTbalance will equal to the interest
      // she has received from her xyt
      const curAUSDTbalance = await env.aUSDT.balanceOf(alice.address);
      approxBigNumber(curAUSDTbalance, expectedGain, env.TEST_DELTA);
    });

    it("shouldn't be able to newYieldContracts with an invalid underlyingAsset", async () => {
      // random underlyingAsset
      await expect(
        env.router.newYieldContracts(
          env.FORGE_ID,
          consts.RANDOM_ADDRESS,
          consts.T0.add(consts.ONE_YEAR)
        )
      ).to.be.revertedWith(errMsg.INVALID_UNDERLYING_ASSET);
    });
  });
}
