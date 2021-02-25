import { expect } from "chai";
import { createFixtureLoader } from "ethereum-waffle";
import { BigNumber as BN, Contract, Wallet } from "ethers";
import {
  amountToWei,
  getAContract,
  getCContract,
  mintAaveToken,
  mintCompoundToken,
  consts,
  evm_revert,
  evm_snapshot,
  setTimeNextBlock,
  Token,
  tokens,
} from "../helpers";
import { pendleFixture } from "./fixtures";

const { waffle } = require("hardhat");
const provider = waffle.provider;

describe("PendleRouter", async () => {
  const wallets = provider.getWallets();
  const loadFixture = createFixtureLoader(wallets, provider);
  const [alice, bob, charlie, dave] = wallets;

  let pendleRouter: Contract;
  let pendleTreasury: Contract;
  let pendleData: Contract;
  let pendleAOt: Contract;
  let pendleAXyt: Contract;
  let pendleCOt: Contract;
  let pendleCXyt: Contract;
  let lendingPoolCore: Contract;
  let pendleAaveForge: Contract;
  let pendleCompoundForge: Contract;
  let aUSDT: Contract;
  let cUSDT: Contract;
  let snapshotId: string;
  let globalSnapshotId: string;
  let tokenUSDT: Token;
  let amountToTokenize: BN;
  let initialAUSDTbalance: BN;
  let initialCUSDTbalance: BN;
  before(async () => {
    globalSnapshotId = await evm_snapshot();

    const fixture = await loadFixture(pendleFixture);
    pendleRouter = fixture.core.pendleRouter;
    pendleTreasury = fixture.core.pendleTreasury;
    pendleData = fixture.core.pendleData;
    pendleAOt = fixture.aForge.pendleAOwnershipToken;
    pendleCOt = fixture.cForge.pendleCOwnershipToken;
    pendleAXyt = fixture.aForge.pendleAFutureYieldToken;
    pendleCXyt = fixture.cForge.pendleCFutureYieldToken;
    pendleAaveForge = fixture.aForge.pendleAaveForge;
    pendleCompoundForge = fixture.cForge.pendleCompoundForge;
    lendingPoolCore = fixture.aave.lendingPoolCore;
    tokenUSDT = tokens.USDT;
    aUSDT = await getAContract(alice, lendingPoolCore, tokenUSDT);
    cUSDT = await getCContract(alice, tokens.USDT);
    snapshotId = await evm_snapshot();
  });

  after(async () => {
    await evm_revert(globalSnapshotId);
  });

  beforeEach(async () => {
    await evm_revert(snapshotId);
    snapshotId = await evm_snapshot();
    amountToTokenize = amountToWei(tokenUSDT, consts.INITIAL_AAVE_TOKEN_AMOUNT);
    initialAUSDTbalance = await aUSDT.balanceOf(alice.address);
    initialCUSDTbalance = await cUSDT.balanceOf(alice.address);
  });

  async function tokenizeYieldSample(amountToTokenize: BN) {
    await pendleRouter.tokenizeYield(
      consts.FORGE_AAVE,
      tokenUSDT.address,
      consts.T0.add(consts.SIX_MONTH),
      amountToTokenize,
      alice.address,
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

  it("should be able to deposit aUSDT to get back OT and XYT", async () => {
    await tokenizeYieldSample(amountToTokenize);
    const balanceOwnershipToken = await pendleAOt.balanceOf(alice.address);
    const balanceFutureYieldToken = await pendleAXyt.balanceOf(alice.address);
    expect(balanceOwnershipToken).to.be.eq(amountToTokenize);
    expect(balanceFutureYieldToken).to.be.eq(amountToTokenize);
  });

  it("[After 1 month] should be able to redeem aUSDT to get back OT, XYT and interests $", async () => {
    await tokenizeYieldSample(amountToTokenize);
    await startCalInterest(charlie, amountToTokenize);

    await setTimeNextBlock(provider, consts.T0.add(consts.ONE_MONTH));

    await pendleRouter.redeemUnderlying(
      consts.FORGE_AAVE,
      tokenUSDT.address,
      consts.T0.add(consts.SIX_MONTH),
      amountToTokenize,
      alice.address,
      consts.HIGH_GAS_OVERRIDE
    );

    const finalAUSDTbalance = await aUSDT.balanceOf(alice.address);

    const expectedGain = await getCurInterest(charlie, amountToTokenize);
    expect(finalAUSDTbalance.toNumber()).to.be.approximately(
      initialAUSDTbalance.add(expectedGain).toNumber(),
      1000
    );
  });

  it("[After 1 month] should be able to get due interests", async () => {
    await tokenizeYieldSample(amountToTokenize);
    await startCalInterest(charlie, amountToTokenize);

    const balance = await pendleAOt.balanceOf(alice.address);
    await pendleAOt.transfer(bob.address, balance);

    const afterLendingAUSDTbalance = await aUSDT.balanceOf(alice.address);

    await setTimeNextBlock(provider, consts.T0.add(consts.ONE_MONTH));

    await pendleRouter.redeemDueInterests(
      consts.FORGE_AAVE,
      tokenUSDT.address,
      consts.T0.add(consts.SIX_MONTH)
    );

    const expectedGain = await getCurInterest(charlie, amountToTokenize);
    const finalAUSDTbalance = await aUSDT.balanceOf(alice.address);

    expect(finalAUSDTbalance).to.be.below(initialAUSDTbalance);
    expect(finalAUSDTbalance.toNumber()).to.be.approximately(
      afterLendingAUSDTbalance.add(expectedGain).toNumber(),
      1000
    );
  });

  it("Another wallet should be able to receive interests from XYT", async () => {
    await startCalInterest(charlie, amountToTokenize);

    await tokenizeYieldSample(amountToTokenize);
    await pendleAXyt.transfer(bob.address, amountToTokenize);

    const T1 = consts.T0.add(consts.SIX_MONTH).sub(1);
    await setTimeNextBlock(provider, T1);

    await pendleRouter
      .connect(bob)
      .redeemDueInterests(
        consts.FORGE_AAVE,
        tokenUSDT.address,
        consts.T0.add(consts.SIX_MONTH)
      );

    const actualGain = await aUSDT.balanceOf(bob.address);
    const expectedGain = await getCurInterest(charlie, amountToTokenize);

    expect(actualGain.toNumber()).to.be.approximately(
      expectedGain.toNumber(),
      1000
    );
  });

  it("Short after expiry, should be able to redeem aUSDT from OT", async () => {
    await startCalInterest(charlie, amountToTokenize);

    await tokenizeYieldSample(amountToTokenize);
    await pendleAXyt.transfer(bob.address, amountToTokenize);

    const T1 = consts.T0.add(consts.SIX_MONTH).sub(1);
    await setTimeNextBlock(provider, T1);

    await pendleRouter
      .connect(bob)
      .redeemDueInterests(
        consts.FORGE_AAVE,
        tokenUSDT.address,
        consts.T0.add(consts.SIX_MONTH)
      );

    await startCalInterest(dave, amountToTokenize);

    const T2 = T1.add(10);
    await setTimeNextBlock(provider, T2);

    await pendleRouter.redeemAfterExpiry(
      consts.FORGE_AAVE,
      tokenUSDT.address,
      consts.T0.add(consts.SIX_MONTH),
      alice.address
    );

    const expectedGain = await getCurInterest(dave, amountToTokenize);

    const finalAUSDTbalance = await aUSDT.balanceOf(alice.address);

    expect(finalAUSDTbalance.toNumber()).to.be.approximately(
      initialAUSDTbalance.add(expectedGain).toNumber(),
      1000
    );
  });

  it("One month after expiry, should be able to redeem aUSDT with intrest", async () => {
    await startCalInterest(charlie, amountToTokenize);

    await tokenizeYieldSample(amountToTokenize);
    await pendleAXyt.transfer(bob.address, amountToTokenize);

    const T1 = consts.T0.add(consts.SIX_MONTH).sub(1);
    await setTimeNextBlock(provider, T1);

    await pendleRouter
      .connect(bob)
      .redeemDueInterests(
        consts.FORGE_AAVE,
        tokenUSDT.address,
        consts.T0.add(consts.SIX_MONTH)
      );

    await startCalInterest(dave, amountToTokenize);

    const T2 = T1.add(consts.ONE_MONTH);
    await setTimeNextBlock(provider, T2);

    await pendleRouter.redeemAfterExpiry(
      consts.FORGE_AAVE,
      tokenUSDT.address,
      consts.T0.add(consts.SIX_MONTH),
      alice.address
    );

    const expectedGain = await getCurInterest(dave, amountToTokenize);
    const finalAUSDTbalance = await aUSDT.balanceOf(alice.address);
    expect(finalAUSDTbalance.toNumber()).to.be.approximately(
      initialAUSDTbalance.add(expectedGain).toNumber(),
      1000
    );
  });

  it("Should be able to newYieldContracts", async () => {
    let futureTime = consts.T0.add(consts.SIX_MONTH).add(consts.ONE_DAY);
    let filter = pendleAaveForge.filters.NewYieldContracts();
    let tx = await pendleRouter.newYieldContracts(
      consts.FORGE_AAVE,
      tokenUSDT.address,
      futureTime
    );

    let allEvents = await pendleAaveForge.queryFilter(filter, tx.blockHash);
    expect(allEvents.length).to.be.eq(3); // there is two events of the same type before this event
    expect(allEvents[allEvents.length - 1].args!.ot).to.not.eq(0);
    expect(allEvents[allEvents.length - 1].args!.xyt).to.not.eq(0);
    expect(allEvents[allEvents.length - 1].args!.expiry).to.eq(futureTime);
  });
});
