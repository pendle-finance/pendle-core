import { expect } from "chai";
import { createFixtureLoader } from "ethereum-waffle";
import { BigNumber as BN, Contract, Wallet } from "ethers";
import {
  amountToWei,
  approxBigNumber,
  consts,
  evm_revert,
  evm_snapshot,
  getCContract,
  mintCompoundToken,
  setTimeNextBlock,
  Token,
  tokens,
  errMsg,
} from "../helpers";
import { pendleFixture } from "./fixtures";

const { waffle } = require("hardhat");
const provider = waffle.provider;

describe("PendleCompoundRouter", async () => {
  const wallets = provider.getWallets();
  const loadFixture = createFixtureLoader(wallets, provider);
  const [alice, bob, charlie, dave] = wallets;

  let router: Contract;
  let routerWeb3: any;
  let cOt: Contract;
  let cXyt: Contract;
  let compoundForge: Contract;
  let cUSDT: Contract;
  let snapshotId: string;
  let globalSnapshotId: string;
  let tokenUSDT: Token;
  let amount: BN;
  let initialUnderlyingBalance: BN;
  let initialcUSDTbalance: BN;
  before(async () => {
    globalSnapshotId = await evm_snapshot();

    const fixture = await loadFixture(pendleFixture);
    router = fixture.core.router;
    routerWeb3 = fixture.core.routerWeb3;
    cOt = fixture.cForge.cOwnershipToken;
    cXyt = fixture.cForge.cFutureYieldToken;
    compoundForge = fixture.cForge.compoundForge;
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
    const underlyingTx = await cUSDT.balanceOfUnderlying(alice.address);
    initialUnderlyingBalance = await cUSDT.callStatic.balanceOfUnderlying(
      alice.address
    );
    initialcUSDTbalance = await cUSDT.balanceOf(alice.address);
  });

  async function tokenizeYield(user: Wallet, amount: BN) {
    const rate = await cUSDT.callStatic.exchangeRateCurrent();
    const amt = amount
      .mul(BN.from(10 ** 9))
      .mul(BN.from(10 ** 9))
      .div(rate);
    await router.tokenizeYield(
      consts.FORGE_COMPOUND,
      tokenUSDT.address,
      consts.T0_C.add(consts.ONE_MONTH),
      amt,
      user.address,
      consts.HIGH_GAS_OVERRIDE
    );
  }

  async function startCalInterest(walletToUse: Wallet, initialAmount: BN) {
    // divide by 10^decimal since mintСompoundToken will multiply that number back
    await mintCompoundToken(
      provider,
      tokenUSDT,
      walletToUse,
      initialAmount.div(10 ** tokenUSDT.decimal)
    );
  }

  async function getCurInterest(
    walletToUse: Wallet,
    initialAmount: BN
  ): Promise<BN> {
    const underlyingTx = await cUSDT.balanceOfUnderlying(walletToUse.address);
    return (
      await cUSDT.callStatic.balanceOfUnderlying(walletToUse.address)
    ).sub(initialAmount);
  }

  it("should receive the interest from xyt when do tokenizeYield", async () => {
    await startCalInterest(charlie, amount);
    await tokenizeYield(alice, amount.div(2));
    await setTimeNextBlock(provider, consts.T0_C.add(consts.ONE_MONTH));
    await tokenizeYield(alice, amount.div(2));

    const expectedGain = await getCurInterest(charlie, amount);

    // because we have tokenized all cUSDT of alice, curcUSDTbalanace will equal to the interest
    // she has received from her xyt
    const underlyingTx = await cUSDT.balanceOfUnderlying(alice.address);
    const curUnderlyingBalance = await cUSDT.callStatic.balanceOfUnderlying(
      alice.address
    );
    approxBigNumber(curUnderlyingBalance, expectedGain, BN.from(2000));
  });

  it("underlying asset's address should match the original asset", async () => {
    expect((await cOt.underlyingAsset()).toLowerCase()).to.be.equal(
      tokens.USDT.address.toLowerCase()
    );
    expect((await cXyt.underlyingAsset()).toLowerCase()).to.be.equal(
      tokens.USDT.address.toLowerCase()
    );
  });

  it("shouldn't be able to do newYieldContract with an expiry in the past", async () => {
    let futureTime = consts.T0_C.sub(consts.ONE_MONTH);
    await expect(
      router.newYieldContracts(
        consts.FORGE_COMPOUND,
        tokenUSDT.address,
        futureTime
      )
    ).to.be.revertedWith(errMsg.INVALID_EXPIRY);
  });

  it("shouldn't be able to call redeemUnderlying if the yield contract has expired", async () => {
    await tokenizeYield(alice, amount);
    await startCalInterest(charlie, amount);

    await setTimeNextBlock(provider, consts.T0_C.add(consts.ONE_YEAR));

    await expect(
      router.redeemUnderlying(
        consts.FORGE_COMPOUND,
        tokenUSDT.address,
        consts.T0_C.add(consts.ONE_MONTH),
        amount,
        alice.address,
        consts.HIGH_GAS_OVERRIDE
      )
    ).to.be.revertedWith(errMsg.YIELD_CONTRACT_EXPIRED);
  });

  it("[After 1 month] should be able to redeem cUSDT to get back OT, XYT and interests $", async () => {
    await tokenizeYield(alice, amount);
    await startCalInterest(charlie, amount);

    await setTimeNextBlock(provider, consts.T0_C.add(consts.FIFTEEN_DAY));

    const rate = await cUSDT.callStatic.exchangeRateCurrent();
    const amt = amount
      .mul(BN.from(10 ** 9))
      .mul(BN.from(10 ** 9))
      .div(rate);
    await router.redeemUnderlying(
      consts.FORGE_COMPOUND,
      tokenUSDT.address,
      consts.T0_C.add(consts.ONE_MONTH),
      amt,
      alice.address,
      consts.HIGH_GAS_OVERRIDE
    );

    const underlyingTx = await cUSDT.balanceOfUnderlying(alice.address);
    const finalUnderlyingBalance = await cUSDT.callStatic.balanceOfUnderlying(
      alice.address
    );

    const expectedGain = await getCurInterest(charlie, amount);
    expect(finalUnderlyingBalance.toNumber()).to.be.approximately(
      initialUnderlyingBalance.add(expectedGain).toNumber(),
      2000
    );
  });

  it("[After 1 month] should be able to get due interests", async () => {
    await tokenizeYield(alice, amount);
    await startCalInterest(charlie, amount);

    const balance = await cOt.balanceOf(alice.address);
    await cOt.transfer(bob.address, balance);

    let underlyingTx = await cUSDT.balanceOfUnderlying(alice.address);
    const afterLendingUnderlyingBalance = await cUSDT.callStatic.balanceOfUnderlying(
      alice.address
    );

    await setTimeNextBlock(provider, consts.T0_C.add(consts.FIFTEEN_DAY));

    await router.redeemDueInterests(
      consts.FORGE_COMPOUND,
      tokenUSDT.address,
      consts.T0_C.add(consts.ONE_MONTH)
    );

    const expectedGain = await getCurInterest(charlie, amount);
    console.log(expectedGain);
    underlyingTx = await cUSDT.balanceOfUnderlying(alice.address);
    const finalUnderlyingBalance = await cUSDT.callStatic.balanceOfUnderlying(
      alice.address
    );

    expect(finalUnderlyingBalance).to.be.below(initialUnderlyingBalance);
    expect(finalUnderlyingBalance.toNumber()).to.be.approximately(
      afterLendingUnderlyingBalance.add(expectedGain).toNumber(),
      2000
    );
  });

  it("Another wallet should be able to receive interests from XYT", async () => {
    await startCalInterest(charlie, amount);

    await tokenizeYield(alice, amount);
    await cXyt.transfer(bob.address, amount);

    const T1 = consts.T0_C.add(consts.ONE_MONTH).sub(1);
    await setTimeNextBlock(provider, T1);

    await router
      .connect(bob)
      .redeemDueInterests(
        consts.FORGE_COMPOUND,
        tokenUSDT.address,
        consts.T0_C.add(consts.ONE_MONTH)
      );

    const underlyingTx = await cUSDT.balanceOfUnderlying(bob.address);
    const actualGain = await cUSDT.callStatic.balanceOfUnderlying(bob.address);
    const expectedGain = await getCurInterest(charlie, amount);

    expect(actualGain.toNumber()).to.be.approximately(
      expectedGain.toNumber(),
      2000
    );
  });

  it("Short after expiry, should be able to redeem cUSDT from OT", async () => {
    await startCalInterest(charlie, amount);

    await tokenizeYield(alice, amount);
    await cXyt.transfer(bob.address, amount);

    const T1 = consts.T0_C.add(consts.ONE_MONTH).sub(1);
    await setTimeNextBlock(provider, T1);

    await router
      .connect(bob)
      .redeemDueInterests(
        consts.FORGE_COMPOUND,
        tokenUSDT.address,
        consts.T0_C.add(consts.ONE_MONTH)
      );

    await startCalInterest(dave, amount);

    const T2 = T1.add(10);
    await setTimeNextBlock(provider, T2);

    await router.redeemAfterExpiry(
      consts.FORGE_COMPOUND,
      tokenUSDT.address,
      consts.T0_C.add(consts.ONE_MONTH),
      alice.address
    );

    const expectedGain = await getCurInterest(dave, amount);

    const underlyingTx = await cUSDT.balanceOfUnderlying(alice.address);
    const finalUnderlyingBalance = await cUSDT.callStatic.balanceOfUnderlying(
      alice.address
    );

    expect(finalUnderlyingBalance.toNumber()).to.be.approximately(
      initialUnderlyingBalance.add(expectedGain).toNumber(),
      4000
    );
  });

  it("One month after expiry, should be able to redeem cUSDT with intrest", async () => {
    await startCalInterest(charlie, amount);

    await tokenizeYield(alice, amount);
    await cXyt.transfer(bob.address, amount);

    const T1 = consts.T0_C.add(consts.ONE_MONTH).sub(1);
    await setTimeNextBlock(provider, T1);

    await router
      .connect(bob)
      .redeemDueInterests(
        consts.FORGE_COMPOUND,
        tokenUSDT.address,
        consts.T0_C.add(consts.ONE_MONTH)
      );

    await startCalInterest(dave, amount);

    const T2 = T1.add(consts.ONE_MONTH);
    await setTimeNextBlock(provider, T2);

    await router.redeemAfterExpiry(
      consts.FORGE_COMPOUND,
      tokenUSDT.address,
      consts.T0_C.add(consts.ONE_MONTH),
      alice.address
    );

    const expectedGain = await getCurInterest(dave, amount);
    const underlyingTx = await cUSDT.balanceOfUnderlying(alice.address);
    const finalUnderlyingBalance = await cUSDT.callStatic.balanceOfUnderlying(
      alice.address
    );
    expect(finalUnderlyingBalance.toNumber()).to.be.approximately(
      initialUnderlyingBalance.add(expectedGain).toNumber(),
      4000
    );
  });

  it("Should be able to newYieldContracts", async () => {
    let futureTime = consts.T0_C.add(consts.ONE_MONTH).add(consts.ONE_DAY);
    let filter = compoundForge.filters.NewYieldContracts();
    let tx = await router.newYieldContracts(
      consts.FORGE_COMPOUND,
      tokenUSDT.address,
      futureTime
    );

    let allEvents = await compoundForge.queryFilter(filter, tx.blockHash);
    expect(allEvents.length).to.be.eq(2);
    expect(allEvents[allEvents.length - 1].args!.ot).to.not.eq(0);
    expect(allEvents[allEvents.length - 1].args!.xyt).to.not.eq(0);
    expect(allEvents[allEvents.length - 1].args!.expiry).to.eq(futureTime);
  });

  it("should receive back exactly the same amount of cTokens", async () => {
    await tokenizeYield(alice, amount);

    await setTimeNextBlock(provider, consts.T0_C.add(consts.FIFTEEN_DAY));

    await router.redeemDueInterests(
      consts.FORGE_COMPOUND,
      tokenUSDT.address,
      consts.T0_C.add(consts.ONE_MONTH)
    );
    const rate = await cUSDT.callStatic.exchangeRateCurrent();
    const amt = amount
      .mul(10 ** 9)
      .mul(10 ** 9)
      .div(rate);
    await router.redeemUnderlying(
      consts.FORGE_COMPOUND,
      tokenUSDT.address,
      consts.T0_C.add(consts.ONE_MONTH),
      amt,
      alice.address,
      consts.HIGH_GAS_OVERRIDE
    );
    const curcUSDTbalanace = await cUSDT.balanceOf(alice.address);
    expect(initialcUSDTbalance.toNumber()).to.be.approximately(
      curcUSDTbalanace.toNumber(),
      5
    );
  });
});
