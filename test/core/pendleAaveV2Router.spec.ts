import { expect } from "chai";
import { createFixtureLoader } from "ethereum-waffle";
import { BigNumber as BN, Contract, Wallet } from "ethers";
import {
  amountToWei,
  approxBigNumber,
  getA2Contract,
  consts,
  evm_revert,
  evm_snapshot,
  mintAaveV2Token,
  setTimeNextBlock,
  Token,
  tokens,
  errMsg,
} from "../helpers";
import { pendleFixture } from "./fixtures";

const { waffle } = require("hardhat");
const provider = waffle.provider;

describe("pendleAaveV2Router", async () => {
  const wallets = provider.getWallets();
  const loadFixture = createFixtureLoader(wallets, provider);
  const [alice, bob, charlie, dave] = wallets;

  let router: Contract;
  let routerWeb3: any;
  let aOt: Contract;
  let aXyt: Contract;
  let aaveV2Forge: Contract;
  let aUSDT: Contract;
  let snapshotId: string;
  let globalSnapshotId: string;
  let tokenUSDT: Token;
  let refAmount: BN;
  let initialAUSDTbalance: BN;
  before(async () => {
    globalSnapshotId = await evm_snapshot();

    const fixture = await loadFixture(pendleFixture);
    router = fixture.core.router;
    routerWeb3 = fixture.core.routerWeb3;
    aOt = fixture.a2Forge.a2OwnershipToken;
    aXyt = fixture.a2Forge.a2FutureYieldToken;
    aaveV2Forge = fixture.a2Forge.aaveV2Forge;
    tokenUSDT = tokens.USDT;
    aUSDT = await getA2Contract(alice, aaveV2Forge, tokenUSDT);
    snapshotId = await evm_snapshot();
  });

  after(async () => {
    await evm_revert(globalSnapshotId);
  });

  beforeEach(async () => {
    await evm_revert(snapshotId);
    snapshotId = await evm_snapshot();
    refAmount = amountToWei(consts.INITIAL_AAVE_TOKEN_AMOUNT, 6);
    initialAUSDTbalance = await aUSDT.balanceOf(alice.address);
  });

  async function tokenizeYield(user: Wallet, amount: BN): Promise<BN> {
    let amountTokenMinted = await aOt.balanceOf(user.address);
    await router.tokenizeYield(
      consts.FORGE_AAVE_V2,
      tokenUSDT.address,
      consts.T0_A2.add(consts.SIX_MONTH),
      amount,
      user.address,
      consts.HIGH_GAS_OVERRIDE
    );
    amountTokenMinted = (await aOt.balanceOf(user.address)).sub(
      amountTokenMinted
    );
    return amountTokenMinted;
  }

  async function startCalInterest(walletToUse: Wallet, initialAmount: BN) {
    // divide by 10^decimal since mintAaveV2Token will multiply that number back
    await mintAaveV2Token(
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

  it("underlying asset's address should match the original asset", async () => {
    expect((await aOt.underlyingAsset()).toLowerCase()).to.be.equal(
      tokens.USDT.address.toLowerCase()
    );
    expect((await aXyt.underlyingAsset()).toLowerCase()).to.be.equal(
      tokens.USDT.address.toLowerCase()
    );
  });

  it("shouldn't be able to do newYieldContract with an expiry in the past", async () => {
    let futureTime = consts.T0_A2.sub(consts.ONE_MONTH);
    await expect(
      router.newYieldContracts(
        consts.FORGE_AAVE_V2,
        tokenUSDT.address,
        futureTime
      )
    ).to.be.revertedWith(errMsg.INVALID_EXPIRY);
  });

  it("should be able to deposit aUSDT to get back OT and XYT", async () => {
    let amount = await tokenizeYield(alice, refAmount);
    const balanceOwnershipToken = await aOt.balanceOf(alice.address);
    const balanceFutureYieldToken = await aXyt.balanceOf(alice.address);
    expect(balanceOwnershipToken).to.be.eq(amount);
    expect(balanceFutureYieldToken).to.be.eq(amount);
  });

  it("shouldn't be able to call redeemUnderlying if the yield contract has expired", async () => {
    let amount = await tokenizeYield(alice, refAmount);

    await setTimeNextBlock(provider, consts.T0_A2.add(consts.ONE_YEAR));

    await expect(
      router.redeemUnderlying(
        consts.FORGE_AAVE_V2,
        tokenUSDT.address,
        consts.T0_A2.add(consts.SIX_MONTH),
        amount,
        alice.address,
        consts.HIGH_GAS_OVERRIDE
      )
    ).to.be.revertedWith(errMsg.YIELD_CONTRACT_EXPIRED);
  });

  it("[After 1 month] should be able to redeem aUSDT to get back OT, XYT and interests $", async () => {
    await startCalInterest(charlie, refAmount);
    let amount = await tokenizeYield(alice, refAmount);
    await setTimeNextBlock(provider, consts.T0_A2.add(consts.ONE_MONTH));

    await router.redeemUnderlying(
      consts.FORGE_AAVE_V2,
      tokenUSDT.address,
      consts.T0_A2.add(consts.SIX_MONTH),
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
    await setTimeNextBlock(provider, consts.T0_A2.add(consts.ONE_MONTH));

    await router.redeemUnderlying(
      consts.FORGE_AAVE_V2,
      tokenUSDT.address,
      consts.T0_A2.add(consts.SIX_MONTH),
      BN.from(0),
      alice.address,
      consts.HIGH_GAS_OVERRIDE
    );
  });

  it("[After 1 month] should be able to get due interests", async () => {
    await startCalInterest(charlie, refAmount);
    let amount = await tokenizeYield(alice, refAmount);

    await aOt.transfer(bob.address, await aOt.balanceOf(alice.address));

    const afterLendingAUSDTbalance = await aUSDT.balanceOf(alice.address);

    await setTimeNextBlock(provider, consts.T0_A2.add(consts.ONE_MONTH));

    await router.redeemDueInterests(
      consts.FORGE_AAVE_V2,
      tokenUSDT.address,
      consts.T0_A2.add(consts.SIX_MONTH)
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
    await aXyt.transfer(bob.address, amount);

    const T1 = consts.T0_A2.add(consts.SIX_MONTH).sub(1);
    await setTimeNextBlock(provider, T1);

    await router
      .connect(bob)
      .redeemDueInterests(
        consts.FORGE_AAVE_V2,
        tokenUSDT.address,
        consts.T0_A2.add(consts.SIX_MONTH)
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
    await aXyt.transfer(bob.address, amount);

    const T1 = consts.T0_A2.add(consts.SIX_MONTH).sub(1);
    await setTimeNextBlock(provider, T1);

    await router
      .connect(bob)
      .redeemDueInterests(
        consts.FORGE_AAVE_V2,
        tokenUSDT.address,
        consts.T0_A2.add(consts.SIX_MONTH)
      );

    approxBigNumber(
      await aUSDT.balanceOf(bob.address),
      await getCurInterest(charlie, refAmount),
      BN.from(10000),
      false
    );

    await startCalInterest(dave, refAmount);

    const T2 = T1.add(10);
    await setTimeNextBlock(provider, T2);

    await router.redeemAfterExpiry(
      consts.FORGE_AAVE_V2,
      tokenUSDT.address,
      consts.T0_A2.add(consts.SIX_MONTH),
      alice.address
    );

    const expectedGain = await getCurInterest(dave, refAmount);
    const finalAUSDTbalance = await aUSDT.balanceOf(alice.address);
    approxBigNumber(
      finalAUSDTbalance,
      initialAUSDTbalance.add(expectedGain),
      BN.from(10000),
      false
    );
  });

  it("One month after expiry, should be able to redeem aUSDT with interest", async () => {
    await startCalInterest(charlie, refAmount);
    let amount = await tokenizeYield(alice, refAmount);
    await aXyt.transfer(bob.address, amount);

    const T1 = consts.T0_A2.add(consts.SIX_MONTH).sub(1);
    await setTimeNextBlock(provider, T1);

    await router
      .connect(bob)
      .redeemDueInterests(
        consts.FORGE_AAVE_V2,
        tokenUSDT.address,
        consts.T0_A2.add(consts.SIX_MONTH)
      );

    await startCalInterest(dave, refAmount);
    approxBigNumber(
      await aUSDT.balanceOf(bob.address),
      await getCurInterest(charlie, refAmount),
      BN.from(10000),
      true
    );

    const T2 = T1.add(consts.ONE_MONTH);
    await setTimeNextBlock(provider, T2);

    await router.redeemAfterExpiry(
      consts.FORGE_AAVE_V2,
      tokenUSDT.address,
      consts.T0_A2.add(consts.SIX_MONTH),
      alice.address
    );

    const expectedGain = await getCurInterest(dave, refAmount);
    const finalAUSDTbalance = await aUSDT.balanceOf(alice.address);
    approxBigNumber(
      finalAUSDTbalance,
      initialAUSDTbalance.add(expectedGain),
      BN.from(10000),
      true
    );
  });

  it("Should be able to newYieldContracts", async () => {
    let futureTime = consts.T0_A2.add(consts.SIX_MONTH).add(consts.ONE_DAY);
    let filter = aaveV2Forge.filters.NewYieldContracts();
    let tx = await router.newYieldContracts(
      consts.FORGE_AAVE_V2,
      tokenUSDT.address,
      futureTime
    );

    let allEvents = await aaveV2Forge.queryFilter(filter, tx.blockHash);
    expect(allEvents.length).to.be.eq(3); // there is two events of the same type before this event
    expect(allEvents[allEvents.length - 1].args!.ot).to.not.eq(0);
    expect(allEvents[allEvents.length - 1].args!.xyt).to.not.eq(0);
    expect(allEvents[allEvents.length - 1].args!.expiry).to.eq(futureTime);
  });

  it("Should be able to redeemDueInterestsMultiple", async () => {
    await startCalInterest(dave, refAmount);
    await router.newYieldContracts(
      consts.FORGE_AAVE_V2,
      tokenUSDT.address,
      consts.T0_A2.add(consts.ONE_YEAR)
    );
    await tokenizeYield(alice, refAmount.div(2));
    await router.tokenizeYield(
      consts.FORGE_AAVE_V2,
      tokenUSDT.address,
      consts.T0_A2.add(consts.ONE_YEAR),
      refAmount.div(2),
      alice.address,
      consts.HIGH_GAS_OVERRIDE
    );
    await setTimeNextBlock(provider, consts.T0_A2.add(consts.FIVE_MONTH));
    await router.redeemDueInterestsMultiple(
      [consts.FORGE_AAVE_V2, consts.FORGE_AAVE_V2],
      [tokenUSDT.address, tokenUSDT.address],
      [consts.T0_A2.add(consts.SIX_MONTH), consts.T0_A2.add(consts.ONE_YEAR)]
    );
    let actualGain = await aUSDT.balanceOf(alice.address);
    let expectedGain = await getCurInterest(dave, refAmount);
    approxBigNumber(actualGain, expectedGain, BN.from(10000));
  });

  it("Should be able to renewYield", async () => {
    await router.newYieldContracts(
      consts.FORGE_AAVE_V2,
      tokenUSDT.address,
      consts.T0_A2.add(consts.ONE_YEAR)
    );
    await startCalInterest(dave, refAmount);
    let amount = await tokenizeYield(alice, refAmount);
    await setTimeNextBlock(provider, consts.T0_A2.add(consts.ONE_MONTH.mul(7)));
    await router.renewYield(
      consts.FORGE_AAVE_V2,
      consts.T0_A2.add(consts.SIX_MONTH),
      tokenUSDT.address,
      consts.T0_A2.add(consts.ONE_YEAR),
      amount,
      alice.address
    );
    await setTimeNextBlock(
      provider,
      consts.T0_A2.add(consts.ONE_MONTH.mul(11))
    );
    await router.redeemDueInterests(
      consts.FORGE_AAVE_V2,
      tokenUSDT.address,
      consts.T0_A2.add(consts.ONE_YEAR)
    );
    let actualGain = await aUSDT.balanceOf(alice.address);
    let expectedGain = await getCurInterest(dave, refAmount);
    approxBigNumber(actualGain, expectedGain, BN.from(10000));
  });
});
