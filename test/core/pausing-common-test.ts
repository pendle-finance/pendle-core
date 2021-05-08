import { expect } from "chai";
import { createFixtureLoader } from "ethereum-waffle";
import { BigNumber as BN, Contract, Wallet } from "ethers";
import {
  consts,
  errMsg,
  evm_revert,
  evm_snapshot,
  getA2Contract,
  getAContract,
  setTimeNextBlock,
  Token,
  tokens,
} from "../helpers";
import { marketFixture, MarketFixture } from "./fixtures";

const { waffle } = require("hardhat");
const provider = waffle.provider;

interface TestEnv {
  T0: BN;
  FORGE_ID: string;
  INITIAL_AAVE_TOKEN_AMOUNT: BN;
  TEST_DELTA: BN;
  EXPIRY: BN;
}

export function runTest(isAaveV1: boolean) {
  describe("", async () => {
    const wallets = provider.getWallets();
    const loadFixture = createFixtureLoader(wallets, provider);
    const [alice, bob, charlie, dave] = wallets;

    let fixture: MarketFixture;
    let router: Contract;
    let ot: Contract;
    let xyt: Contract;
    let aaveForge: Contract;
    let aUSDT: Contract;
    let snapshotId: string;
    let globalSnapshotId: string;
    let tokenUSDT: Token;
    let refAmount: BN;
    let initialAUSDTbalance: BN;
    let testEnv: TestEnv = {} as TestEnv;
    let data: Contract;
    let market: Contract;
    let pausingManager: Contract;
    let baseToken: Contract;
    let forgeArgs: any[];
    let marketArgs: any[];
    let yieldTokenHolder: string;

    async function buildCommonTestEnv() {
      fixture = await loadFixture(marketFixture);
      router = fixture.core.router;
      tokenUSDT = tokens.USDT;
      data = fixture.core.data;
      pausingManager = fixture.core.pausingManager;
      baseToken = fixture.testToken;
    }

    async function buildTestEnvV1() {
      ot = fixture.aForge.aOwnershipToken;
      xyt = fixture.aForge.aFutureYieldToken;
      aaveForge = fixture.aForge.aaveForge;
      aUSDT = await getAContract(alice, aaveForge, tokenUSDT);
      testEnv.FORGE_ID = consts.FORGE_AAVE;
      testEnv.T0 = consts.T0;
      testEnv.EXPIRY = consts.T0.add(consts.SIX_MONTH);
      market = fixture.aMarket;
    }

    async function buildTestEnvV2() {
      ot = fixture.a2Forge.a2OwnershipToken;
      xyt = fixture.a2Forge.a2FutureYieldToken;
      aaveForge = fixture.a2Forge.aaveV2Forge;
      aUSDT = await getA2Contract(alice, aaveForge, tokenUSDT);
      testEnv.FORGE_ID = consts.FORGE_AAVE_V2;
      testEnv.T0 = consts.T0_A2;
      testEnv.EXPIRY = consts.T0_A2.add(consts.SIX_MONTH);
      market = fixture.a2Market;
    }

    async function checkYieldContractPaused() {
      await expect(
        router.tokenizeYield(
          ...forgeArgs,
          1,
          alice.address,
          consts.HIGH_GAS_OVERRIDE
        )
      ).to.be.revertedWith(errMsg.YIELD_CONTRACT_PAUSED);
      await expect(
        router.redeemUnderlying(...forgeArgs, 1, consts.HIGH_GAS_OVERRIDE)
      ).to.be.revertedWith(errMsg.YIELD_CONTRACT_PAUSED);
      await expect(
        xyt.transfer(charlie.address, 1, consts.HIGH_GAS_OVERRIDE)
      ).to.be.revertedWith(errMsg.YIELD_CONTRACT_PAUSED);
      await expect(
        ot.transfer(charlie.address, 1, consts.HIGH_GAS_OVERRIDE)
      ).to.be.revertedWith(errMsg.YIELD_CONTRACT_PAUSED);
      //TODO: test all other forge functions
    }

    async function checkYieldContractUnpaused() {
      await router.tokenizeYield(
        ...forgeArgs,
        1,
        alice.address,
        consts.HIGH_GAS_OVERRIDE
      );
      await router.redeemUnderlying(...forgeArgs, 1, consts.HIGH_GAS_OVERRIDE);
      await xyt.transfer(charlie.address, 1, consts.HIGH_GAS_OVERRIDE);
      await ot.transfer(charlie.address, 1, consts.HIGH_GAS_OVERRIDE);
      //TODO: test all other forge functions
      //TODO: refactor checkYieldContractPaused and checkYieldContractUnpaused
    }

    async function checkMarketPaused() {
      await expect(
        router.addMarketLiquidityDual(
          ...marketArgs,
          1000,
          1000,
          0,
          0,
          consts.HIGH_GAS_OVERRIDE
        )
      ).to.be.revertedWith(errMsg.MARKET_PAUSED);
      await expect(
        router.removeMarketLiquidityDual(
          ...marketArgs,
          1000,
          0,
          0,
          consts.HIGH_GAS_OVERRIDE
        )
      ).to.be.revertedWith(errMsg.MARKET_PAUSED);
      await expect(
        router.swapExactIn(
          xyt.address,
          baseToken.address,
          1000,
          0,
          consts.MARKET_FACTORY_AAVE,
          consts.HIGH_GAS_OVERRIDE
        )
      ).to.be.revertedWith(errMsg.MARKET_PAUSED);
      //TODO: test all other market functions
    }

    async function checkMarketUnpaused() {
      await router.addMarketLiquidityDual(
        ...marketArgs,
        1000,
        1000,
        0,
        0,
        consts.HIGH_GAS_OVERRIDE
      );
      await router.removeMarketLiquidityDual(
        ...marketArgs,
        1000,
        0,
        0,
        consts.HIGH_GAS_OVERRIDE
      );
      await router.swapExactIn(
        xyt.address,
        baseToken.address,
        1000,
        0,
        consts.MARKET_FACTORY_AAVE,
        consts.HIGH_GAS_OVERRIDE
      );
      //TODO: test all other market functions
    }

    async function checkYieldContractLocked() {
      await checkYieldContractPaused();
      const [paused, locked] = await pausingManager.checkYieldContractStatus(
        ...forgeArgs
      );
      expect(paused).to.be.eq(true);
      expect(locked).to.be.eq(true);
      await aaveForge.setUpEmergencyMode(
        tokenUSDT.address,
        testEnv.EXPIRY,
        [aUSDT.address],
        charlie.address
      );
      const yieldTokenHolderBalanceBefore = await aUSDT.balanceOf(
        yieldTokenHolder
      );
      console.log(
        `\t\tyieldTokenHolderBalanceBefore = ${yieldTokenHolderBalanceBefore}`
      );
      await aUSDT
        .connect(charlie)
        .transferFrom(
          yieldTokenHolder,
          charlie.address,
          yieldTokenHolderBalanceBefore
        );
      const yieldTokenHolderBalanceAfter = await aUSDT.balanceOf(
        yieldTokenHolder
      );
      expect(yieldTokenHolderBalanceAfter).to.be.lt(BN.from(100));
      console.log(
        `\t\tyieldTokenHolderBalanceAfter = ${yieldTokenHolderBalanceAfter}`
      );
    }

    async function checkMarketLocked() {
      await checkMarketPaused();
      const [paused, locked] = await pausingManager.checkMarketStatus(
        consts.MARKET_FACTORY_AAVE,
        market.address
      );
      expect(paused).to.be.eq(true);
      expect(locked).to.be.eq(true);
      await market.setUpEmergencyMode(
        [xyt.address, baseToken.address],
        charlie.address
      );

      const marketXytBalanceBefore = await xyt.balanceOf(market.address);
      console.log(`\t\tmarketXytBalanceBefore = ${marketXytBalanceBefore}`);
      await xyt
        .connect(charlie)
        .transferFrom(market.address, charlie.address, marketXytBalanceBefore);
      const marketXytBalanceAfter = await xyt.balanceOf(market.address);
      expect(marketXytBalanceAfter).to.be.lt(BN.from(100));
      console.log(`\t\tmarketXytBalanceAfter = ${marketXytBalanceAfter}`);

      const marketTokenBalanceBefore = await baseToken.balanceOf(
        market.address
      );
      console.log(`\t\tmarketTokenBalanceBefore = ${marketTokenBalanceBefore}`);
      await baseToken
        .connect(charlie)
        .transferFrom(
          market.address,
          charlie.address,
          marketTokenBalanceBefore
        );
      const marketTokenBalanceAfter = await baseToken.balanceOf(market.address);
      expect(marketTokenBalanceAfter).to.be.lt(BN.from(100));
      console.log(`\t\tmarketTokenBalanceAfter = ${marketTokenBalanceAfter}`);
    }

    before(async () => {
      globalSnapshotId = await evm_snapshot();
      await buildCommonTestEnv();
      if (isAaveV1) {
        await buildTestEnvV1();
      } else {
        await buildTestEnvV2();
      }
      const aTokenBalance = await aUSDT.balanceOf(alice.address);
      forgeArgs = [testEnv.FORGE_ID, tokenUSDT.address, testEnv.EXPIRY];
      marketArgs = [consts.MARKET_FACTORY_AAVE, xyt.address, baseToken.address];
      // mint some XYTs to alice
      await router.tokenizeYield(
        ...forgeArgs,
        aTokenBalance.div(10),
        alice.address,
        consts.HIGH_GAS_OVERRIDE
      );
      await router.bootstrapMarket(
        ...marketArgs,
        1000000,
        1000000,
        consts.HIGH_GAS_OVERRIDE
      );
      yieldTokenHolder = aaveForge.yieldTokenHolders(
        tokenUSDT.address,
        testEnv.EXPIRY
      );
      snapshotId = await evm_snapshot();
    });

    after(async () => {
      await evm_revert(globalSnapshotId);
    });

    beforeEach(async () => {
      await evm_revert(snapshotId);
      snapshotId = await evm_snapshot();
    });

    it("Should be able to set pausing admins", async () => {
      await pausingManager.setPausingAdmin(bob.address, true);
      expect(await pausingManager.isPausingAdmin(bob.address)).to.be.eq(true);
      //TODO: check events
    });
    it("Should be able to unset pausing admins", async () => {
      await pausingManager.setPausingAdmin(bob.address, true);
      expect(await pausingManager.isPausingAdmin(bob.address)).to.be.eq(true);
      await pausingManager.setPausingAdmin(bob.address, false);
      expect(await pausingManager.isPausingAdmin(bob.address)).to.be.eq(false);
      //TODO: check events
    });
    describe("Forge pausing", async () => {
      beforeEach(async () => {
        await pausingManager.setPausingAdmin(bob.address, true);
      });
      it("Should be able to pause a particular yield contract", async () => {
        await pausingManager
          .connect(bob)
          .setForgeAssetExpiryPaused(
            testEnv.FORGE_ID,
            tokenUSDT.address,
            testEnv.EXPIRY,
            true
          );
        await checkYieldContractPaused();
      });
      it("Should be able to pause yield contracts based on forge and asset", async () => {
        await pausingManager
          .connect(bob)
          .setForgeAssetPaused(testEnv.FORGE_ID, tokenUSDT.address, true);
        await checkYieldContractPaused();
      });
      it("Should be able to pause yield contracts based on forge", async () => {
        await pausingManager
          .connect(bob)
          .setForgePaused(testEnv.FORGE_ID, true);
        await checkYieldContractPaused();
      });
      it("Pausing admins should not be able to unpause", async () => {
        await expect(
          pausingManager.connect(bob).setForgePaused(testEnv.FORGE_ID, false)
        ).to.be.revertedWith(errMsg.ONLY_GOVERNANCE);
      });
      it("Governance should be able to unpause yield contracts", async () => {
        await pausingManager
          .connect(bob)
          .setForgePaused(testEnv.FORGE_ID, true);
        await pausingManager.setForgePaused(testEnv.FORGE_ID, false);
        await checkYieldContractUnpaused();
      });
      it("Pausing globally & unpausing specific yield contracts should work", async () => {
        await pausingManager
          .connect(bob)
          .setForgePaused(testEnv.FORGE_ID, true);
        await pausingManager.setForgeAssetExpiryPaused(
          testEnv.FORGE_ID,
          tokenUSDT.address,
          testEnv.EXPIRY,
          false
        );
        await checkYieldContractUnpaused();
      });
    });
    describe("Market pausing", async () => {
      beforeEach(async () => {
        await pausingManager.setPausingAdmin(bob.address, true);
      });
      it("Should be able to pause a particular market", async () => {
        await pausingManager
          .connect(bob)
          .setMarketPaused(consts.MARKET_FACTORY_AAVE, market.address, true);
        await checkMarketPaused();
      });
      it("Should be able to pause markets based on market factory", async () => {
        await pausingManager
          .connect(bob)
          .setMarketFactoryPaused(consts.MARKET_FACTORY_AAVE, true);
        await checkMarketPaused();
      });
      it("Pausing admins should not be able to unpause", async () => {
        await expect(
          pausingManager
            .connect(bob)
            .setMarketFactoryPaused(consts.MARKET_FACTORY_AAVE, false)
        ).to.be.revertedWith(errMsg.ONLY_GOVERNANCE);
      });
      it("Governance should be able to unpause markets", async () => {
        await pausingManager
          .connect(bob)
          .setMarketFactoryPaused(consts.MARKET_FACTORY_AAVE, true);
        await pausingManager.setMarketFactoryPaused(
          consts.MARKET_FACTORY_AAVE,
          false
        );
        await checkMarketUnpaused();
      });
      it("Pausing globally & unpausing specific markets should work", async () => {
        await pausingManager
          .connect(bob)
          .setMarketFactoryPaused(consts.MARKET_FACTORY_AAVE, true);
        await pausingManager.setMarketPaused(
          consts.MARKET_FACTORY_AAVE,
          market.address,
          false
        );
        await checkMarketUnpaused();
      });
    });
    describe("Forge emergency", async () => {
      it("Should be able to lock a particular yield contract", async () => {
        await pausingManager.setForgeAssetExpiryLocked(
          testEnv.FORGE_ID,
          tokenUSDT.address,
          testEnv.EXPIRY
        );
        await checkYieldContractLocked();
      });
      it("Should be able to lock yield contracts by forge and asset", async () => {
        await pausingManager.setForgeAssetLocked(
          testEnv.FORGE_ID,
          tokenUSDT.address
        );
        await checkYieldContractLocked();
      });
      it("Should be able to lock yield contracts by forge", async () => {
        await pausingManager.setForgeLocked(testEnv.FORGE_ID);
        await checkYieldContractLocked();
      });
    });
    describe("Market emergency", async () => {
      it("Should be able to lock a particular market", async () => {
        await pausingManager.setMarketLocked(
          consts.MARKET_FACTORY_AAVE,
          market.address
        );
        await checkMarketLocked();
      });
      it("Should be able to lock markets by factory", async () => {
        await pausingManager.setMarketFactoryLocked(consts.MARKET_FACTORY_AAVE);
        await checkMarketLocked();
      });
    });
    //TODO: test for permLock, permMarketHandlerLocked and permForgeHandlerLocked
    //TODO: test for changing marketEmergencyHandler and forgeEmergencyHandler
  });
}
