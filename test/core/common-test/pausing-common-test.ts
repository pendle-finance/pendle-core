import chai, { expect } from 'chai';
import { solidity } from 'ethereum-waffle';
import { BigNumber as BN, Wallet } from 'ethers';
import { marketFixture, MarketFixture, Mode, parseTestEnvMarketFixture, TestEnv } from '../../fixtures';
import { advanceTime, consts, errMsg, evm_revert, evm_snapshot, mintCompoundToken, tokens } from '../../helpers';
const { waffle } = require('hardhat');
chai.use(solidity);

const { loadFixture, provider } = waffle;

/// TODO: Modify this test to new format
export async function runTest(mode: Mode) {
  const wallets = provider.getWallets();
  const [alice, bob, charlie, dave] = wallets;

  let env: TestEnv = {} as TestEnv;
  let snapshotId: string;
  let globalSnapshotId: string;
  let forgeArgs: any[];
  let marketArgs: any[];
  let yieldTokenHolder: string;

  async function buildCommonEnv() {
    let fixture: MarketFixture = await loadFixture(marketFixture);
    await parseTestEnvMarketFixture(alice, mode, env, fixture);
    env.TEST_DELTA = BN.from(1500000);
  }

  async function checkYieldContractPaused() {
    await expect(env.router.tokenizeYield(...forgeArgs, 1, alice.address, consts.HG)).to.be.revertedWith(
      errMsg.YIELD_CONTRACT_PAUSED
    );
    await expect(env.router.redeemUnderlying(...forgeArgs, 1, consts.HG)).to.be.revertedWith(
      errMsg.YIELD_CONTRACT_PAUSED
    );

    await expect(env.xyt.transfer(charlie.address, 1, consts.HG)).to.be.revertedWith(errMsg.YIELD_CONTRACT_PAUSED);

    await expect(env.ot.transfer(charlie.address, 1, consts.HG)).to.be.revertedWith(errMsg.YIELD_CONTRACT_PAUSED);
    //TODO: the functions with expired yield contract are remained untested
    await expect(
      env.router.redeemDueInterests(env.FORGE_ID, env.USDTContract.address, env.EXPIRY, bob.address, consts.HG)
    ).to.be.revertedWith(errMsg.YIELD_CONTRACT_PAUSED);

    await expect(env.forge.withdrawForgeFee(env.USDTContract.address, env.EXPIRY, consts.HG)).to.be.revertedWith(
      errMsg.YIELD_CONTRACT_PAUSED
    );
  }

  async function checkYieldContractUnpaused() {
    await env.router.tokenizeYield(...forgeArgs, 1, alice.address, consts.HG);
    await env.router.redeemUnderlying(...forgeArgs, 1, consts.HG);
    await env.xyt.transfer(charlie.address, 1, consts.HG);
    await env.ot.transfer(charlie.address, 1, consts.HG);
    //TODO: refactor checkYieldContractPaused and checkYieldContractUnpaused
    await env.router.redeemDueInterests(env.FORGE_ID, env.USDTContract.address, env.EXPIRY, bob.address, consts.HG);

    await env.forge.withdrawForgeFee(env.USDTContract.address, env.EXPIRY, consts.HG);
  }

  async function checkMarketPaused() {
    await expect(env.router.bootstrapMarket(...marketArgs, 1000, 1000, consts.HG)).to.be.revertedWith(
      errMsg.MARKET_PAUSED
    );
    await expect(env.router.addMarketLiquidityDual(...marketArgs, 1000, 1000, 0, 0, consts.HG)).to.be.revertedWith(
      errMsg.MARKET_PAUSED
    );
    await expect(env.router.removeMarketLiquidityDual(...marketArgs, 1000, 0, 0, consts.HG)).to.be.revertedWith(
      errMsg.MARKET_PAUSED
    );
    await expect(
      env.router.swapExactIn(env.xyt.address, env.testToken.address, 1000, 0, env.MARKET_FACTORY_ID, consts.HG)
    ).to.be.revertedWith(errMsg.MARKET_PAUSED);
    await expect(
      env.router.swapExactOut(env.xyt.address, env.testToken.address, 1000, 1000000, env.MARKET_FACTORY_ID, consts.HG)
    ).to.be.revertedWith(errMsg.MARKET_PAUSED);
    await expect(env.router.redeemLpInterests(env.market.address, bob.address, consts.HG)).to.be.revertedWith(
      errMsg.MARKET_PAUSED
    );
  }

  async function checkMarketUnpaused() {
    await env.router.addMarketLiquidityDual(...marketArgs, 1000, 1000, 0, 0, consts.HG);
    await env.router.removeMarketLiquidityDual(...marketArgs, 1000, 0, 0, consts.HG);
    await env.router.swapExactIn(env.xyt.address, env.testToken.address, 1000, 0, env.MARKET_FACTORY_ID, consts.HG);
    await env.router.swapExactOut(
      env.xyt.address,
      env.testToken.address,
      1000,
      1000000,
      env.MARKET_FACTORY_ID,
      consts.HG
    );

    await env.router.redeemLpInterests(env.market.address, bob.address, consts.HG);
  }

  async function checkYieldContractLocked() {
    await checkYieldContractPaused();
    const [paused, locked] = await env.pausingManager.callStatic.checkYieldContractStatus(...forgeArgs);
    expect(paused).to.be.eq(true);
    expect(locked).to.be.eq(true);
    await env.forge.setUpEmergencyMode(env.USDTContract.address, env.EXPIRY, charlie.address);
    const yieldTokenHolderBalanceBefore = await env.yToken.balanceOf(yieldTokenHolder);
    console.log(`\t\tyieldTokenHolderBalanceBefore = ${yieldTokenHolderBalanceBefore}`);
    await env.yToken.connect(charlie).transferFrom(yieldTokenHolder, charlie.address, yieldTokenHolderBalanceBefore);
    const yieldTokenHolderBalanceAfter = await env.yToken.balanceOf(yieldTokenHolder);
    expect(yieldTokenHolderBalanceAfter).to.be.lt(BN.from(500));
    console.log(`\t\tyieldTokenHolderBalanceAfter = ${yieldTokenHolderBalanceAfter}`);
  }

  async function checkMarketLocked() {
    await checkMarketPaused();
    const [paused, locked] = await env.pausingManager.callStatic.checkMarketStatus(
      env.MARKET_FACTORY_ID,
      env.market.address
    );
    expect(paused).to.be.eq(true);
    expect(locked).to.be.eq(true);
    await env.market.setUpEmergencyMode(charlie.address);

    const marketXytBalanceBefore = await env.xyt.balanceOf(env.market.address);
    console.log(`\t\tmarketXytBalanceBefore = ${marketXytBalanceBefore}`);
    await env.xyt.connect(charlie).transferFrom(env.market.address, charlie.address, marketXytBalanceBefore);
    const marketXytBalanceAfter = await env.xyt.balanceOf(env.market.address);
    expect(marketXytBalanceAfter).to.be.lt(BN.from(100));
    console.log(`\t\tmarketXytBalanceAfter = ${marketXytBalanceAfter}`);

    const marketTokenBalanceBefore = await env.testToken.balanceOf(env.market.address);
    console.log(`\t\tmarketTokenBalanceBefore = ${marketTokenBalanceBefore}`);
    await env.testToken.connect(charlie).transferFrom(env.market.address, charlie.address, marketTokenBalanceBefore);
    const marketTokenBalanceAfter = await env.testToken.balanceOf(env.market.address);
    expect(marketTokenBalanceAfter).to.be.lt(BN.from(100));
    console.log(`\t\tmarketTokenBalanceAfter = ${marketTokenBalanceAfter}`);
  }

  before(async () => {
    await buildCommonEnv();
    globalSnapshotId = await evm_snapshot();

    if (mode == Mode.COMPOUND) await mintCompoundToken(tokens.USDT, alice, BN.from(10000));
    const aTokenBalance = await env.yToken.balanceOf(alice.address);

    forgeArgs = [env.FORGE_ID, env.USDTContract.address, env.EXPIRY];
    marketArgs = [env.MARKET_FACTORY_ID, env.xyt.address, env.testToken.address];
    // mint some XYTs to alice
    if (aTokenBalance.toNumber() > 0)
      await env.router.tokenizeYield(...forgeArgs, aTokenBalance.div(10), alice.address, consts.HG);
    await env.router.bootstrapMarket(...marketArgs, 1000000, 1000000, consts.HG);
    yieldTokenHolder = env.forge.yieldTokenHolders(env.USDTContract.address, env.EXPIRY);
    snapshotId = await evm_snapshot();
  });

  after(async () => {
    await evm_revert(globalSnapshotId);
  });

  beforeEach(async () => {
    await evm_revert(snapshotId);
    snapshotId = await evm_snapshot();
  });

  it('Should be able to set pausing admins', async () => {
    await env.pausingManager.setPausingAdmin(bob.address, true);
    expect(await env.pausingManager.isPausingAdmin(bob.address)).to.be.eq(true);
    await expect(env.pausingManager.setPausingAdmin(bob.address, true)).to.be.revertedWith(errMsg.REDUNDANT_SET);
    await expect(env.pausingManager.setPausingAdmin(bob.address, false))
      .to.emit(env.pausingManager, 'RemovePausingAdmin')
      .withArgs(bob.address);
    await expect(env.pausingManager.setPausingAdmin(bob.address, true))
      .to.emit(env.pausingManager, 'AddPausingAdmin')
      .withArgs(bob.address);
  });
  it('Should be able to unset pausing admins', async () => {
    await env.pausingManager.setPausingAdmin(bob.address, true);
    expect(await env.pausingManager.isPausingAdmin(bob.address)).to.be.eq(true);
    await env.pausingManager.setPausingAdmin(bob.address, false);
    expect(await env.pausingManager.isPausingAdmin(bob.address)).to.be.eq(false);
  });
  describe('Forge pausing', async () => {
    beforeEach(async () => {
      await env.pausingManager.setPausingAdmin(bob.address, true, consts.HG);
    });
    it('Should be able to pause a particular yield contract', async () => {
      await env.pausingManager
        .connect(bob)
        .setForgeAssetExpiryPaused(env.FORGE_ID, env.USDTContract.address, env.EXPIRY, true);
      await checkYieldContractPaused();
    });
    it('Should be able to pause yield contracts based on forge and asset', async () => {
      await env.pausingManager.connect(bob).setForgeAssetPaused(env.FORGE_ID, env.USDTContract.address, true);
      await checkYieldContractPaused();
    });
    it('Should be able to pause yield contracts based on forge', async () => {
      await env.pausingManager.connect(bob).setForgePaused(env.FORGE_ID, true);
      await checkYieldContractPaused();
    });
    it('Pausing admins should not be able to unpause', async () => {
      await expect(env.pausingManager.connect(bob).setForgePaused(env.FORGE_ID, false)).to.be.revertedWith(
        errMsg.ONLY_GOVERNANCE
      );
    });
    it('Governance should be able to unpause yield contracts', async () => {
      await env.pausingManager.connect(bob).setForgePaused(env.FORGE_ID, true);
      await env.pausingManager.setForgePaused(env.FORGE_ID, false);
      await checkYieldContractUnpaused();
    });
    it('Pausing globally & unpausing specific yield contracts should work', async () => {
      await env.pausingManager.connect(bob).setForgePaused(env.FORGE_ID, true);
      await env.pausingManager
        .connect(bob)
        .setForgeAssetExpiryPaused(env.FORGE_ID, env.USDTContract.address, env.EXPIRY, true);
      await env.pausingManager.connect(alice).setForgePaused(env.FORGE_ID, false);
      await checkYieldContractPaused();
    });
  });
  describe('Market pausing', async () => {
    beforeEach(async () => {
      await env.pausingManager.setPausingAdmin(bob.address, true);
    });
    it('Should be able to pause a particular market', async () => {
      await env.pausingManager.connect(bob).setMarketPaused(env.MARKET_FACTORY_ID, env.market.address, true);
      await checkMarketPaused();
    });
    it('Should be able to pause markets based on market factory', async () => {
      await env.pausingManager.connect(bob).setMarketFactoryPaused(env.MARKET_FACTORY_ID, true);
      await checkMarketPaused();
    });
    it('Pausing admins should not be able to unpause', async () => {
      await expect(
        env.pausingManager.connect(bob).setMarketFactoryPaused(env.MARKET_FACTORY_ID, false)
      ).to.be.revertedWith(errMsg.ONLY_GOVERNANCE);
    });
    it('Governance should be able to unpause markets', async () => {
      await env.pausingManager.connect(bob).setMarketFactoryPaused(env.MARKET_FACTORY_ID, true);
      await env.pausingManager.setMarketFactoryPaused(env.MARKET_FACTORY_ID, false);
      await checkMarketUnpaused();
    });
    it('Pausing globally & unpausing specific markets should work', async () => {
      await env.pausingManager.connect(bob).setMarketFactoryPaused(env.MARKET_FACTORY_ID, true);
      await env.pausingManager.connect(bob).setMarketPaused(env.MARKET_FACTORY_ID, env.market.address, true);
      await env.pausingManager.connect(alice).setMarketFactoryPaused(env.MARKET_FACTORY_ID, false);
      await checkMarketPaused();
    });
  });
  describe('Forge emergency', async () => {
    it('Should be able to lock a particular yield contract', async () => {
      await env.pausingManager.setForgeAssetExpiryLocked(env.FORGE_ID, env.USDTContract.address, env.EXPIRY);
      await checkYieldContractLocked();
    });
    it('Should be able to lock yield contracts by forge and asset', async () => {
      await env.pausingManager.setForgeAssetLocked(env.FORGE_ID, env.USDTContract.address);
      await checkYieldContractLocked();
    });
    it('Should be able to lock yield contracts by forge', async () => {
      await env.pausingManager.setForgeLocked(env.FORGE_ID);
      await checkYieldContractLocked();
    });
  });
  describe('Market emergency', async () => {
    it('Should be able to lock a particular market', async () => {
      await env.pausingManager.setMarketLocked(env.MARKET_FACTORY_ID, env.market.address);
      await checkMarketLocked();
    });
    it('Should be able to lock markets by factory', async () => {
      await env.pausingManager.setMarketFactoryLocked(env.MARKET_FACTORY_ID);
      await checkMarketLocked();
    });
  });
  describe('Permalock tests', async () => {
    let permaLockSnapshot;
    beforeEach(async () => {
      permaLockSnapshot = evm_snapshot();

      await env.pausingManager.setPausingAdmin(bob.address, true);
    });

    async function permaLockTests() {
      await expect(env.pausingManager.setPausingAdmin(dave.address, true)).to.be.revertedWith(
        errMsg.PERMANENTLY_LOCKED
      );
      await expect(env.pausingManager.applyForgeHandlerChange()).to.be.revertedWith(errMsg.PERMANENTLY_LOCKED);
      await expect(env.pausingManager.lockPausingManagerPermanently()).to.be.revertedWith(errMsg.PERMANENTLY_LOCKED);
      await expect(env.pausingManager.connect(bob).setForgePaused(env.FORGE_ID, true)).to.be.revertedWith(
        errMsg.PERMANENTLY_LOCKED
      );
      await expect(
        env.pausingManager.connect(bob).setForgeAssetPaused(env.FORGE_ID, env.USDTContract.address, true)
      ).to.be.revertedWith(errMsg.PERMANENTLY_LOCKED);
      await expect(
        env.pausingManager
          .connect(bob)
          .setForgeAssetExpiryPaused(env.FORGE_ID, env.USDTContract.address, env.EXPIRY, true)
      ).to.be.revertedWith(errMsg.PERMANENTLY_LOCKED);
      await expect(env.pausingManager.setForgeLocked(env.FORGE_ID)).to.be.revertedWith(errMsg.PERMANENTLY_LOCKED);
      await expect(env.pausingManager.setForgeAssetLocked(env.FORGE_ID, env.USDTContract.address)).to.be.revertedWith(
        errMsg.PERMANENTLY_LOCKED
      );
      await expect(
        env.pausingManager.setForgeAssetExpiryLocked(env.FORGE_ID, env.USDTContract.address, env.EXPIRY)
      ).to.be.revertedWith(errMsg.PERMANENTLY_LOCKED);
      await expect(env.pausingManager.requestForgeHandlerChange(bob.address)).to.be.revertedWith(
        errMsg.PERMANENTLY_LOCKED
      );
      await expect(env.pausingManager.requestMarketHandlerChange(bob.address)).to.be.revertedWith(
        errMsg.PERMANENTLY_LOCKED
      );
    }

    it('Only governance should be able to lock permanently', async () => {
      await expect(env.pausingManager.connect(bob).lockPausingManagerPermanently()).to.be.revertedWith(
        errMsg.ONLY_GOVERNANCE
      );
      await expect(env.pausingManager.connect(bob).lockForgeHandlerPermanently()).to.be.revertedWith(
        errMsg.ONLY_GOVERNANCE
      );
    });

    it('All features should be paused after locking', async () => {
      await env.pausingManager.lockForgeHandlerPermanently();
      await expect(env.pausingManager.requestForgeHandlerChange(bob.address)).to.be.revertedWith(
        errMsg.FORGE_HANDLER_LOCKED
      );

      await env.pausingManager.lockMarketHandlerPermanently();
      await expect(env.pausingManager.requestMarketHandlerChange(bob.address)).to.be.revertedWith(
        errMsg.MARKET_HANDLER_LOCKED
      );

      await env.pausingManager.lock;

      await env.pausingManager.lockPausingManagerPermanently();
      await permaLockTests();
    });

    it('Hanlder changes should work correctly', async () => {
      async function checkHandler(handlers: Wallet[], pendingHandlers?: Wallet[]) {
        const emergencyHandlers = [
          await env.pausingManager.forgeEmergencyHandler(), // forge
          await env.pausingManager.marketEmergencyHandler(), // market
          await env.pausingManager.liqMiningEmergencyHandler(), // liquidity mining
        ];
        for (let i = 0; i < 3; ++i) {
          expect(emergencyHandlers[i].handler).to.be.equal(handlers[i].address);
          if (pendingHandlers) {
            expect(emergencyHandlers[i].pendingHandler).to.be.equal(pendingHandlers[i].address);
          }
        }
      }

      await env.pausingManager.requestForgeHandlerChange(bob.address, consts.HG);
      await env.pausingManager.requestMarketHandlerChange(charlie.address, consts.HG);
      await env.pausingManager.requestLiqMiningHandlerChange(dave.address, consts.HG);
      await checkHandler([alice, alice, alice], [bob, charlie, dave]);

      await advanceTime(consts.ONE_DAY);
      await expect(env.pausingManager.applyForgeHandlerChange()).to.be.revertedWith(errMsg.TIMELOCK_NOT_OVER);
      await expect(env.pausingManager.applyMarketHandlerChange()).to.be.revertedWith(errMsg.TIMELOCK_NOT_OVER);
      await expect(env.pausingManager.applyLiqMiningHandlerChange()).to.be.revertedWith(errMsg.TIMELOCK_NOT_OVER);

      await advanceTime(consts.ONE_WEEK.sub(consts.ONE_DAY).add(consts.ONE_HOUR));
      await env.pausingManager.applyForgeHandlerChange(consts.HG);
      await env.pausingManager.applyMarketHandlerChange(consts.HG);
      await env.pausingManager.applyLiqMiningHandlerChange(consts.HG);

      await checkHandler([bob, charlie, dave]);

      await env.pausingManager.lockForgeHandlerPermanently();
      await env.pausingManager.lockMarketHandlerPermanently();
      await env.pausingManager.lockLiqMiningHandlerPermanently();

      await expect(env.pausingManager.requestForgeHandlerChange(bob.address, consts.HG)).to.be.revertedWith(
        errMsg.FORGE_HANDLER_LOCKED
      );

      await expect(env.pausingManager.requestMarketHandlerChange(charlie.address, consts.HG)).to.be.revertedWith(
        errMsg.MARKET_HANDLER_LOCKED
      );

      await expect(env.pausingManager.requestLiqMiningHandlerChange(dave.address, consts.HG)).to.be.revertedWith(
        errMsg.LIQUIDITY_MINING_HANDLER_LOCKED
      );
    });
  });
}
