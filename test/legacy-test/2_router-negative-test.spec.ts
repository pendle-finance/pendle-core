import { expect } from 'chai';
import { BigNumber as BN, utils } from 'ethers';
import { checkDisabled, MarketFixture, marketFixture, Mode, parseTestEnvMarketFixture, TestEnv } from '../fixtures';
import {
  advanceTime,
  amountToWei,
  consts,
  createAaveMarketWithExpiry,
  errMsg,
  evm_revert,
  evm_snapshot,
  setTimeNextBlock,
  Token,
  tokens,
} from '../helpers';
const { waffle } = require('hardhat');

const { loadFixture, provider } = waffle;

export async function runTest(mode: Mode) {
  describe('', async () => {
    const wallets = provider.getWallets();
    const [alice, bob, charlie, dave] = wallets;

    let fixture: MarketFixture;
    let snapshotId: string;
    let globalSnapshotId: string;
    let env: TestEnv = {} as TestEnv;
    let refAmount: BN;
    let USDT: Token;

    async function buildTestEnv() {
      fixture = await loadFixture(marketFixture);
      await parseTestEnvMarketFixture(alice, Mode.AAVE_V2, env, fixture);
      env.TEST_DELTA = BN.from(6000);
      USDT = tokens.USDT;
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

    it("shouldn't be able to create duplicated markets", async () => {
      await expect(
        env.router.createMarket(consts.MARKET_FACTORY_AAVE_V2, env.xyt.address, env.testToken.address, consts.HG)
      ).to.be.revertedWith(errMsg.EXISTED_MARKET);
    });

    it("shouldn't be able to create markets if tokens, factoryId are invalid", async () => {
      await expect(
        env.router.createMarket(consts.MARKET_FACTORY_AAVE_V2, consts.ZERO_ADDRESS, env.testToken.address, consts.HG)
      ).to.be.revertedWith(errMsg.ZERO_ADDRESS);
      await expect(
        env.router.createMarket(consts.MARKET_FACTORY_AAVE_V2, env.xyt.address, consts.ZERO_ADDRESS, consts.HG)
      ).to.be.revertedWith(errMsg.ZERO_ADDRESS);
      await expect(
        env.router.createMarket(consts.MARKET_FACTORY_AAVE_V2, consts.RANDOM_ADDRESS, env.testToken.address, consts.HG)
      ).to.be.revertedWith(errMsg.INVALID_XYT);
      await expect(
        env.router.createMarket(consts.ZERO_BYTES, env.xyt.address, env.testToken.address, consts.HG)
      ).to.be.revertedWith(errMsg.ZERO_ADDRESS);
      await expect(
        env.router.createMarket(consts.MARKET_FACTORY_COMPOUND, env.xyt.address, env.testToken.address, consts.HG)
      ).to.be.revertedWith(errMsg.INVALID_FORGE_FACTORY);
    });

    it('router should reject dual liquidity addition if token amount is invalid or market does not exist', async () => {
      await expect(
        env.router.addMarketLiquidityDual(
          consts.MARKET_FACTORY_AAVE_V2,
          env.xyt.address,
          env.testToken.address,
          BN.from(100),
          BN.from(100),
          consts.INF,
          BN.from(0)
        )
      ).to.be.revertedWith(errMsg.INVALID_YT_AMOUNTS);
      await expect(
        env.router.addMarketLiquidityDual(
          consts.MARKET_FACTORY_AAVE_V2,
          env.xyt.address,
          env.testToken.address,
          BN.from(100),
          BN.from(0),
          BN.from(0),
          BN.from(0)
        )
      ).to.be.revertedWith(errMsg.INVALID_TOKEN_AMOUNTS);
      await expect(
        env.router.addMarketLiquidityDual(
          consts.MARKET_FACTORY_AAVE_V2,
          env.xyt.address,
          consts.RANDOM_ADDRESS,
          BN.from(100),
          consts.INF,
          BN.from(100),
          BN.from(0)
        )
      ).to.be.revertedWith(errMsg.MARKET_NOT_FOUND);
    });

    it('router should reject single sided liquidity addition if in-amount is zero or if market does not exist', async () => {
      await expect(
        env.router.addMarketLiquiditySingle(
          consts.MARKET_FACTORY_AAVE_V2,
          env.xyt.address,
          env.testToken.address,
          true,
          BN.from(0),
          BN.from(0)
        )
      ).to.be.revertedWith(errMsg.ZERO_AMOUNTS);
      await expect(
        env.router.addMarketLiquiditySingle(
          consts.MARKET_FACTORY_AAVE_V2,
          consts.RANDOM_ADDRESS,
          env.testToken.address,
          true,
          BN.from(100),
          BN.from(0)
        )
      ).to.be.revertedWith(errMsg.MARKET_NOT_FOUND);
    });

    it('router should reject dual liquidity removal if in-LP is zero or if market does not exist', async () => {
      await expect(
        env.router.removeMarketLiquidityDual(
          consts.MARKET_FACTORY_AAVE_V2,
          env.xyt.address,
          env.testToken.address,
          BN.from(0),
          BN.from(0),
          BN.from(0)
        )
      ).to.be.revertedWith(errMsg.ZERO_LP_IN);
      await expect(
        env.router.removeMarketLiquidityDual(
          consts.MARKET_FACTORY_COMPOUND,
          env.xyt.address,
          env.testToken.address,
          BN.from(10),
          BN.from(0),
          BN.from(0)
        )
      ).to.be.revertedWith(errMsg.MARKET_NOT_FOUND);
    });

    it('router should reject single sided liquidity removal if in-LP is zero or if market does not exist', async () => {
      await expect(
        env.router.removeMarketLiquiditySingle(
          consts.MARKET_FACTORY_AAVE_V2,
          env.xyt.address,
          env.testToken.address,
          true,
          BN.from(0),
          BN.from(0)
        )
      ).to.be.revertedWith(errMsg.ZERO_LP_IN);
      await expect(
        env.router.removeMarketLiquiditySingle(
          consts.MARKET_FACTORY_AAVE_V2,
          env.xyt.address,
          consts.RANDOM_ADDRESS,
          false,
          BN.from(10),
          BN.from(0)
        )
      ).to.be.revertedWith(errMsg.MARKET_NOT_FOUND);
    });

    it('router should reject bootstrap attempt if in-token amount is zero or if market does not exist', async () => {
      await expect(
        env.router.bootstrapMarket(
          consts.MARKET_FACTORY_AAVE_V2,
          env.xyt.address,
          env.testToken.address,
          BN.from(0),
          BN.from(100)
        )
      ).to.be.revertedWith(errMsg.INVALID_YT_AMOUNT);
      await expect(
        env.router.bootstrapMarket(
          consts.MARKET_FACTORY_AAVE_V2,
          env.xyt.address,
          env.testToken.address,
          BN.from(100),
          BN.from(0)
        )
      ).to.be.revertedWith(errMsg.INVALID_TOKEN_AMOUNT);
      await expect(
        env.router.bootstrapMarket(
          consts.MARKET_FACTORY_AAVE_V2,
          env.xyt.address,
          consts.RANDOM_ADDRESS,
          BN.from(100),
          BN.from(1000)
        )
      ).to.be.revertedWith(errMsg.MARKET_NOT_FOUND);
    });

    it('router should reject swap attempt if amount is zero or market does not exist', async () => {
      await expect(
        env.router.swapExactIn(
          env.xyt.address,
          env.testToken.address,
          BN.from(0),
          BN.from(0),
          consts.MARKET_FACTORY_AAVE_V2
        )
      ).to.be.revertedWith(errMsg.ZERO_IN_AMOUNT);
      await expect(
        env.router.swapExactIn(
          env.xyt.address,
          env.testToken.address,
          BN.from(100),
          BN.from(0),
          consts.MARKET_FACTORY_COMPOUND
        )
      ).to.be.revertedWith(errMsg.MARKET_NOT_FOUND);
      await expect(
        env.router.swapExactOut(
          env.xyt.address,
          env.testToken.address,
          BN.from(0),
          BN.from(100),
          consts.MARKET_FACTORY_AAVE_V2
        )
      ).to.be.revertedWith(errMsg.ZERO_OUT_AMOUNT);
      await expect(
        env.router.swapExactOut(
          consts.RANDOM_ADDRESS,
          env.testToken.address,
          BN.from(100),
          BN.from(100),
          consts.MARKET_FACTORY_AAVE_V2
        )
      ).to.be.revertedWith(errMsg.MARKET_NOT_FOUND);
    });

    it('router should reject redeem LP interests attempt if market is invalid, or user is zero address', async () => {
      await expect(env.router.redeemLpInterests(consts.RANDOM_ADDRESS, alice.address)).to.be.revertedWith(
        errMsg.INVALID_MARKET
      );
      await expect(env.router.redeemLpInterests(env.market.address, consts.ZERO_ADDRESS)).to.be.revertedWith(
        errMsg.ZERO_ADDRESS
      );
    });

    ///
    it('should reject ETH payments from non-WETH address', async () => {
      await expect(alice.sendTransaction({ to: env.router.address, value: 1 })).to.be.revertedWith(
        errMsg.ETH_NOT_FROM_WETH
      );
    });

    it('should perform sanity checks when deploying new yield contracts', async () => {
      await expect(
        env.router.newYieldContracts(consts.FORGE_COMPOUND, consts.ZERO_ADDRESS, consts.T0_C.add(consts.SIX_MONTH))
      ).to.be.revertedWith(errMsg.ZERO_ADDRESS);
      await expect(
        env.router.newYieldContracts(consts.RANDOM_BYTES, USDT.address, consts.T0_C.add(consts.SIX_MONTH))
      ).to.be.revertedWith(errMsg.FORGE_NOT_EXISTS);
      await expect(
        env.router.newYieldContracts(consts.FORGE_COMPOUND, USDT.address, consts.T0_C.add(consts.SIX_MONTH))
      ).to.be.revertedWith(errMsg.DUPLICATE_YIELD_CONTRACT);
    });

    it('should reject invalid OT or transactions before expiry when redeeming after expiry', async () => {
      await expect(
        env.router.redeemAfterExpiry(consts.FORGE_COMPOUND, consts.RANDOM_ADDRESS, consts.T0_C.add(consts.SIX_MONTH))
      ).to.be.revertedWith(errMsg.INVALID_XYT);
      await setTimeNextBlock(consts.T0_C.add(consts.THREE_MONTH));
      await expect(
        env.router.redeemAfterExpiry(consts.FORGE_COMPOUND, USDT.address, consts.T0_C.add(consts.SIX_MONTH))
      ).to.be.revertedWith(errMsg.MUST_BE_AFTER_EXPIRY);
    });

    it('should reject invalid YT or zero address as user when redeeming due interests', async () => {
      await expect(
        env.router.redeemDueInterests(
          consts.RANDOM_BYTES,
          USDT.address,
          consts.T0_C.add(consts.SIX_MONTH),
          alice.address
        )
      ).to.be.revertedWith(errMsg.INVALID_XYT);
      await expect(
        env.router.redeemDueInterests(
          consts.FORGE_COMPOUND,
          USDT.address,
          consts.T0_C.add(consts.SIX_MONTH),
          consts.ZERO_ADDRESS
        )
      ).to.be.revertedWith(errMsg.ZERO_ADDRESS);
    });

    it('should reject invalid or expired YT or zero redeem amount ', async () => {
      await expect(
        env.router.redeemUnderlying(
          consts.FORGE_COMPOUND,
          consts.RANDOM_ADDRESS,
          consts.T0_C.add(consts.SIX_MONTH),
          BN.from(100)
        )
      ).to.be.revertedWith(errMsg.INVALID_XYT);
      await expect(
        env.router.redeemUnderlying(consts.FORGE_COMPOUND, USDT.address, consts.T0_C.add(consts.SIX_MONTH), BN.from(0))
      ).to.be.revertedWith(errMsg.ZERO_AMOUNT);
      await setTimeNextBlock(consts.T0_C.add(consts.ONE_YEAR));
      await expect(
        env.router.redeemUnderlying(
          consts.FORGE_COMPOUND,
          USDT.address,
          consts.T0_C.add(consts.SIX_MONTH),
          BN.from(100)
        )
      ).to.be.revertedWith(errMsg.YIELD_CONTRACT_EXPIRED);
    });

    it('should reject non-positive renewal rate', async () => {
      await expect(
        env.router.renewYield(
          consts.FORGE_COMPOUND,
          consts.T0_C.add(consts.SIX_MONTH),
          USDT.address,
          consts.T0_C.add(consts.ONE_YEAR),
          BN.from(0)
        )
      ).to.be.revertedWith(errMsg.INVALID_RENEWAL_RATE);
    });

    it('should perform sanity checks when tokenizing yield', async () => {
      await expect(
        env.router.tokenizeYield(
          consts.FORGE_COMPOUND,
          USDT.address,
          consts.T0_C.add(consts.ONE_MONTH),
          BN.from(100),
          alice.address
        )
      ).to.be.revertedWith(errMsg.INVALID_XYT);
      await expect(
        env.router.tokenizeYield(
          consts.FORGE_COMPOUND,
          USDT.address,
          consts.T0_C.add(consts.SIX_MONTH),
          BN.from(100),
          consts.ZERO_ADDRESS
        )
      ).to.be.revertedWith(errMsg.ZERO_ADDRESS);
      await expect(
        env.router.tokenizeYield(
          consts.FORGE_COMPOUND,
          USDT.address,
          consts.T0_C.add(consts.SIX_MONTH),
          BN.from(0),
          alice.address
        )
      ).to.be.revertedWith(errMsg.ZERO_AMOUNT);
      await setTimeNextBlock(consts.T0_C.add(consts.ONE_YEAR));
      await expect(
        env.router.tokenizeYield(
          consts.FORGE_COMPOUND,
          USDT.address,
          consts.T0_C.add(consts.SIX_MONTH),
          BN.from(100),
          alice.address
        )
      ).to.be.revertedWith(errMsg.YIELD_CONTRACT_EXPIRED);
    });
  });
}

describe('router-negative-test ', function () {
  if (checkDisabled(Mode.GENERAL_TEST)) return;
  runTest(Mode.GENERAL_TEST);
});
