import { expect } from 'chai';
import { BigNumber as BN, Contract, utils, Wallet } from 'ethers';
import { waffle } from 'hardhat';
import {
  advanceTime,
  amountToWei,
  consts,
  errMsg,
  evm_revert,
  evm_snapshot,
  getA2Contract,
  setTimeNextBlock,
  Token,
  tokens,
} from '../helpers';
import { routerFixture, RouterFixture } from './fixtures';

const { loadFixture, provider } = waffle;

describe('router-negative-test', async () => {
  const wallets = provider.getWallets();
  const [alice, bob, charlie, dave] = wallets;

  let fixture: RouterFixture;
  let router: Contract;
  let ot: Contract;
  let xyt: Contract;
  let aaveForge: Contract;
  let aUSDT: Contract;
  let snapshotId: string;
  let globalSnapshotId: string;
  let tokenUSDT: Token;
  let refAmount: BN;
  let data: Contract;

  before(async () => {
    fixture = await loadFixture(routerFixture);
    globalSnapshotId = await evm_snapshot();
    router = fixture.core.router;
    tokenUSDT = tokens.USDT;
    data = fixture.core.data;
    ot = fixture.a2Forge.a2OwnershipToken;
    xyt = fixture.a2Forge.a2FutureYieldToken;
    aaveForge = fixture.a2Forge.aaveV2Forge;
    aUSDT = await getA2Contract(alice, aaveForge, tokenUSDT);
    snapshotId = await evm_snapshot();
  });

  after(async () => {
    await evm_revert(globalSnapshotId);
  });

  beforeEach(async () => {
    await evm_revert(snapshotId);
    snapshotId = await evm_snapshot();
    refAmount = amountToWei(consts.INITIAL_AAVE_TOKEN_AMOUNT, 6);
  });

  async function tokenizeYield(user: Wallet, amount: BN): Promise<BN> {
    let amountTokenMinted = await ot.balanceOf(user.address);
    await router.tokenizeYield(
      consts.FORGE_AAVE_V2,
      tokenUSDT.address,
      consts.T0_A2.add(consts.SIX_MONTH),
      amount,
      user.address,
      consts.HG
    );
    amountTokenMinted = (await ot.balanceOf(user.address)).sub(amountTokenMinted);
    return amountTokenMinted;
  }

  async function redeemDueInterests(user: Wallet, expiry: BN) {
    await router.connect(user).redeemDueInterests(consts.FORGE_AAVE_V2, tokenUSDT.address, expiry);
  }

  it("shouldn't be able to newYieldContracts with an expiry in the past", async () => {
    let futureTime = consts.T0_A2.sub(consts.ONE_MONTH);
    await expect(router.newYieldContracts(consts.FORGE_AAVE_V2, tokenUSDT.address, futureTime)).to.be.revertedWith(
      errMsg.INVALID_EXPIRY
    );
  });

  it("shouldn't be able to newYieldContracts with an expiry not divisible for expiryDivisor", async () => {
    let futureTime = consts.T0_A2.add(consts.ONE_YEAR);
    if (futureTime.mod(await data.expiryDivisor()).eq(0)) {
      futureTime = futureTime.add(1);
    }
    await expect(router.newYieldContracts(consts.FORGE_AAVE_V2, tokenUSDT.address, futureTime)).to.be.revertedWith(
      errMsg.INVALID_EXPIRY
    );
  });

  it("shouldn't be able to redeemUnderlying if the yield contract has expired", async () => {
    let amount = await tokenizeYield(alice, refAmount);

    await setTimeNextBlock(consts.T0_A2.add(consts.ONE_YEAR));

    await expect(
      router.redeemUnderlying(
        consts.FORGE_AAVE_V2,
        tokenUSDT.address,
        consts.T0_A2.add(consts.SIX_MONTH),
        refAmount,
        consts.HG
      )
    ).to.be.revertedWith(errMsg.YIELD_CONTRACT_EXPIRED);
  });

  it("shouldn't be able to addForge if the forge is invalid", async () => {
    await expect(data.addForge(consts.FORGE_AAVE_V2, consts.RANDOM_ADDRESS)).to.be.reverted;
  });

  it("shouldn't be able to newYieldContracts with an invalid forgeId", async () => {
    await expect(
      router.newYieldContracts(
        utils.formatBytes32String('INVALID'),
        consts.RANDOM_ADDRESS,
        consts.T0_A2.add(consts.ONE_YEAR)
      )
    ).to.be.revertedWith(errMsg.FORGE_NOT_EXISTS);
  });

  it("shouldn't be able to create duplicated yield contracts", async () => {
    await expect(
      router.newYieldContracts(consts.FORGE_AAVE_V2, tokenUSDT.address, consts.T0_A2.add(consts.SIX_MONTH))
    ).to.be.revertedWith(errMsg.DUPLICATE_YIELD_CONTRACT);
  });

  it("shouldn't be able to redeemUnderlying with zero amount", async () => {
    await expect(
      router.redeemUnderlying(consts.FORGE_AAVE_V2, tokenUSDT.address, consts.T0_A2.add(consts.SIX_MONTH), BN.from(0))
    ).to.be.revertedWith(errMsg.ZERO_AMOUNT);
  });

  // it("shouldn't be able to renewYield to invalid expiry", async () => {
  //   await advanceTime(consts.SIX_MONTH);
  //   await expect(
  //     router.renewYield(
  //       consts.FORGE_AAVE_V2,
  //       consts.T0_A2.add(consts.SIX_MONTH),
  //       tokenUSDT.address,
  //       consts.T0_A2.add(consts.ONE_YEAR.add(100)),
  //       consts.RONE
  //     )
  //   ).to.be.revertedWith(errMsg.INVALID_XYT);
  // });

  it("shouldn't be able to renewYield if the current yield has not expired yet", async () => {
    let futureTime = consts.T0_A2.add(consts.ONE_YEAR.add(500));
    await router.newYieldContracts(consts.FORGE_AAVE_V2, tokenUSDT.address, futureTime);
    await advanceTime(consts.FIVE_MONTH);
    await expect(
      router.renewYield(
        consts.FORGE_AAVE_V2,
        consts.T0_A2.add(consts.SIX_MONTH),
        tokenUSDT.address,
        futureTime,
        consts.RONE
      )
    ).to.be.revertedWith(errMsg.MUST_BE_AFTER_EXPIRY);
  });

  it("shouldn't be able to renewYield to with a zero renewal rate", async () => {
    let futureTime = consts.T0_A2.add(consts.ONE_YEAR.add(500));
    await router.newYieldContracts(consts.FORGE_AAVE_V2, tokenUSDT.address, futureTime);
    await advanceTime(consts.SIX_MONTH);
    await expect(
      router.renewYield(
        consts.FORGE_AAVE_V2,
        consts.T0_A2.add(consts.SIX_MONTH),
        tokenUSDT.address,
        futureTime,
        BN.from(0)
      )
    ).to.be.revertedWith(errMsg.INVALID_RENEWAL_RATE);
  });

  it("shouldn't be able to tokenizeYield to an expired contract", async () => {
    await advanceTime(consts.SIX_MONTH);
    await expect(
      router.tokenizeYield(
        consts.FORGE_AAVE_V2,
        tokenUSDT.address,
        consts.T0_A2.add(consts.SIX_MONTH),
        BN.from(1000000),
        alice.address,
        consts.HG
      )
    ).to.be.revertedWith(errMsg.YIELD_CONTRACT_EXPIRED);
  });

  it("shouldn't be able to add invalid market factories", async () => {
    await expect(
      data.addMarketFactory(consts.MARKET_FACTORY_COMPOUND, fixture.core.a2MarketFactory.address)
    ).to.be.revertedWith(errMsg.INVALID_FACTORY_ID);
  });
});
