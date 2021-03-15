import { expect } from "chai";
import { createFixtureLoader } from "ethereum-waffle";
import { BigNumber as BN, Contract, Wallet } from "ethers";
import {
  amountToWei,
  approxBigNumber,
  consts,
  evm_revert,
  evm_snapshot,
  getAContract,
  mintAaveToken,
  setTimeNextBlock,
  Token,
  tokens,
  errMsg,
} from "../helpers";
import { pendleFixture } from "./fixtures";

const { waffle } = require("hardhat");
const provider = waffle.provider;

describe("PendleAaveRouter", async () => {
  const wallets = provider.getWallets();
  const loadFixture = createFixtureLoader(wallets, provider);
  const [alice, bob, charlie, dave] = wallets;

  let router: Contract;
  let routerWeb3: any;
  let aOt: Contract;
  let aXyt: Contract;
  let lendingPoolCore: Contract;
  let aaveForge: Contract;
  let aUSDT: Contract;
  let snapshotId: string;
  let globalSnapshotId: string;
  let tokenUSDT: Token;
  let amount: BN;
  let initialAUSDTbalance: BN;
  before(async () => {
    globalSnapshotId = await evm_snapshot();

    const fixture = await loadFixture(pendleFixture);
    router = fixture.core.router;
    routerWeb3 = fixture.core.routerWeb3;
    aOt = fixture.aForge.aOwnershipToken;
    aXyt = fixture.aForge.aFutureYieldToken;
    aaveForge = fixture.aForge.aaveForge;
    lendingPoolCore = fixture.aave.lendingPoolCore;
    tokenUSDT = tokens.USDT;
    aUSDT = await getAContract(alice, lendingPoolCore, tokenUSDT);
    snapshotId = await evm_snapshot();
  });

  after(async () => {
    await evm_revert(globalSnapshotId);
  });

  beforeEach(async () => {
    await evm_revert(snapshotId);
    snapshotId = await evm_snapshot();
    amount = amountToWei(consts.INITIAL_AAVE_TOKEN_AMOUNT, 6);
    initialAUSDTbalance = await aUSDT.balanceOf(alice.address);
  });

  async function tokenizeYield(user: Wallet, amount: BN) {
    await router.tokenizeYield(
      consts.FORGE_AAVE,
      tokenUSDT.address,
      consts.T0.add(consts.SIX_MONTH),
      amount,
      user.address,
      consts.HIGH_GAS_OVERRIDE
    );
  }

  async function startCalInterest(walletToUse: Wallet, initialAmount: BN) {
    // divide by 10^decimal since mintAaveToken will multiply that number back
    await mintAaveToken(
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
    return (await aUSDT.balanceOf(walletToUse.address)).sub(initialAmount);
  }

  it("should receive the interest from xyt when do tokenizeYield", async () => {
    await startCalInterest(charlie, amount);
    await tokenizeYield(alice, amount.div(2));

    await setTimeNextBlock(provider, consts.T0.add(consts.ONE_MONTH));
    await tokenizeYield(alice, amount.div(2));

    const expectedGain = await getCurInterest(charlie, amount);

    // because we have tokenized all aUSDT of alice, curAUSDTbalanace will equal to the interest
    // she has received from her xyt
    const curAUSDTbalance = await aUSDT.balanceOf(alice.address);
    approxBigNumber(curAUSDTbalance, expectedGain, BN.from(1000));
  });

  it("underlying asset's address should match the original asset", async () => {
    expect((await aOt.underlyingAsset()).toLowerCase()).to.be.equal(
      tokens.USDT.address.toLowerCase()
    );
    expect((await aXyt.underlyingAsset()).toLowerCase()).to.be.equal(
      tokens.USDT.address.toLowerCase()
    );
  });

  it("shouldn't be able to do newYieldContract with an expiry in the past", async () => {
    let futureTime = consts.T0.sub(consts.ONE_MONTH);
    await expect(
      router.newYieldContracts(consts.FORGE_AAVE, tokenUSDT.address, futureTime)
    ).to.be.revertedWith(errMsg.INVALID_EXPIRY);
  });

  it("should be able to deposit aUSDT to get back OT and XYT", async () => {
    await tokenizeYield(alice, amount);
    const balanceOwnershipToken = await aOt.balanceOf(alice.address);
    const balanceFutureYieldToken = await aXyt.balanceOf(alice.address);
    expect(balanceOwnershipToken).to.be.eq(amount);
    expect(balanceFutureYieldToken).to.be.eq(amount);
  });

  it("shouldn't be able to call redeemUnderlying if the yield contract has expired", async () => {
    await tokenizeYield(alice, amount);
    await startCalInterest(charlie, amount);

    await setTimeNextBlock(provider, consts.T0.add(consts.ONE_YEAR));

    await expect(
      router.redeemUnderlying(
        consts.FORGE_AAVE,
        tokenUSDT.address,
        consts.T0.add(consts.SIX_MONTH),
        amount,
        alice.address,
        consts.HIGH_GAS_OVERRIDE
      )
    ).to.be.revertedWith(errMsg.YIELD_CONTRACT_EXPIRED);
  });

  it("[After 1 month] should be able to redeem aUSDT to get back OT, XYT and interests $", async () => {
    await tokenizeYield(alice, amount);
    await startCalInterest(charlie, amount);

    await setTimeNextBlock(provider, consts.T0.add(consts.ONE_MONTH));

    await router.redeemUnderlying(
      consts.FORGE_AAVE,
      tokenUSDT.address,
      consts.T0.add(consts.SIX_MONTH),
      amount,
      alice.address,
      consts.HIGH_GAS_OVERRIDE
    );

    const finalAUSDTbalance = await aUSDT.balanceOf(alice.address);

    const expectedGain = await getCurInterest(charlie, amount);
    expect(finalAUSDTbalance.toNumber()).to.be.approximately(
      initialAUSDTbalance.add(expectedGain).toNumber(),
      1000
    );
  });

  it("[After 1 month] should be able to get due interests", async () => {
    await tokenizeYield(alice, amount);
    await startCalInterest(charlie, amount);

    const balance = await aOt.balanceOf(alice.address);
    await aOt.transfer(bob.address, balance);

    const afterLendingAUSDTbalance = await aUSDT.balanceOf(alice.address);

    await setTimeNextBlock(provider, consts.T0.add(consts.ONE_MONTH));

    await router.redeemDueInterests(
      consts.FORGE_AAVE,
      tokenUSDT.address,
      consts.T0.add(consts.SIX_MONTH)
    );

    const expectedGain = await getCurInterest(charlie, amount);
    const finalAUSDTbalance = await aUSDT.balanceOf(alice.address);

    expect(finalAUSDTbalance).to.be.below(initialAUSDTbalance);
    expect(finalAUSDTbalance.toNumber()).to.be.approximately(
      afterLendingAUSDTbalance.add(expectedGain).toNumber(),
      1000
    );
  });

  it("Another wallet should be able to receive interests from XYT", async () => {
    await startCalInterest(charlie, amount);

    await tokenizeYield(alice, amount);
    await aXyt.transfer(bob.address, amount);

    const T1 = consts.T0.add(consts.SIX_MONTH).sub(1);
    await setTimeNextBlock(provider, T1);

    await router
      .connect(bob)
      .redeemDueInterests(
        consts.FORGE_AAVE,
        tokenUSDT.address,
        consts.T0.add(consts.SIX_MONTH)
      );

    const actualGain = await aUSDT.balanceOf(bob.address);
    const expectedGain = await getCurInterest(charlie, amount);

    expect(actualGain.toNumber()).to.be.approximately(
      expectedGain.toNumber(),
      1000
    );
  });

  it("Short after expiry, should be able to redeem aUSDT from OT", async () => {
    await startCalInterest(charlie, amount);

    await tokenizeYield(alice, amount);
    await aXyt.transfer(bob.address, amount);

    const T1 = consts.T0.add(consts.SIX_MONTH).sub(1);
    await setTimeNextBlock(provider, T1);

    await router
      .connect(bob)
      .redeemDueInterests(
        consts.FORGE_AAVE,
        tokenUSDT.address,
        consts.T0.add(consts.SIX_MONTH)
      );

    approxBigNumber(
      await aUSDT.balanceOf(bob.address),
      await getCurInterest(charlie, amount),
      BN.from(2000),
      false
    );

    await startCalInterest(dave, amount);

    const T2 = T1.add(10);
    await setTimeNextBlock(provider, T2);

    await router.redeemAfterExpiry(
      consts.FORGE_AAVE,
      tokenUSDT.address,
      consts.T0.add(consts.SIX_MONTH),
      alice.address
    );

    const expectedGain = await getCurInterest(dave, amount);

    const finalAUSDTbalance = await aUSDT.balanceOf(alice.address);

    expect(finalAUSDTbalance.toNumber()).to.be.approximately(
      initialAUSDTbalance.add(expectedGain).toNumber(),
      1000
    );
  });

  it("One month after expiry, should be able to redeem aUSDT with intrest", async () => {
    await startCalInterest(charlie, amount);

    await tokenizeYield(alice, amount);
    await aXyt.transfer(bob.address, amount);

    const T1 = consts.T0.add(consts.SIX_MONTH).sub(1);
    await setTimeNextBlock(provider, T1);

    await router
      .connect(bob)
      .redeemDueInterests(
        consts.FORGE_AAVE,
        tokenUSDT.address,
        consts.T0.add(consts.SIX_MONTH)
      );

    approxBigNumber(
      await aUSDT.balanceOf(bob.address),
      await getCurInterest(charlie, amount),
      BN.from(2000),
      false
    );

    await startCalInterest(dave, amount);

    const T2 = T1.add(consts.ONE_MONTH);
    await setTimeNextBlock(provider, T2);

    await router.redeemAfterExpiry(
      consts.FORGE_AAVE,
      tokenUSDT.address,
      consts.T0.add(consts.SIX_MONTH),
      alice.address
    );

    const expectedGain = await getCurInterest(dave, amount);
    const finalAUSDTbalance = await aUSDT.balanceOf(alice.address);
    expect(finalAUSDTbalance.toNumber()).to.be.approximately(
      initialAUSDTbalance.add(expectedGain).toNumber(),
      1000
    );
  });

  it("Should be able to newYieldContracts", async () => {
    let futureTime = consts.T0.add(consts.SIX_MONTH).add(consts.ONE_DAY);
    let filter = aaveForge.filters.NewYieldContracts();
    let tx = await router.newYieldContracts(
      consts.FORGE_AAVE,
      tokenUSDT.address,
      futureTime
    );

    let allEvents = await aaveForge.queryFilter(filter, tx.blockHash);
    expect(allEvents.length).to.be.eq(3); // there is two events of the same type before this event
    expect(allEvents[allEvents.length - 1].args!.ot).to.not.eq(0);
    expect(allEvents[allEvents.length - 1].args!.xyt).to.not.eq(0);
    expect(allEvents[allEvents.length - 1].args!.expiry).to.eq(futureTime);
  });
});
