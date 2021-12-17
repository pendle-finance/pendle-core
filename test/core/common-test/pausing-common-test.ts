import { MiscConsts } from '@pendle/constants';
import chai, { expect } from 'chai';
import { loadFixture, solidity } from 'ethereum-waffle';
import { BigNumber as BN, Wallet } from 'ethers';
import { marketFixture, Mode, parseTestEnvMarketFixture, TestEnv, wallets } from '../../fixtures';
import { advanceTime, errMsg, evm_revert, evm_snapshot, mintCompoundToken, teConsts } from '../../helpers';

chai.use(solidity);

/// TODO: Modify this test to new format
export async function runTest(mode: Mode) {
  const [alice, bob, charlie, dave] = wallets;

  let env: TestEnv = {} as TestEnv;
  let snapshotId: string;
  let globalSnapshotId: string;
  let forgeArgs: any[];
  let marketArgs: any[];
  let yieldTokenHolder: string;

  async function buildCommonEnv() {
    env = await loadFixture(marketFixture);
    await parseTestEnvMarketFixture(env, mode);
    env.TEST_DELTA = BN.from(1500000);
  }

  async function checkYieldContractPaused() {
    await expect(env.router.tokenizeYield(...forgeArgs, 1, alice.address, teConsts.HG)).to.be.revertedWith(
      errMsg.YIELD_CONTRACT_PAUSED
    );
    await expect(env.router.redeemUnderlying(...forgeArgs, 1, teConsts.HG)).to.be.revertedWith(
      errMsg.YIELD_CONTRACT_PAUSED
    );

    await expect(env.xyt.transfer(charlie.address, 1, teConsts.HG)).to.be.revertedWith(errMsg.YIELD_CONTRACT_PAUSED);

    await expect(env.ot.transfer(charlie.address, 1, teConsts.HG)).to.be.revertedWith(errMsg.YIELD_CONTRACT_PAUSED);
    //TODO: the functions with expired yield contract are remained untested
    await expect(
      env.router.redeemDueInterests(env.FORGE_ID, env.USDTContract.address, env.EXPIRY, bob.address, teConsts.HG)
    ).to.be.revertedWith(errMsg.YIELD_CONTRACT_PAUSED);

    await expect(env.forge.withdrawForgeFee(env.USDTContract.address, env.EXPIRY, teConsts.HG)).to.be.revertedWith(
      errMsg.YIELD_CONTRACT_PAUSED
    );
  }

  async function checkYieldContractUnpaused() {
    await env.router.tokenizeYield(...forgeArgs, 1, alice.address, teConsts.HG);
    await env.router.redeemUnderlying(...forgeArgs, 1, teConsts.HG);
    await env.xyt.transfer(charlie.address, 1, teConsts.HG);
    await env.ot.transfer(charlie.address, 1, teConsts.HG);
    //TODO: refactor checkYieldContractPaused and checkYieldContractUnpaused
    await env.router.redeemDueInterests(env.FORGE_ID, env.USDTContract.address, env.EXPIRY, bob.address, teConsts.HG);

    await env.forge.withdrawForgeFee(env.USDTContract.address, env.EXPIRY, teConsts.HG);
  }

  async function checkMarketPaused() {
    await expect(env.router.bootstrapMarket(...marketArgs, 1000, 1000, teConsts.HG)).to.be.revertedWith(
      errMsg.MARKET_PAUSED
    );
    await expect(env.router.addMarketLiquidityDual(...marketArgs, 1000, 1000, 0, 0, teConsts.HG)).to.be.revertedWith(
      errMsg.MARKET_PAUSED
    );
    await expect(env.router.removeMarketLiquidityDual(...marketArgs, 1000, 0, 0, teConsts.HG)).to.be.revertedWith(
      errMsg.MARKET_PAUSED
    );
    await expect(
      env.router.swapExactIn(env.xyt.address, env.testToken.address, 1000, 0, env.MARKET_FACTORY_ID, teConsts.HG)
    ).to.be.revertedWith(errMsg.MARKET_PAUSED);
    await expect(
      env.router.swapExactOut(env.xyt.address, env.testToken.address, 1000, 1000000, env.MARKET_FACTORY_ID, teConsts.HG)
    ).to.be.revertedWith(errMsg.MARKET_PAUSED);
    await expect(env.router.redeemLpInterests(env.market.address, bob.address, teConsts.HG)).to.be.revertedWith(
      errMsg.MARKET_PAUSED
    );
  }

  async function checkMarketUnpaused() {
    await env.router.addMarketLiquidityDual(...marketArgs, 1000, 1000, 0, 0, teConsts.HG);
    await env.router.removeMarketLiquidityDual(...marketArgs, 1000, 0, 0, teConsts.HG);
    await env.router.swapExactIn(env.xyt.address, env.testToken.address, 1000, 0, env.MARKET_FACTORY_ID, teConsts.HG);
    await env.router.swapExactOut(
      env.xyt.address,
      env.testToken.address,
      1000,
      1000000,
      env.MARKET_FACTORY_ID,
      teConsts.HG
    );

    await env.router.redeemLpInterests(env.market.address, bob.address, teConsts.HG);
  }

  async function checkYieldContractLocked() {
    await checkYieldContractPaused();
    const [paused, locked] = await env.pausingManagerMain.callStatic.checkYieldContractStatus(...forgeArgs);
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
    const [paused, locked] = await env.pausingManagerMain.callStatic.checkMarketStatus(
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

    if (mode == Mode.COMPOUND) await mintCompoundToken(env, env.ptokens.USDT!, alice, BN.from(10000));
    const aTokenBalance = await env.yToken.balanceOf(alice.address);

    forgeArgs = [env.FORGE_ID, env.USDTContract.address, env.EXPIRY];
    marketArgs = [env.MARKET_FACTORY_ID, env.xyt.address, env.testToken.address];
    // mint some XYTs to alice
    if (aTokenBalance.toNumber() > 0)
      await env.router.tokenizeYield(...forgeArgs, aTokenBalance.div(10), alice.address, teConsts.HG);
    await env.router.bootstrapMarket(...marketArgs, 1000000, 1000000, teConsts.HG);
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
    await env.pausingManagerMain.setPausingAdmin(bob.address, true);
    expect(await env.pausingManagerMain.isPausingAdmin(bob.address)).to.be.eq(true);
    await expect(env.pausingManagerMain.setPausingAdmin(bob.address, true)).to.be.revertedWith(errMsg.REDUNDANT_SET);
    await expect(env.pausingManagerMain.setPausingAdmin(bob.address, false))
      .to.emit(env.pausingManagerMain, 'RemovePausingAdmin')
      .withArgs(bob.address);
    await expect(env.pausingManagerMain.setPausingAdmin(bob.address, true))
      .to.emit(env.pausingManagerMain, 'AddPausingAdmin')
      .withArgs(bob.address);
  });
  it('Should be able to unset pausing admins', async () => {
    await env.pausingManagerMain.setPausingAdmin(bob.address, true);
    expect(await env.pausingManagerMain.isPausingAdmin(bob.address)).to.be.eq(true);
    await env.pausingManagerMain.setPausingAdmin(bob.address, false);
    expect(await env.pausingManagerMain.isPausingAdmin(bob.address)).to.be.eq(false);
  });
  describe('Forge pausing', async () => {
    beforeEach(async () => {
      await env.pausingManagerMain.setPausingAdmin(bob.address, true, teConsts.HG);
    });
    it('Should be able to pause a particular yield contract', async () => {
      await env.pausingManagerMain
        .connect(bob)
        .setForgeAssetExpiryPaused(env.FORGE_ID, env.USDTContract.address, env.EXPIRY, true);
      await checkYieldContractPaused();
    });
    it('Should be able to pause yield contracts based on forge and asset', async () => {
      await env.pausingManagerMain.connect(bob).setForgeAssetPaused(env.FORGE_ID, env.USDTContract.address, true);
      await checkYieldContractPaused();
    });
    it('Should be able to pause yield contracts based on forge', async () => {
      await env.pausingManagerMain.connect(bob).setForgePaused(env.FORGE_ID, true);
      await checkYieldContractPaused();
    });
    it('Pausing admins should not be able to unpause', async () => {
      await expect(env.pausingManagerMain.connect(bob).setForgePaused(env.FORGE_ID, false)).to.be.revertedWith(
        errMsg.ONLY_GOVERNANCE
      );
    });
    it('Governance should be able to unpause yield contracts', async () => {
      await env.pausingManagerMain.connect(bob).setForgePaused(env.FORGE_ID, true);
      await env.pausingManagerMain.setForgePaused(env.FORGE_ID, false);
      await checkYieldContractUnpaused();
    });
    it('Pausing globally & unpausing specific yield contracts should work', async () => {
      await env.pausingManagerMain.connect(bob).setForgePaused(env.FORGE_ID, true);
      await env.pausingManagerMain
        .connect(bob)
        .setForgeAssetExpiryPaused(env.FORGE_ID, env.USDTContract.address, env.EXPIRY, true);
      await env.pausingManagerMain.connect(alice).setForgePaused(env.FORGE_ID, false);
      await checkYieldContractPaused();
    });
  });
  describe('Market pausing', async () => {
    beforeEach(async () => {
      await env.pausingManagerMain.setPausingAdmin(bob.address, true);
    });
    it('Should be able to pause a particular market', async () => {
      await env.pausingManagerMain.connect(bob).setMarketPaused(env.MARKET_FACTORY_ID, env.market.address, true);
      await checkMarketPaused();
    });
    it('Should be able to pause markets based on market factory', async () => {
      await env.pausingManagerMain.connect(bob).setMarketFactoryPaused(env.MARKET_FACTORY_ID, true);
      await checkMarketPaused();
    });
    it('Pausing admins should not be able to unpause', async () => {
      await expect(
        env.pausingManagerMain.connect(bob).setMarketFactoryPaused(env.MARKET_FACTORY_ID, false)
      ).to.be.revertedWith(errMsg.ONLY_GOVERNANCE);
    });
    it('Governance should be able to unpause markets', async () => {
      await env.pausingManagerMain.connect(bob).setMarketFactoryPaused(env.MARKET_FACTORY_ID, true);
      await env.pausingManagerMain.setMarketFactoryPaused(env.MARKET_FACTORY_ID, false);
      await checkMarketUnpaused();
    });
    it('Pausing globally & unpausing specific markets should work', async () => {
      await env.pausingManagerMain.connect(bob).setMarketFactoryPaused(env.MARKET_FACTORY_ID, true);
      await env.pausingManagerMain.connect(bob).setMarketPaused(env.MARKET_FACTORY_ID, env.market.address, true);
      await env.pausingManagerMain.connect(alice).setMarketFactoryPaused(env.MARKET_FACTORY_ID, false);
      await checkMarketPaused();
    });
  });
  describe('Forge emergency', async () => {
    it('Should be able to lock a particular yield contract', async () => {
      await env.pausingManagerMain.setForgeAssetExpiryLocked(env.FORGE_ID, env.USDTContract.address, env.EXPIRY);
      await checkYieldContractLocked();
    });
    it('Should be able to lock yield contracts by forge and asset', async () => {
      await env.pausingManagerMain.setForgeAssetLocked(env.FORGE_ID, env.USDTContract.address);
      await checkYieldContractLocked();
    });
    it('Should be able to lock yield contracts by forge', async () => {
      await env.pausingManagerMain.setForgeLocked(env.FORGE_ID);
      await checkYieldContractLocked();
    });
  });
  describe('Market emergency', async () => {
    it('Should be able to lock a particular market', async () => {
      await env.pausingManagerMain.setMarketLocked(env.MARKET_FACTORY_ID, env.market.address);
      await checkMarketLocked();
    });
    it('Should be able to lock markets by factory', async () => {
      await env.pausingManagerMain.setMarketFactoryLocked(env.MARKET_FACTORY_ID);
      await checkMarketLocked();
    });
  });
  describe('Permalock tests', async () => {
    let permaLockSnapshot;
    beforeEach(async () => {
      permaLockSnapshot = evm_snapshot();

      await env.pausingManagerMain.setPausingAdmin(bob.address, true);
    });

    async function permaLockTests() {
      await expect(env.pausingManagerMain.setPausingAdmin(dave.address, true)).to.be.revertedWith(
        errMsg.PERMANENTLY_LOCKED
      );
      await expect(env.pausingManagerMain.applyForgeHandlerChange()).to.be.revertedWith(errMsg.PERMANENTLY_LOCKED);
      await expect(env.pausingManagerMain.lockPausingManagerPermanently()).to.be.revertedWith(
        errMsg.PERMANENTLY_LOCKED
      );
      await expect(env.pausingManagerMain.connect(bob).setForgePaused(env.FORGE_ID, true)).to.be.revertedWith(
        errMsg.PERMANENTLY_LOCKED
      );
      await expect(
        env.pausingManagerMain.connect(bob).setForgeAssetPaused(env.FORGE_ID, env.USDTContract.address, true)
      ).to.be.revertedWith(errMsg.PERMANENTLY_LOCKED);
      await expect(
        env.pausingManagerMain
          .connect(bob)
          .setForgeAssetExpiryPaused(env.FORGE_ID, env.USDTContract.address, env.EXPIRY, true)
      ).to.be.revertedWith(errMsg.PERMANENTLY_LOCKED);
      await expect(env.pausingManagerMain.setForgeLocked(env.FORGE_ID)).to.be.revertedWith(errMsg.PERMANENTLY_LOCKED);
      await expect(
        env.pausingManagerMain.setForgeAssetLocked(env.FORGE_ID, env.USDTContract.address)
      ).to.be.revertedWith(errMsg.PERMANENTLY_LOCKED);
      await expect(
        env.pausingManagerMain.setForgeAssetExpiryLocked(env.FORGE_ID, env.USDTContract.address, env.EXPIRY)
      ).to.be.revertedWith(errMsg.PERMANENTLY_LOCKED);
      await expect(env.pausingManagerMain.requestForgeHandlerChange(bob.address)).to.be.revertedWith(
        errMsg.PERMANENTLY_LOCKED
      );
      await expect(env.pausingManagerMain.requestMarketHandlerChange(bob.address)).to.be.revertedWith(
        errMsg.PERMANENTLY_LOCKED
      );
    }

    it('Only governance should be able to lock permanently', async () => {
      await expect(env.pausingManagerMain.connect(bob).lockPausingManagerPermanently()).to.be.revertedWith(
        errMsg.ONLY_GOVERNANCE
      );
      await expect(env.pausingManagerMain.connect(bob).lockForgeHandlerPermanently()).to.be.revertedWith(
        errMsg.ONLY_GOVERNANCE
      );
    });

    it('All features should be paused after locking', async () => {
      await env.pausingManagerMain.lockForgeHandlerPermanently();
      await expect(env.pausingManagerMain.requestForgeHandlerChange(bob.address)).to.be.revertedWith(
        errMsg.FORGE_HANDLER_LOCKED
      );

      await env.pausingManagerMain.lockMarketHandlerPermanently();
      await expect(env.pausingManagerMain.requestMarketHandlerChange(bob.address)).to.be.revertedWith(
        errMsg.MARKET_HANDLER_LOCKED
      );

      await env.pausingManagerMain.lock;

      await env.pausingManagerMain.lockPausingManagerPermanently();
      await permaLockTests();
    });

    it('Hanlder changes should work correctly', async () => {
      let consts = env.pconsts;
      async function checkHandler(handlers: Wallet[], pendingHandlers?: Wallet[]) {
        const emergencyHandlers = [
          await env.pausingManagerMain.forgeEmergencyHandler(), // forge
          await env.pausingManagerMain.marketEmergencyHandler(), // market
          await env.pausingManagerMain.liqMiningEmergencyHandler(), // liquidity mining
        ];
        for (let i = 0; i < 3; ++i) {
          expect(emergencyHandlers[i].handler).to.be.equal(handlers[i].address);
          if (pendingHandlers) {
            expect(emergencyHandlers[i].pendingHandler).to.be.equal(pendingHandlers[i].address);
          }
        }
      }

      await env.pausingManagerMain.requestForgeHandlerChange(bob.address, teConsts.HG);
      await env.pausingManagerMain.requestMarketHandlerChange(charlie.address, teConsts.HG);
      await env.pausingManagerMain.requestLiqMiningHandlerChange(dave.address, teConsts.HG);
      await checkHandler([alice, alice, alice], [bob, charlie, dave]);

      await advanceTime(MiscConsts.ONE_DAY);
      await expect(env.pausingManagerMain.applyForgeHandlerChange()).to.be.revertedWith(errMsg.TIMELOCK_NOT_OVER);
      await expect(env.pausingManagerMain.applyMarketHandlerChange()).to.be.revertedWith(errMsg.TIMELOCK_NOT_OVER);
      await expect(env.pausingManagerMain.applyLiqMiningHandlerChange()).to.be.revertedWith(errMsg.TIMELOCK_NOT_OVER);

      await advanceTime(MiscConsts.ONE_WEEK.sub(MiscConsts.ONE_DAY).add(MiscConsts.ONE_HOUR));
      await env.pausingManagerMain.applyForgeHandlerChange(teConsts.HG);
      await env.pausingManagerMain.applyMarketHandlerChange(teConsts.HG);
      await env.pausingManagerMain.applyLiqMiningHandlerChange(teConsts.HG);

      await checkHandler([bob, charlie, dave]);

      await env.pausingManagerMain.lockForgeHandlerPermanently();
      await env.pausingManagerMain.lockMarketHandlerPermanently();
      await env.pausingManagerMain.lockLiqMiningHandlerPermanently();

      await expect(env.pausingManagerMain.requestForgeHandlerChange(bob.address, teConsts.HG)).to.be.revertedWith(
        errMsg.FORGE_HANDLER_LOCKED
      );

      await expect(env.pausingManagerMain.requestMarketHandlerChange(charlie.address, teConsts.HG)).to.be.revertedWith(
        errMsg.MARKET_HANDLER_LOCKED
      );

      await expect(env.pausingManagerMain.requestLiqMiningHandlerChange(dave.address, teConsts.HG)).to.be.revertedWith(
        errMsg.LIQUIDITY_MINING_HANDLER_LOCKED
      );
    });
  });
}
