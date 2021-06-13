import { expect } from 'chai';
import { BigNumber as BN, Contract, utils, Wallet } from 'ethers';
import { waffle } from 'hardhat';
import {
  advanceTime,
  amountToWei,
  consts,
  createAaveMarketWithExpiry,
  errMsg,
  evm_revert,
  evm_snapshot,
  getA2Contract,
  setTimeNextBlock,
  Token,
  tokens,
} from '../helpers';
import {
  Mode,
  parseTestEnvRouterFixture,
  TestEnv,
  MarketFixture,
  marketFixture,
  parseTestEnvMarketFixture,
} from './fixtures';

const { loadFixture, provider } = waffle;

describe('router-negative-test', async () => {
  const wallets = provider.getWallets();
  const [alice, bob, charlie, dave] = wallets;

  let fixture: MarketFixture;
  let snapshotId: string;
  let globalSnapshotId: string;
  let env: TestEnv = {} as TestEnv;
  let refAmount: BN;

  async function buildTestEnv() {
    fixture = await loadFixture(marketFixture);
    await parseTestEnvMarketFixture(alice, Mode.AAVE_V2, env, fixture);
    env.TEST_DELTA = BN.from(6000);
  }

  before(async () => {
    await buildTestEnv();
    globalSnapshotId = await evm_snapshot();
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

  it("shouldn't be able to newYieldContracts with an expiry in the past", async () => {
    let futureTime = env.T0.sub(consts.ONE_MONTH);
    await expect(
      env.router.newYieldContracts(consts.FORGE_AAVE_V2, env.underlyingAsset.address, futureTime)
    ).to.be.revertedWith(errMsg.INVALID_EXPIRY);
  });

  it("shouldn't be able to newYieldContracts with an expiry not divisible for expiryDivisor", async () => {
    let futureTime = env.T0.add(consts.ONE_YEAR);
    if (futureTime.mod(await env.data.expiryDivisor()).eq(0)) {
      futureTime = futureTime.add(1);
    }
    await expect(
      env.router.newYieldContracts(consts.FORGE_AAVE_V2, env.underlyingAsset.address, futureTime)
    ).to.be.revertedWith(errMsg.INVALID_EXPIRY);
  });

  it("shouldn't be able to redeemUnderlying if the yield contract has expired", async () => {
    await setTimeNextBlock(env.T0.add(consts.ONE_YEAR));

    await expect(
      env.router.redeemUnderlying(
        consts.FORGE_AAVE_V2,
        env.underlyingAsset.address,
        env.T0.add(consts.SIX_MONTH),
        refAmount,
        consts.HG
      )
    ).to.be.revertedWith(errMsg.YIELD_CONTRACT_EXPIRED);
  });

  it("shouldn't be able to addForge if the forge is invalid", async () => {
    await expect(env.data.addForge(consts.FORGE_AAVE_V2, consts.RANDOM_ADDRESS)).to.be.reverted;
  });

  it("shouldn't be able to newYieldContracts with an invalid forgeId", async () => {
    await expect(
      env.router.newYieldContracts(
        utils.formatBytes32String('INVALID'),
        consts.RANDOM_ADDRESS,
        env.T0.add(consts.ONE_YEAR)
      )
    ).to.be.revertedWith(errMsg.FORGE_NOT_EXISTS);
  });

  it("shouldn't be able to create duplicated yield contracts", async () => {
    await expect(
      env.router.newYieldContracts(consts.FORGE_AAVE_V2, env.underlyingAsset.address, env.T0.add(consts.SIX_MONTH))
    ).to.be.revertedWith(errMsg.DUPLICATE_YIELD_CONTRACT);
  });

  it("shouldn't be able to redeemUnderlying with zero amount", async () => {
    await expect(
      env.router.redeemUnderlying(
        consts.FORGE_AAVE_V2,
        env.underlyingAsset.address,
        env.T0.add(consts.SIX_MONTH),
        BN.from(0)
      )
    ).to.be.revertedWith(errMsg.ZERO_AMOUNT);
  });

  // it("shouldn't be able to renewYield to invalid expiry", async () => {
  //   await advanceTime(consts.SIX_MONTH);
  //   await expect(
  //     env.router.renewYield(
  //       consts.FORGE_AAVE_V2,
  //       env.T0.add(consts.SIX_MONTH),
  //       env.underlyingAsset.address,
  //       env.T0.add(consts.ONE_YEAR.add(100)),
  //       consts.RONE
  //     )
  //   ).to.be.revertedWith(errMsg.INVALID_XYT);
  // });

  it("shouldn't be able to renewYield if the current yield has not expired yet", async () => {
    let futureTime = env.T0.add(consts.ONE_YEAR.add(500));
    await env.router.newYieldContracts(consts.FORGE_AAVE_V2, env.underlyingAsset.address, futureTime);
    await advanceTime(consts.FIVE_MONTH);
    await expect(
      env.router.renewYield(
        consts.FORGE_AAVE_V2,
        env.T0.add(consts.SIX_MONTH),
        env.underlyingAsset.address,
        futureTime,
        consts.RONE
      )
    ).to.be.revertedWith(errMsg.MUST_BE_AFTER_EXPIRY);
  });

  it("shouldn't be able to renewYield to with a zero renewal rate", async () => {
    let futureTime = env.T0.add(consts.ONE_YEAR.add(500));
    await env.router.newYieldContracts(consts.FORGE_AAVE_V2, env.underlyingAsset.address, futureTime);
    await advanceTime(consts.SIX_MONTH);
    await expect(
      env.router.renewYield(
        consts.FORGE_AAVE_V2,
        env.T0.add(consts.SIX_MONTH),
        env.underlyingAsset.address,
        futureTime,
        BN.from(0)
      )
    ).to.be.revertedWith(errMsg.INVALID_RENEWAL_RATE);
  });

  it("shouldn't be able to tokenizeYield to an expired contract", async () => {
    await advanceTime(consts.SIX_MONTH);
    await expect(
      env.router.tokenizeYield(
        consts.FORGE_AAVE_V2,
        env.underlyingAsset.address,
        env.T0.add(consts.SIX_MONTH),
        BN.from(1000000),
        alice.address,
        consts.HG
      )
    ).to.be.revertedWith(errMsg.YIELD_CONTRACT_EXPIRED);
  });

  it("shouldn't be able to add invalid market factories", async () => {
    await expect(
      env.data.addMarketFactory(consts.MARKET_FACTORY_COMPOUND, fixture.core.a2MarketFactory.address)
    ).to.be.revertedWith(errMsg.INVALID_FACTORY_ID);
  });

  it("shouldn't be able to add duplicate markets", async () => {
    await expect(createAaveMarketWithExpiry(env, env.EXPIRY, wallets)).to.be.revertedWith(
      errMsg.DUPLICATE_YIELD_CONTRACT
    );
    await expect(
      env.router.createMarket(env.MARKET_FACTORY_ID, env.xyt.address, env.testToken.address, consts.HG)
    ).to.be.revertedWith(errMsg.EXISTED_MARKET);

    let newMarketEnv: TestEnv = await createAaveMarketWithExpiry(env, env.EXPIRY.add(consts.THREE_MONTH), wallets);
    await expect(
      env.router.createMarket(
        newMarketEnv.MARKET_FACTORY_ID,
        newMarketEnv.xyt.address,
        newMarketEnv.testToken.address,
        consts.HG
      )
    ).to.be.revertedWith(errMsg.EXISTED_MARKET);
  });

  it("shouldn't be able to create aave markets with wrong factory", async () => {
    await expect(
      env.router.createMarket(consts.MARKET_FACTORY_COMPOUND, env.xyt.address, env.testToken.address, consts.HG)
    ).to.be.revertedWith(errMsg.INVALID_FORGE_FACTORY);
  });
});
