import { expect } from "chai";
import { Contract, BigNumber } from "ethers";
import { createFixtureLoader } from "ethereum-waffle";

import { pendleFixture } from "./fixtures";
import {
  constants,
  tokens,
  amountToWei,
  getAContract,
  advanceTime,
  getLiquidityRate,
  getGain,
  evm_revert,
  evm_snapshot,
  Token,
} from "../helpers";
import { toUtf8CodePoints } from "ethers/lib/utils";

const { waffle } = require("hardhat");
const provider = waffle.provider;

describe("Pendle", async () => {
  const wallets = provider.getWallets();
  const loadFixture = createFixtureLoader(wallets, provider);
  const [wallet, wallet1] = wallets;

  let pendleRouter: Contract;
  let pendleTreasury: Contract;
  let pendleAaveMarketFactory: Contract;
  let pendleData: Contract;
  let pendleOt: Contract;
  let pendleXyt: Contract;
  let lendingPoolCore: Contract;
  let pendleAaveForge: Contract;
  let aUSDT: Contract;
  let snapshotId: string;
  let globalSnapshotId: string;
  let tokenUSDT: Token;
  before(async () => {
    globalSnapshotId = await evm_snapshot();

    const fixture = await loadFixture(pendleFixture);
    pendleRouter = fixture.router.pendleRouter;
    pendleTreasury = fixture.router.pendleTreasury;
    pendleAaveMarketFactory = fixture.router.pendleAaveMarketFactory;
    pendleData = fixture.router.pendleData;
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
  });

  it("should be able to deposit aUSDT to get back OT and XYT", async () => {
    const amountToTokenize = amountToWei(tokenUSDT, BigNumber.from(100));
    await pendleRouter.tokenizeYield(
      constants.FORGE_AAVE,
      tokenUSDT.address,
      constants.SIX_MONTH_FROM_NOW,
      amountToTokenize,
      wallet.address,
    );
    const balanceOwnershipToken = await pendleOt.balanceOf(wallet.address);
    const balanceFutureYieldToken = await pendleXyt.balanceOf(wallet.address);
    expect(balanceOwnershipToken).to.be.eq(amountToTokenize);
    expect(balanceFutureYieldToken).to.be.eq(amountToTokenize);
  });

  it("[After 1 month] should be able to redeem aUSDT to get back OT, XYT and interests $", async () => {
    const initialAUSDTbalance = await aUSDT.balanceOf(wallet.address);
    const amountToTokenize = amountToWei(tokenUSDT, BigNumber.from(100));
    await pendleRouter.tokenizeYield(
      constants.FORGE_AAVE,
      tokenUSDT.address,
      constants.SIX_MONTH_FROM_NOW,
      amountToTokenize,
      wallet.address,
    );
    await advanceTime(provider, constants.ONE_MONTH);

    await pendleRouter.redeemUnderlying(
      constants.FORGE_AAVE,
      tokenUSDT.address,
      constants.SIX_MONTH_FROM_NOW,
      amountToTokenize,
      wallet.address,
    );

    const finalAUSDTbalance = await aUSDT.balanceOf(wallet.address);
    const rate = await getLiquidityRate(wallet, tokenUSDT);
    const gain = getGain(amountToTokenize, rate, constants.ONE_MONTH);
    expect(finalAUSDTbalance.toNumber()).to.be.approximately(
      initialAUSDTbalance.add(gain).toNumber(),
      20
    );
  });

  it("[After 1 month] should be able to get due interests", async () => {
    const amountToTokenize = amountToWei(tokenUSDT, BigNumber.from(100));
    const initialAUSDTbalance = await aUSDT.balanceOf(wallet.address);

    await pendleRouter.tokenizeYield(
      constants.FORGE_AAVE,
      tokenUSDT.address,
      constants.SIX_MONTH_FROM_NOW,
      amountToTokenize,
      wallet.address
    );

    const balance = await pendleOt.balanceOf(wallet.address);
    await pendleOt.transfer(wallet1.address, balance);

    const afterLendingAUSDTbalance = await aUSDT.balanceOf(wallet.address);
    await advanceTime(provider, constants.ONE_MONTH);

    await pendleRouter.redeemDueInterests(
      constants.FORGE_AAVE,
      tokenUSDT.address,
      constants.SIX_MONTH_FROM_NOW
    );

    const rate = await getLiquidityRate(wallet, tokenUSDT);
    const gain = getGain(amountToTokenize, rate, constants.ONE_MONTH);

    const finalAUSDTbalance = await aUSDT.balanceOf(wallet.address);

    expect(finalAUSDTbalance).to.be.below(initialAUSDTbalance);
    expect(finalAUSDTbalance.toNumber()).to.be.approximately(
      afterLendingAUSDTbalance.add(gain).toNumber(),
      10
    );
  });

  it("Short after expiry, should be able to redeem aUSDT from OT", async () => {
    const amountToTokenize = amountToWei(tokenUSDT, BigNumber.from(100));
    const initialAUSDTbalance = await aUSDT.balanceOf(wallet.address);

    await pendleRouter.tokenizeYield(
      constants.FORGE_AAVE,
      tokenUSDT.address,
      constants.SIX_MONTH_FROM_NOW,
      amountToTokenize,
      wallet.address
    );
    await pendleXyt.transfer(wallet1.address, amountToTokenize);
    const duration = constants.SIX_MONTH_FROM_NOW.sub(
      Math.round(Date.now() / 1000)
    ).sub(180);

    await advanceTime(provider, duration);

    const wallet1Pendle = pendleRouter.connect(wallet1);

    await wallet1Pendle.redeemDueInterests(
      constants.FORGE_AAVE,
      tokenUSDT.address,
      constants.SIX_MONTH_FROM_NOW
    );

    const wallet1Gain = await aUSDT.balanceOf(wallet1.address);
    let rate = await getLiquidityRate(wallet, tokenUSDT);
    let gain = getGain(amountToTokenize, rate, duration);

    expect(wallet1Gain.toNumber()).to.be.approximately(gain.toNumber(), 20);

    await advanceTime(provider, BigNumber.from(360));

    await pendleRouter.redeemAfterExpiry(
      constants.FORGE_AAVE,
      tokenUSDT.address,
      constants.SIX_MONTH_FROM_NOW,
      wallet.address
    );

    const finalAUSDTbalance = await aUSDT.balanceOf(wallet.address);
    expect(finalAUSDTbalance.toNumber()).to.be.approximately(
      initialAUSDTbalance.toNumber(),
      150
    );
  });

  it("One month after expiry, should be able to redeem aUSDT with intrest", async () => {
    const amountToTokenize = amountToWei(tokenUSDT, BigNumber.from(100));
    const initialAUSDTbalance = await aUSDT.balanceOf(wallet.address);

    await pendleRouter.tokenizeYield(
      constants.FORGE_AAVE,
      tokenUSDT.address,
      constants.SIX_MONTH_FROM_NOW,
      amountToTokenize,
      wallet.address
    );
    await pendleXyt.transfer(wallet1.address, amountToTokenize);
    const duration = constants.SIX_MONTH_FROM_NOW.sub(
      Math.round(Date.now() / 1000)
    ).sub(180);

    await advanceTime(provider, duration);

    const wallet1Pendle = pendleRouter.connect(wallet1);

    await wallet1Pendle.redeemDueInterests(
      constants.FORGE_AAVE,
      tokenUSDT.address,
      constants.SIX_MONTH_FROM_NOW
    );

    const wallet1Gain = await aUSDT.balanceOf(wallet1.address);
    let rate = await getLiquidityRate(wallet, tokenUSDT);
    let gain = getGain(amountToTokenize, rate, duration);

    expect(wallet1Gain.toNumber()).to.be.approximately(gain.toNumber(), 20);

    await advanceTime(provider, constants.ONE_MONTH);

    await pendleRouter.redeemAfterExpiry(
      constants.FORGE_AAVE,
      tokenUSDT.address,
      constants.SIX_MONTH_FROM_NOW,
      wallet.address
    );

    rate = await getLiquidityRate(wallet, tokenUSDT);
    gain = getGain(amountToTokenize, rate, constants.ONE_MONTH);
    const finalAUSDTbalance = await aUSDT.balanceOf(wallet.address);
    expect(finalAUSDTbalance.toNumber()).to.be.approximately(
      initialAUSDTbalance.add(gain).toNumber(),
      20000
    );
  });

  it("Should be able to newYieldContracts", async () => {
    let futureTime = constants.SIX_MONTH_FROM_NOW.add(constants.ONE_DAY);
    let filter = pendleAaveForge.filters.NewYieldContracts();
    let tx = await pendleRouter.newYieldContracts(
      constants.FORGE_AAVE,
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
