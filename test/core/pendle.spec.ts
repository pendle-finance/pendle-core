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
} from "../helpers";
import { toUtf8CodePoints } from "ethers/lib/utils";

const { waffle } = require("hardhat");
const provider = waffle.provider;

describe("Pendle", async () => {
  const wallets = provider.getWallets();
  const loadFixture = createFixtureLoader(wallets, provider);
  const [wallet] = wallets;

  let pendle: Contract;
  let pendleTreasury: Contract;
  let pendleAaveMarketFactory: Contract;
  let pendleData: Contract;
  let pendleOwnershipToken: Contract;
  let pendleFutureYieldToken: Contract;
  let lendingPoolCore: Contract;
  let pendleAaveForge: Contract;
  let snapshotId: string;
  let globalSnapshotId: string;

  before(async () => {
    globalSnapshotId = await evm_snapshot();

    const fixture = await loadFixture(pendleFixture);
    pendle = fixture.core.pendle;
    pendleTreasury = fixture.core.pendleTreasury;
    pendleAaveMarketFactory = fixture.core.pendleAaveMarketFactory;
    pendleData = fixture.core.pendleData;
    pendleOwnershipToken = fixture.forge.pendleOwnershipToken;
    pendleFutureYieldToken = fixture.forge.pendleFutureYieldToken;
    pendleAaveForge = fixture.forge.pendleAaveForge;
    lendingPoolCore = fixture.aave.lendingPoolCore;
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
    const token = tokens.USDT;
    const amountToTokenize = amountToWei(token, BigNumber.from(100));
    await pendle.tokenizeYield(
      constants.FORGE_AAVE,
      token.address,
      constants.SIX_MONTH_FROM_NOW,
      amountToTokenize,
      wallet.address
    );
    const balanceOwnershipToken = await pendleOwnershipToken.balanceOf(
      wallet.address
    );
    const balanceFutureYieldToken = await pendleFutureYieldToken.balanceOf(
      wallet.address
    );
    expect(balanceOwnershipToken).to.be.eq(amountToTokenize);
    expect(balanceFutureYieldToken).to.be.eq(amountToTokenize);
  });

  it("[After 1 month] should be able to redeem aUSDT to get back OT, XYT and interests $", async () => {
    const token = tokens.USDT;
    const aUSDT = await getAContract(wallet, lendingPoolCore, token);

    const initialAUSDTbalance = await aUSDT.balanceOf(wallet.address);
    const amountToTokenize = amountToWei(token, BigNumber.from(100));
    await pendle.tokenizeYield(
      constants.FORGE_AAVE,
      token.address,
      constants.SIX_MONTH_FROM_NOW,
      amountToTokenize,
      wallet.address,
      constants.HIGH_GAS_OVERRIDE
    );
    await advanceTime(provider, constants.ONE_MONTH);

    await pendle.redeemUnderlying(
      constants.FORGE_AAVE,
      token.address,
      constants.SIX_MONTH_FROM_NOW,
      amountToTokenize,
      wallet.address,
      constants.HIGH_GAS_OVERRIDE
    );

    const finalAUSDTbalance = await aUSDT.balanceOf(wallet.address);
    const rate = await getLiquidityRate(wallet, token);
    const gain = getGain(amountToTokenize, rate, constants.ONE_MONTH);
    expect(finalAUSDTbalance.toNumber()).to.be.approximately(
      initialAUSDTbalance.add(gain).toNumber(),
      20
    );
  });

  it("[After 1 month] should be able to get due interests", async () => {
    const token = tokens.USDT;
    const aUSDT = await getAContract(wallet, lendingPoolCore, token);
    const amountToTokenize = amountToWei(token, BigNumber.from(100));
    const wallet1 = wallets[1];
    const initialAUSDTbalance = await aUSDT.balanceOf(wallet.address);

    await pendle.tokenizeYield(
      constants.FORGE_AAVE,
      token.address,
      constants.SIX_MONTH_FROM_NOW,
      amountToTokenize,
      wallet.address
    );

    const balance = await pendleOwnershipToken.balanceOf(wallet.address);
    await pendleOwnershipToken.transfer(wallet1.address, balance);

    const afterLendingAUSDTbalance = await aUSDT.balanceOf(wallet.address);
    await advanceTime(provider, constants.ONE_MONTH);

    await pendle.redeemDueInterests(
      constants.FORGE_AAVE,
      token.address,
      constants.SIX_MONTH_FROM_NOW
    );

    const rate = await getLiquidityRate(wallet, token);
    const gain = getGain(amountToTokenize, rate, constants.ONE_MONTH);

    const finalAUSDTbalance = await aUSDT.balanceOf(wallet.address);

    expect(finalAUSDTbalance).to.be.below(initialAUSDTbalance);
    expect(finalAUSDTbalance.toNumber()).to.be.approximately(
      afterLendingAUSDTbalance.add(gain).toNumber(),
      10
    );
  });

  it("Short after expiry, should be able to redeem aUSDT from OT", async () => {
    const token = tokens.USDT;
    const aUSDT = await getAContract(wallet, lendingPoolCore, token);

    const amountToTokenize = amountToWei(token, BigNumber.from(100));
    const wallet1 = wallets[1];
    const initialAUSDTbalance = await aUSDT.balanceOf(wallet.address);

    await pendle.tokenizeYield(
      constants.FORGE_AAVE,
      token.address,
      constants.SIX_MONTH_FROM_NOW,
      amountToTokenize,
      wallet.address
    );
    await pendleFutureYieldToken.transfer(wallet1.address, amountToTokenize);
    const duration = constants.SIX_MONTH_FROM_NOW.sub(
      Math.round(Date.now() / 1000)
    ).sub(180);

    await advanceTime(provider, duration);

    const wallet1Pendle = pendle.connect(wallet1);

    await wallet1Pendle.redeemDueInterests(
      constants.FORGE_AAVE,
      token.address,
      constants.SIX_MONTH_FROM_NOW
    );

    const wallet1Gain = await aUSDT.balanceOf(wallet1.address);
    const rate = await getLiquidityRate(wallet, token);
    const gain = getGain(amountToTokenize, rate, duration);

    expect(wallet1Gain.toNumber()).to.be.approximately(gain.toNumber(), 20);

    await advanceTime(provider, BigNumber.from(180));

    await pendle.redeemAfterExpiry(
      constants.FORGE_AAVE,
      token.address,
      constants.SIX_MONTH_FROM_NOW,
      wallet.address
    );
    const finalAUSDTbalance = await aUSDT.balanceOf(wallet.address);
    expect(finalAUSDTbalance.toNumber()).to.be.approximately(
      initialAUSDTbalance.toNumber(),
      50
    );
  });

  it("One month after expiry, should be able to redeem aUSDT with intrest", async () => {
    const token = tokens.USDT;
    const aUSDT = await getAContract(wallet, lendingPoolCore, token);

    const amountToTokenize = amountToWei(token, BigNumber.from(100));
    const wallet1 = wallets[1];
    const initialAUSDTbalance = await aUSDT.balanceOf(wallet.address);

    await pendle.tokenizeYield(
      constants.FORGE_AAVE,
      token.address,
      constants.SIX_MONTH_FROM_NOW,
      amountToTokenize,
      wallet.address
    );
    await pendleFutureYieldToken.transfer(wallet1.address, amountToTokenize);
    const duration = constants.SIX_MONTH_FROM_NOW.sub(
      Math.round(Date.now() / 1000)
    ).sub(180);

    await advanceTime(provider, duration);

    const wallet1Pendle = pendle.connect(wallet1);

    await wallet1Pendle.redeemDueInterests(
      constants.FORGE_AAVE,
      token.address,
      constants.SIX_MONTH_FROM_NOW
    );

    await advanceTime(provider, constants.ONE_MONTH);

    await pendle.redeemAfterExpiry(
      constants.FORGE_AAVE,
      token.address,
      constants.SIX_MONTH_FROM_NOW,
      wallet.address
    );

    const rate = await getLiquidityRate(wallet, token);
    const gain = getGain(amountToTokenize, rate, constants.ONE_MONTH);

    const finalAUSDTbalance = await aUSDT.balanceOf(wallet.address);
    expect(finalAUSDTbalance.toNumber()).to.be.approximately(
      initialAUSDTbalance.add(gain).toNumber(),
      40000
    );
  });

  it("Should be able to remove a forge", async () => {
    await pendle.removeForge(constants.FORGE_AAVE);
    let deleted = await pendleData.getForgeAddress(constants.FORGE_AAVE);
    expect(deleted).to.be.equal("0x0000000000000000000000000000000000000000");
  });

  it("Should be able to create a new yield contract", async () => {
    const token = tokens.USDT;
    let { otAddress, xytAddress } = await pendle
      .newYieldContracts(constants.FORGE_AAVE, token.address, constants.SIX_MONTH_FROM_NOW);

    expect(otAddress).to.not.eq(0);
    expect(xytAddress).to.not.eq(0);
    // TODO: check for event emit @Long
    // await evm_revert(snapshotId);

    // await expect(pendle
    //   .newYieldContracts(constants.FORGE_AAVE, token.address, constants.SIX_MONTH_FROM_NOW))
    //   .to.emit(pendleAaveForge, 'NewYieldContracts').withArgs(otAddress, xytAddress, constants.SIX_MONTH_FROM_NOW);
  });

  // it("Should be able to get market reserve", async () => {

  //   let [otAddress, xytAddress] = await pendle
  //     .newYieldContracts(constants.FORGE_AAVE, tokens.address, constants.SIX_MONTH_FROM_NOW);

  //   expect(otAddress).to.not.eq(0);
  //   expect(xytAddress).to.not.eq(0);

  //   await expect(pendle
  //     .newYieldContracts(constants.FORGE_AAVE, tokens.address, constants.SIX_MONTH_FROM_NOW))
  //     .to.emit(pendleAaveForge, 'NewYieldContracts').withArgs(otAddress, xytAddress, constants.SIX_MONTH_FROM_NOW);
  // });
});
