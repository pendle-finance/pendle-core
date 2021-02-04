import { expect } from "chai";
import { Contract, BigNumber as BN, Wallet } from "ethers";
import { createFixtureLoader } from "ethereum-waffle";

import { pendleFixture } from "./fixtures";
import {
  consts,
  tokens,
  amountToWei,
  getAContract,
  mintAaveToken,
  advanceTime,
  getLiquidityRate,
  getGain,
  evm_revert,
  evm_snapshot,
  Token,
  setTimeNextBlock,
} from "../helpers";
import { toUtf8CodePoints } from "ethers/lib/utils";

const { waffle } = require("hardhat");
const provider = waffle.provider;

describe("PendleRouter", async () => {
  const wallets = provider.getWallets();
  const loadFixture = createFixtureLoader(wallets, provider);
  const [wallet, wallet1, charlie, dave] = wallets;

  let pendleRouter: Contract;
  let pendleTreasury: Contract;
  let pendleMarketFactory: Contract;
  let pendleData: Contract;
  let pendleOt: Contract;
  let pendleXyt: Contract;
  let lendingPoolCore: Contract;
  let pendleAaveForge: Contract;
  let aUSDT: Contract;
  let snapshotId: string;
  let globalSnapshotId: string;
  let tokenUSDT: Token;
  let amountToTokenize: BN;
  let initialAUSDTbalance: BN;
  before(async () => {
    globalSnapshotId = await evm_snapshot();

    const fixture = await loadFixture(pendleFixture);
    pendleRouter = fixture.core.pendleRouter;
    pendleTreasury = fixture.core.pendleTreasury;
    pendleMarketFactory = fixture.core.pendleMarketFactory;
    pendleData = fixture.core.pendleData;
    pendleOt = fixture.forge.pendleOwnershipToken;
    pendleXyt = fixture.forge.pendleFutureYieldToken;
    pendleAaveForge = fixture.forge.pendleAaveForge;
    lendingPoolCore = fixture.aave.lendingPoolCore;
    tokenUSDT = tokens.USDT;
    aUSDT = await getAContract(wallet, lendingPoolCore, tokenUSDT);
    snapshotId = await evm_snapshot();
  });

  after(async () => {
    await evm_revert(globalSnapshotId);
  });

  beforeEach(async () => {
    await evm_revert(snapshotId);
    snapshotId = await evm_snapshot();
    amountToTokenize = amountToWei(tokenUSDT, consts.INITIAL_AAVE_TOKEN_AMOUNT);
    initialAUSDTbalance = await aUSDT.balanceOf(wallet.address);
  });

  async function tokenizeYieldSample(amountToTokenize: BN) {
    await pendleRouter.tokenizeYield(
      consts.FORGE_AAVE,
      tokenUSDT.address,
      consts.T0.add(consts.SIX_MONTH),
      amountToTokenize,
      wallet.address
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
    const balanceOwnershipToken = await pendleOt.balanceOf(wallet.address);
    const balanceFutureYieldToken = await pendleXyt.balanceOf(wallet.address);
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
      wallet.address,
      consts.HIGH_GAS_OVERRIDE
    );

    const finalAUSDTbalance = await aUSDT.balanceOf(wallet.address);

    const expectedGain = await getCurInterest(charlie, amountToTokenize);
    expect(finalAUSDTbalance.toNumber()).to.be.approximately(
      initialAUSDTbalance.add(expectedGain).toNumber(),
      1000
    );
  });

  it("[After 1 month] should be able to get due interests", async () => {
    await tokenizeYieldSample(amountToTokenize);
    await startCalInterest(charlie, amountToTokenize);

    const balance = await pendleOt.balanceOf(wallet.address);
    await pendleOt.transfer(wallet1.address, balance);

    const afterLendingAUSDTbalance = await aUSDT.balanceOf(wallet.address);

    await setTimeNextBlock(provider, consts.T0.add(consts.ONE_MONTH));

    await pendleRouter.redeemDueInterests(
      consts.FORGE_AAVE,
      tokenUSDT.address,
      consts.T0.add(consts.SIX_MONTH)
    );

    const expectedGain = await getCurInterest(charlie, amountToTokenize);
    const finalAUSDTbalance = await aUSDT.balanceOf(wallet.address);

    expect(finalAUSDTbalance).to.be.below(initialAUSDTbalance);
    expect(finalAUSDTbalance.toNumber()).to.be.approximately(
      afterLendingAUSDTbalance.add(expectedGain).toNumber(),
      1000
    );
  });

  it("Another wallet should be able to receive interests from XYT", async () => {
    await startCalInterest(charlie, amountToTokenize);

    await tokenizeYieldSample(amountToTokenize);
    await pendleXyt.transfer(wallet1.address, amountToTokenize);

    const T1 = consts.T0.add(consts.SIX_MONTH).sub(1);
    await setTimeNextBlock(provider, T1);

    await pendleRouter
      .connect(wallet1)
      .redeemDueInterests(
        consts.FORGE_AAVE,
        tokenUSDT.address,
        consts.T0.add(consts.SIX_MONTH)
      );

    const actualGain = await aUSDT.balanceOf(wallet1.address);
    const expectedGain = await getCurInterest(charlie, amountToTokenize);

    console.log(actualGain.sub(expectedGain).toString());
    expect(actualGain.toNumber()).to.be.approximately(
      expectedGain.toNumber(),
      1000
    );
  });

  it("Short after expiry, should be able to redeem aUSDT from OT", async () => {
    await startCalInterest(charlie, amountToTokenize);

    await tokenizeYieldSample(amountToTokenize);
    await pendleXyt.transfer(wallet1.address, amountToTokenize);

    const T1 = consts.T0.add(consts.SIX_MONTH).sub(1);
    await setTimeNextBlock(provider, T1);

    await pendleRouter
      .connect(wallet1)
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
      wallet.address
    );

    const expectedGain = await getCurInterest(dave, amountToTokenize);

    const finalAUSDTbalance = await aUSDT.balanceOf(wallet.address);
    console.log(
      finalAUSDTbalance.sub(initialAUSDTbalance.add(expectedGain)).toString()
    );

    expect(finalAUSDTbalance.toNumber()).to.be.approximately(
      initialAUSDTbalance.add(expectedGain).toNumber(),
      1000
    );
  });

  it("One month after expiry, should be able to redeem aUSDT with intrest", async () => {
    await startCalInterest(charlie, amountToTokenize);

    await tokenizeYieldSample(amountToTokenize);
    await pendleXyt.transfer(wallet1.address, amountToTokenize);

    const T1 = consts.T0.add(consts.SIX_MONTH).sub(1);
    await setTimeNextBlock(provider, T1);

    await pendleRouter
      .connect(wallet1)
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
      wallet.address
    );

    const expectedGain = await getCurInterest(dave, amountToTokenize);
    const finalAUSDTbalance = await aUSDT.balanceOf(wallet.address);
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
    expect(allEvents.length).to.be.eq(2); // there is only one event of the same type before this event
    expect(allEvents[1].args!.ot).to.not.eq(0);
    expect(allEvents[1].args!.xyt).to.not.eq(0);
    expect(allEvents[1].args!.expiry).to.eq(futureTime);
  });
});
