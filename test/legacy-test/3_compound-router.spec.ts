import chai, { expect } from 'chai';
import { solidity } from 'ethereum-waffle';
import { BigNumber as BN, Contract, Wallet } from 'ethers';
import { routerFixture } from '../fixtures';
import { checkDisabled, Mode } from '../fixtures/TestEnv';
import {
  amountToWei,
  approxBigNumber,
  consts,
  errMsg,
  evm_revert,
  evm_snapshot,
  getCContract,
  mint,
  setTimeNextBlock,
  Token,
  tokens,
} from '../helpers';
const { waffle } = require('hardhat');
chai.use(solidity);

const { loadFixture, provider } = waffle;

export async function runTest(mode: Mode) {
  describe('', async () => {
    const wallets = provider.getWallets();
    const [alice, bob, charlie, dave] = wallets;

    let router: Contract;
    let cOt: Contract;
    let cXyt: Contract;
    let cForge: Contract;
    let cUSDT: Contract;
    let snapshotId: string;
    let globalSnapshotId: string;
    let tokenUSDT: Token;
    let amount: BN;
    let initialcUSDTbalance: BN;
    before(async () => {
      const fixture = await loadFixture(routerFixture);
      globalSnapshotId = await evm_snapshot();

      router = fixture.core.router;
      cOt = fixture.cForge.cOwnershipToken;
      cXyt = fixture.cForge.cFutureYieldToken;
      cForge = fixture.cForge.compoundForge;
      tokenUSDT = tokens.USDT;
      cUSDT = await getCContract(alice, tokenUSDT);
      snapshotId = await evm_snapshot();
    });

    after(async () => {
      await evm_revert(globalSnapshotId);
    });

    beforeEach(async () => {
      await evm_revert(snapshotId);
      snapshotId = await evm_snapshot();
      amount = amountToWei(consts.INITIAL_COMPOUND_TOKEN_AMOUNT, 6);
      initialcUSDTbalance = await cUSDT.balanceOf(alice.address);
    });

    async function tokenizeYield(user: Wallet, amount: BN) {
      await router
        .connect(user)
        .tokenizeYield(
          consts.FORGE_COMPOUND,
          tokenUSDT.address,
          consts.T0_C.add(consts.SIX_MONTH),
          amount,
          user.address,
          consts.HG
        );
    }

    async function redeemDueInterests(user: Wallet, expiry: BN) {
      await router.redeemDueInterests(consts.FORGE_COMPOUND, tokenUSDT.address, expiry, user.address);
    }

    async function convertToCAmount(amount: BN) {
      const curRate = await cUSDT.callStatic.exchangeRateCurrent();
      return amount
        .mul(BN.from(10 ** 9))
        .mul(BN.from(10 ** 9))
        .div(curRate);
    }

    async function borrow(amount: BN, user: Wallet) {
      await mint(tokens.USDT, user, amount);
      const cToken = await getCContract(user, tokens.USDT);
      await cToken.borrow(amount);
    }

    async function getCurInterest(initialCAmount: BN, initialUnderlyingAmount: BN): Promise<BN> {
      const curRate = await cUSDT.callStatic.exchangeRateCurrent();
      console.log('rateNow', curRate.toString());
      return initialCAmount.mul(curRate).div(consts.ONE_E_18).sub(initialUnderlyingAmount);
    }

    it('should receive the interest from xyt when do tokenizeYield', async () => {
      const initialRate = await cUSDT.callStatic.exchangeRateCurrent();
      const initialUnderlyingBalance = initialRate.mul(initialcUSDTbalance).div(consts.ONE_E_18);
      await tokenizeYield(alice, initialcUSDTbalance.div(2));
      await borrow(amount, charlie);
      await setTimeNextBlock(consts.T0_C.add(consts.FIFTEEN_DAY));
      await tokenizeYield(alice, initialcUSDTbalance.div(2));
      await redeemDueInterests(alice, consts.T0_C.add(consts.SIX_MONTH));

      const expectedGain = await getCurInterest(initialcUSDTbalance.div(2), initialUnderlyingBalance.div(2));

      // because we have tokenized all cUSDT of alice, curcUSDTbalanace will equal to the interest
      // she has received from her xyt
      const curUnderlyingBalance = await cUSDT.callStatic.balanceOfUnderlying(alice.address);
      approxBigNumber(curUnderlyingBalance, expectedGain, BN.from(10));
    });

    it("underlying asset's address should match the original asset", async () => {
      expect((await cOt.underlyingAsset()).toLowerCase()).to.be.equal(tokens.USDT.address.toLowerCase());
      expect((await cXyt.underlyingAsset()).toLowerCase()).to.be.equal(tokens.USDT.address.toLowerCase());
    });

    it("shouldn't be able to do newYieldContract with an expiry in the past", async () => {
      let futureTime = consts.T0_C.sub(consts.ONE_MONTH);
      await expect(router.newYieldContracts(consts.FORGE_COMPOUND, tokenUSDT.address, futureTime)).to.be.revertedWith(
        errMsg.INVALID_EXPIRY
      );
    });

    it("shouldn't be able to call redeemUnderlying if the yield contract has expired", async () => {
      await tokenizeYield(alice, initialcUSDTbalance);

      await setTimeNextBlock(consts.T0_C.add(consts.ONE_YEAR));

      await expect(
        router.redeemUnderlying(
          consts.FORGE_COMPOUND,
          tokenUSDT.address,
          consts.T0_C.add(consts.SIX_MONTH),
          amount,
          consts.HG
        )
      ).to.be.revertedWith(errMsg.YIELD_CONTRACT_EXPIRED);
    });

    it('[After 1 month] should be able to redeem cUSDT to get back OT, XYT and interests $', async () => {
      await tokenizeYield(alice, initialcUSDTbalance);
      await borrow(amount, charlie);

      await setTimeNextBlock(consts.T0_C.add(consts.FIFTEEN_DAY));

      await router.redeemUnderlying(
        consts.FORGE_COMPOUND,
        tokenUSDT.address,
        consts.T0_C.add(consts.SIX_MONTH),
        await cXyt.balanceOf(alice.address),
        consts.HG
      );

      // if user can receive the exact amount of cUSDT that he has sent in, then he has already received
      // the interest.
      expect((await cUSDT.balanceOf(alice.address)).toNumber()).to.be.approximately(initialcUSDTbalance.toNumber(), 10);
    });

    it('[After 1 month] should be able to get due interests', async () => {
      await tokenizeYield(alice, initialcUSDTbalance);
      const initialRate = await cUSDT.callStatic.exchangeRateCurrent();
      const initialUnderlyingBalance = initialRate.mul(initialcUSDTbalance).div(consts.ONE_E_18);
      await borrow(amount, charlie);

      await cOt.transfer(bob.address, await cOt.balanceOf(alice.address));

      await setTimeNextBlock(consts.T0_C.add(consts.ONE_MONTH));

      await redeemDueInterests(alice, consts.T0_C.add(consts.SIX_MONTH));

      const expectedGain = await getCurInterest(initialcUSDTbalance, initialUnderlyingBalance);
      console.log(
        await cUSDT.callStatic.balanceOf(alice.address),
        await cUSDT.callStatic.balanceOfUnderlying(alice.address)
      );
      let finalUnderlyingBalance = await cUSDT.callStatic.balanceOfUnderlying(alice.address);
      finalUnderlyingBalance = finalUnderlyingBalance.add(
        (await cForge.dueInterests(tokenUSDT.address, consts.T0_C.add(consts.SIX_MONTH), alice.address))
          .mul(await cUSDT.callStatic.exchangeRateCurrent())
          .div(consts.ONE_E_18)
      );
      expect(finalUnderlyingBalance).to.be.below(initialUnderlyingBalance);
      expect(finalUnderlyingBalance.toNumber()).to.be.approximately(expectedGain.toNumber(), 10);
    });

    it('Another wallet should be able to receive interests from XYT', async () => {
      await tokenizeYield(alice, initialcUSDTbalance);
      await cXyt.transfer(bob.address, initialcUSDTbalance);
      const initialRate = await cUSDT.callStatic.exchangeRateCurrent();
      const initialUnderlyingBalance = initialRate.mul(initialcUSDTbalance).div(consts.ONE_E_18);
      await borrow(amount, charlie);

      const T1 = consts.T0_C.add(consts.SIX_MONTH).sub(1);
      await setTimeNextBlock(T1);

      await redeemDueInterests(bob, consts.T0_C.add(consts.SIX_MONTH));

      let actualGain = await cUSDT.callStatic.balanceOfUnderlying(bob.address);
      actualGain = actualGain.add(
        (await cForge.dueInterests(tokenUSDT.address, consts.T0_C.add(consts.SIX_MONTH), bob.address))
          .mul(await cUSDT.callStatic.exchangeRateCurrent())
          .div(consts.ONE_E_18)
      );

      const expectedGain = await getCurInterest(initialcUSDTbalance, initialUnderlyingBalance);
      expect(actualGain.toNumber()).to.be.approximately(expectedGain.toNumber(), 10);
    });

    it('Short after expiry, should be able to redeem cUSDT from OT', async () => {
      await tokenizeYield(alice, initialcUSDTbalance);
      await cXyt.transfer(bob.address, initialcUSDTbalance);
      const initialRate = await cUSDT.callStatic.exchangeRateCurrent();
      const initialUnderlyingBalance = initialRate.mul(initialcUSDTbalance).div(consts.ONE_E_18);
      await borrow(amount, charlie);

      const T1 = consts.T0_C.add(consts.SIX_MONTH).sub(1);
      await setTimeNextBlock(T1);

      await redeemDueInterests(bob, consts.T0_C.add(consts.SIX_MONTH));

      const T2 = T1.add(10);
      await setTimeNextBlock(T2);

      await router.redeemAfterExpiry(consts.FORGE_COMPOUND, tokenUSDT.address, consts.T0_C.add(consts.SIX_MONTH));

      const lastRate = await cForge.lastRateBeforeExpiry(tokenUSDT.address, consts.T0_C.add(consts.SIX_MONTH));
      const finalUnderlyingBalance = await cUSDT.callStatic.balanceOfUnderlying(alice.address);
      const curRate = await cUSDT.callStatic.exchangeRateCurrent();
      expect(finalUnderlyingBalance.toNumber()).to.be.approximately(
        initialUnderlyingBalance.mul(curRate).div(lastRate).toNumber(),
        10
      );
    });

    it('One month after expiry, should be able to redeem cUSDT with interest', async () => {
      await tokenizeYield(alice, initialcUSDTbalance);
      await cXyt.transfer(bob.address, initialcUSDTbalance);
      const initialRate = await cUSDT.callStatic.exchangeRateCurrent();
      const initialUnderlyingBalance = initialRate.mul(initialcUSDTbalance).div(consts.ONE_E_18);
      await borrow(amount, charlie);

      const T1 = consts.T0_C.add(consts.SIX_MONTH).sub(1);
      await setTimeNextBlock(T1);

      await redeemDueInterests(bob, consts.T0_C.add(consts.SIX_MONTH));

      const T2 = T1.add(consts.ONE_MONTH);
      await setTimeNextBlock(T2);

      await router.redeemAfterExpiry(consts.FORGE_COMPOUND, tokenUSDT.address, consts.T0_C.add(consts.SIX_MONTH));

      const lastRate = await cForge.lastRateBeforeExpiry(tokenUSDT.address, consts.T0_C.add(consts.SIX_MONTH));
      const finalUnderlyingBalance = await cUSDT.callStatic.balanceOfUnderlying(alice.address);
      const curRate = await cUSDT.callStatic.exchangeRateCurrent();
      expect(finalUnderlyingBalance.toNumber()).to.be.approximately(
        initialUnderlyingBalance.mul(curRate).div(lastRate).toNumber(),
        10
      );
    });

    it('Should be able to newYieldContracts', async () => {
      let futureTime = consts.T0_C.add(consts.SIX_MONTH).add(consts.ONE_DAY);
      let filter = cForge.filters.NewYieldContracts();
      let tx = await router.newYieldContracts(consts.FORGE_COMPOUND, tokenUSDT.address, futureTime);

      let allEvents = await cForge.queryFilter(filter, tx.blockHash);
      expect(allEvents.length).to.be.eq(2);
      expect(allEvents[allEvents.length - 1].args!.ot).to.not.eq(0);
      expect(allEvents[allEvents.length - 1].args!.xyt).to.not.eq(0);
      expect(allEvents[allEvents.length - 1].args!.expiry).to.eq(futureTime);
    });

    it('should receive back exactly the same amount of cTokens', async () => {
      await tokenizeYield(alice, initialcUSDTbalance);
      await setTimeNextBlock(consts.T0_C.add(consts.FIFTEEN_DAY));

      await redeemDueInterests(alice, consts.T0_C.add(consts.SIX_MONTH));

      await router.redeemUnderlying(
        consts.FORGE_COMPOUND,
        tokenUSDT.address,
        consts.T0_C.add(consts.SIX_MONTH),
        await cXyt.balanceOf(alice.address),
        consts.HG
      );

      const curcUSDTbalanace = await cUSDT.balanceOf(alice.address);
      expect(initialcUSDTbalance.toNumber()).to.be.approximately(curcUSDTbalanace.toNumber(), 10);
    });
  });
}

describe('compound-router', function () {
  if (checkDisabled(Mode.COMPOUND)) return;
  runTest(Mode.COMPOUND);
});
