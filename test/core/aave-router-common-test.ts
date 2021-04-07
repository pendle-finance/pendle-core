import { expect } from "chai";
import { createFixtureLoader } from "ethereum-waffle";
import { BigNumber as BN, Contract, Wallet } from "ethers";
import {
  amountToWei,
  approxBigNumber,
  consts,
  errMsg,
  evm_revert,
  evm_snapshot,
  getA2Contract,
  getAContract,
  mintAaveToken,
  setTimeNextBlock,
  Token,
  tokens,
} from "../helpers";
import { pendleFixture, PendleFixture } from "./fixtures";

const { waffle } = require("hardhat");
const provider = waffle.provider;

interface TestEnv {
  T0: BN;
  FORGE_ID: string;
  INITIAL_AAVE_TOKEN_AMOUNT: BN;
  TEST_DELTA: BN;
}

export function runTest(isAaveV1: boolean) {
  describe("", async () => {
    const wallets = provider.getWallets();
    const loadFixture = createFixtureLoader(wallets, provider);
    const [alice, bob, charlie, dave] = wallets;

    let fixture: PendleFixture;
    let router: Contract;
    let ot: Contract;
    let xyt: Contract;
    let aaveForge: Contract;
    let aUSDT: Contract;
    let snapshotId: string;
    let globalSnapshotId: string;
    let tokenUSDT: Token;
    let refAmount: BN;
    let initialAUSDTbalance: BN;
    let testEnv: TestEnv = {} as TestEnv;

    async function buildCommonTestEnv() {
      fixture = await loadFixture(pendleFixture);
      router = fixture.core.router;
      tokenUSDT = tokens.USDT;
      testEnv.INITIAL_AAVE_TOKEN_AMOUNT = consts.INITIAL_AAVE_TOKEN_AMOUNT;
      testEnv.TEST_DELTA = BN.from(10000);
    }

    async function buildTestEnvV1() {
      ot = fixture.aForge.aOwnershipToken;
      xyt = fixture.aForge.aFutureYieldToken;
      aaveForge = fixture.aForge.aaveForge;
      aUSDT = await getAContract(alice, aaveForge, tokenUSDT);
      testEnv.FORGE_ID = consts.FORGE_AAVE;
      testEnv.T0 = consts.T0;
    }

    async function buildTestEnvV2() {
      ot = fixture.a2Forge.a2OwnershipToken;
      xyt = fixture.a2Forge.a2FutureYieldToken;
      aaveForge = fixture.a2Forge.aaveV2Forge;
      aUSDT = await getA2Contract(alice, aaveForge, tokenUSDT);
      testEnv.FORGE_ID = consts.FORGE_AAVE_V2;
      testEnv.T0 = consts.T0_A2;
    }

    before(async () => {
      globalSnapshotId = await evm_snapshot();
      await buildCommonTestEnv();
      if (isAaveV1) {
        await buildTestEnvV1();
      } else {
        await buildTestEnvV2();
      }
      snapshotId = await evm_snapshot();
    });

    after(async () => {
      await evm_revert(globalSnapshotId);
    });

    beforeEach(async () => {
      await evm_revert(snapshotId);
      snapshotId = await evm_snapshot();
      refAmount = amountToWei(testEnv.INITIAL_AAVE_TOKEN_AMOUNT, 6);
      initialAUSDTbalance = await aUSDT.balanceOf(alice.address);
    });

    async function tokenizeYield(user: Wallet, amount: BN): Promise<BN> {
      let amountTokenMinted = await ot.balanceOf(user.address);
      await router.tokenizeYield(
        testEnv.FORGE_ID,
        tokenUSDT.address,
        testEnv.T0.add(consts.SIX_MONTH),
        amount,
        user.address,
        consts.HIGH_GAS_OVERRIDE
      );
      amountTokenMinted = (await ot.balanceOf(user.address)).sub(
        amountTokenMinted
      );
      return amountTokenMinted;
    }

    async function startCalInterest(walletToUse: Wallet, initialAmount: BN) {
      // divide by 10^decimal since mintAaveToken will multiply that number back
      await mintAaveToken(
        provider,
        tokenUSDT,
        walletToUse,
        initialAmount.div(10 ** tokenUSDT.decimal),
        isAaveV1
      );
    }

    async function getCurInterest(
      walletToUse: Wallet,
      initialAmount: BN
    ): Promise<BN> {
      return (await aUSDT.balanceOf(walletToUse.address)).sub(initialAmount);
    }

    it("underlying asset's address should match the original asset", async () => {
      expect((await ot.underlyingAsset()).toLowerCase()).to.be.equal(
        tokens.USDT.address.toLowerCase()
      );
      expect((await xyt.underlyingAsset()).toLowerCase()).to.be.equal(
        tokens.USDT.address.toLowerCase()
      );
    });

    it("shouldn't be able to do newYieldContract with an expiry in the past", async () => {
      let futureTime = testEnv.T0.sub(consts.ONE_MONTH);
      await expect(
        router.newYieldContracts(
          testEnv.FORGE_ID,
          tokenUSDT.address,
          futureTime
        )
      ).to.be.revertedWith(errMsg.INVALID_EXPIRY);
    });

    it("should be able to deposit aUSDT to get back OT and XYT", async () => {
      let amount = await tokenizeYield(alice, refAmount);
      const balanceOwnershipToken = await ot.balanceOf(alice.address);
      const balanceFutureYieldToken = await xyt.balanceOf(alice.address);
      expect(balanceOwnershipToken).to.be.eq(amount);
      expect(balanceFutureYieldToken).to.be.eq(amount);
    });

    it("shouldn't be able to call redeemUnderlying if the yield contract has expired", async () => {
      let amount = await tokenizeYield(alice, refAmount);

      await setTimeNextBlock(provider, testEnv.T0.add(consts.ONE_YEAR));

      await expect(
        router.redeemUnderlying(
          testEnv.FORGE_ID,
          tokenUSDT.address,
          testEnv.T0.add(consts.SIX_MONTH),
          refAmount,
          alice.address,
          consts.HIGH_GAS_OVERRIDE
        )
      ).to.be.revertedWith(errMsg.YIELD_CONTRACT_EXPIRED);
    });

    it("[After 1 month] should be able to redeem aUSDT to get back OT, XYT and interests $", async () => {
      await startCalInterest(charlie, refAmount);
      let amount = await tokenizeYield(alice, refAmount);
      await setTimeNextBlock(provider, testEnv.T0.add(consts.ONE_MONTH));

      await router.redeemUnderlying(
        testEnv.FORGE_ID,
        tokenUSDT.address,
        testEnv.T0.add(consts.SIX_MONTH),
        amount,
        alice.address,
        consts.HIGH_GAS_OVERRIDE
      );

      const finalAUSDTbalance = await aUSDT.balanceOf(alice.address);

      const expectedGain = await getCurInterest(charlie, refAmount);
      expect(finalAUSDTbalance.toNumber()).to.be.approximately(
        initialAUSDTbalance.add(expectedGain).toNumber(),
        10000
      );
    });

    it("should be able to redeemUnderlying with amountToRedeem = 0", async () => {
      // just check that it doesn't crash
      await tokenizeYield(alice, refAmount);
      await setTimeNextBlock(provider, testEnv.T0.add(consts.ONE_MONTH));

      await router.redeemUnderlying(
        testEnv.FORGE_ID,
        tokenUSDT.address,
        testEnv.T0.add(consts.SIX_MONTH),
        BN.from(0),
        alice.address,
        consts.HIGH_GAS_OVERRIDE
      );
    });

    it("[After 1 month] should be able to get due interests", async () => {
      await startCalInterest(charlie, refAmount);
      let amount = await tokenizeYield(alice, refAmount);

      await ot.transfer(bob.address, await ot.balanceOf(alice.address));

      const afterLendingAUSDTbalance = await aUSDT.balanceOf(alice.address);

      await setTimeNextBlock(provider, testEnv.T0.add(consts.ONE_MONTH));

      await router.redeemDueInterests(
        testEnv.FORGE_ID,
        tokenUSDT.address,
        testEnv.T0.add(consts.SIX_MONTH)
      );

      const expectedGain = await getCurInterest(charlie, refAmount);
      const finalAUSDTbalance = await aUSDT.balanceOf(alice.address);

      expect(finalAUSDTbalance).to.be.below(initialAUSDTbalance);
      expect(finalAUSDTbalance.toNumber()).to.be.approximately(
        afterLendingAUSDTbalance.add(expectedGain).toNumber(),
        10000
      );
    });

    it("Another wallet should be able to receive interests from XYT", async () => {
      await startCalInterest(charlie, refAmount);

      let amount = await tokenizeYield(alice, refAmount);
      await xyt.transfer(bob.address, amount);

      const T1 = testEnv.T0.add(consts.SIX_MONTH).sub(1);
      await setTimeNextBlock(provider, T1);

      await router
        .connect(bob)
        .redeemDueInterests(
          testEnv.FORGE_ID,
          tokenUSDT.address,
          testEnv.T0.add(consts.SIX_MONTH)
        );

      const actualGain = await aUSDT.balanceOf(bob.address);
      const expectedGain = await getCurInterest(charlie, refAmount);

      expect(actualGain.toNumber()).to.be.approximately(
        expectedGain.toNumber(),
        10000
      );
    });

    it("Short after expiry, should be able to redeem aUSDT from OT", async () => {
      await startCalInterest(charlie, refAmount);

      let amount = await tokenizeYield(alice, refAmount);
      await xyt.transfer(bob.address, amount);

      const T1 = testEnv.T0.add(consts.SIX_MONTH).sub(1);
      await setTimeNextBlock(provider, T1);

      await router
        .connect(bob)
        .redeemDueInterests(
          testEnv.FORGE_ID,
          tokenUSDT.address,
          testEnv.T0.add(consts.SIX_MONTH)
        );

      approxBigNumber(
        await aUSDT.balanceOf(bob.address),
        await getCurInterest(charlie, refAmount),
        testEnv.TEST_DELTA,
        false
      );

      await startCalInterest(dave, refAmount);

      const T2 = T1.add(10);
      await setTimeNextBlock(provider, T2);

      await router.redeemAfterExpiry(
        testEnv.FORGE_ID,
        tokenUSDT.address,
        testEnv.T0.add(consts.SIX_MONTH),
        alice.address
      );

      const expectedGain = await getCurInterest(dave, refAmount);
      const finalAUSDTbalance = await aUSDT.balanceOf(alice.address);
      approxBigNumber(
        finalAUSDTbalance,
        initialAUSDTbalance.add(expectedGain),
        testEnv.TEST_DELTA,
        false
      );
    });

    it("One month after expiry, should be able to redeem aUSDT with intrest", async () => {
      await startCalInterest(charlie, refAmount);
      let amount = await tokenizeYield(alice, refAmount);
      await xyt.transfer(bob.address, amount);

      const T1 = testEnv.T0.add(consts.SIX_MONTH).sub(1);
      await setTimeNextBlock(provider, T1);

      await router
        .connect(bob)
        .redeemDueInterests(
          testEnv.FORGE_ID,
          tokenUSDT.address,
          testEnv.T0.add(consts.SIX_MONTH)
        );

      await startCalInterest(dave, refAmount);
      approxBigNumber(
        await aUSDT.balanceOf(bob.address),
        await getCurInterest(charlie, refAmount),
        testEnv.TEST_DELTA,
        true
      );

      const T2 = T1.add(consts.ONE_MONTH);
      await setTimeNextBlock(provider, T2);

      await router.redeemAfterExpiry(
        testEnv.FORGE_ID,
        tokenUSDT.address,
        testEnv.T0.add(consts.SIX_MONTH),
        alice.address
      );

      const expectedGain = await getCurInterest(dave, refAmount);
      const finalAUSDTbalance = await aUSDT.balanceOf(alice.address);
      approxBigNumber(
        finalAUSDTbalance,
        initialAUSDTbalance.add(expectedGain),
        testEnv.TEST_DELTA,
        true
      );
    });

    it("Should be able to newYieldContracts", async () => {
      let futureTime = testEnv.T0.add(consts.SIX_MONTH).add(consts.ONE_DAY);
      let filter = aaveForge.filters.NewYieldContracts();
      let tx = await router.newYieldContracts(
        testEnv.FORGE_ID,
        tokenUSDT.address,
        futureTime
      );

      let allEvents = await aaveForge.queryFilter(filter, tx.blockHash);
      expect(allEvents.length).to.be.eq(3); // there is two events of the same type before this event
      expect(allEvents[allEvents.length - 1].args!.ot).to.not.eq(0);
      expect(allEvents[allEvents.length - 1].args!.xyt).to.not.eq(0);
      expect(allEvents[allEvents.length - 1].args!.expiry).to.eq(futureTime);
    });

    it("Should be able to redeemDueInterestsMultiple", async () => {
      await startCalInterest(dave, refAmount);
      await router.newYieldContracts(
        testEnv.FORGE_ID,
        tokenUSDT.address,
        testEnv.T0.add(consts.ONE_YEAR)
      );
      await tokenizeYield(alice, refAmount.div(2));
      await router.tokenizeYield(
        testEnv.FORGE_ID,
        tokenUSDT.address,
        testEnv.T0.add(consts.ONE_YEAR),
        refAmount.div(2),
        alice.address,
        consts.HIGH_GAS_OVERRIDE
      );
      await setTimeNextBlock(provider, testEnv.T0.add(consts.FIVE_MONTH));
      await router.redeemDueInterestsMultiple(
        [testEnv.FORGE_ID, testEnv.FORGE_ID],
        [tokenUSDT.address, tokenUSDT.address],
        [testEnv.T0.add(consts.SIX_MONTH), testEnv.T0.add(consts.ONE_YEAR)]
      );
      let actualGain = await aUSDT.balanceOf(alice.address);
      let expectedGain = await getCurInterest(dave, refAmount);
      approxBigNumber(actualGain, expectedGain, testEnv.TEST_DELTA);
    });

    it("Should be able to renewYield", async () => {
      await router.newYieldContracts(
        testEnv.FORGE_ID,
        tokenUSDT.address,
        testEnv.T0.add(consts.ONE_YEAR)
      );
      await startCalInterest(dave, refAmount);
      let amount = await tokenizeYield(alice, refAmount);
      await setTimeNextBlock(provider, testEnv.T0.add(consts.ONE_MONTH.mul(7)));
      await router.renewYield(
        testEnv.FORGE_ID,
        testEnv.T0.add(consts.SIX_MONTH),
        tokenUSDT.address,
        testEnv.T0.add(consts.ONE_YEAR),
        amount,
        alice.address
      );
      await setTimeNextBlock(
        provider,
        testEnv.T0.add(consts.ONE_MONTH.mul(11))
      );
      await router.redeemDueInterests(
        testEnv.FORGE_ID,
        tokenUSDT.address,
        testEnv.T0.add(consts.ONE_YEAR)
      );
      let actualGain = await aUSDT.balanceOf(alice.address);
      let expectedGain = await getCurInterest(dave, refAmount);
      approxBigNumber(actualGain, expectedGain, testEnv.TEST_DELTA);
    });

    it("should receive the interest from xyt when do tokenizeYield", async () => {
      await startCalInterest(charlie, refAmount);
      await tokenizeYield(alice, refAmount.div(2));

      await setTimeNextBlock(provider, testEnv.T0.add(consts.ONE_MONTH));
      await tokenizeYield(alice, refAmount.div(2));

      const expectedGain = await getCurInterest(charlie, refAmount);

      // because we have tokenized all aUSDT of alice, curAUSDTbalanace will equal to the interest
      // she has received from her xyt
      const curAUSDTbalance = await aUSDT.balanceOf(alice.address);
      approxBigNumber(curAUSDTbalance, expectedGain, testEnv.TEST_DELTA);
    });
  });
}
