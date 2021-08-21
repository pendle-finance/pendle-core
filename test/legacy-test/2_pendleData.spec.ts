import { expect } from 'chai';
import { BigNumber as BN, Contract } from 'ethers';
import PendleData from '../../build/artifacts/contracts/core/PendleData.sol/PendleData.json';
import { checkDisabled, marketFixture, MarketFixture, Mode } from '../fixtures';
import { consts, errMsg, evm_revert, evm_snapshot, tokens } from '../helpers';
const { waffle } = require('hardhat');
const { provider, deployContract, loadFixture } = waffle;

export async function runTest(mode: Mode) {
  describe('', async () => {
    let data: Contract;
    let treasury: Contract;
    let fixture: MarketFixture;
    let pausingManager: Contract;
    let testToken: Contract;
    let snapshotId: string;
    let globalSnapshotId: string;

    const wallets = provider.getWallets();
    const [alice, bob, charlie] = wallets;

    before(async () => {
      fixture = await loadFixture(marketFixture);
      globalSnapshotId = await evm_snapshot();

      treasury = fixture.core.treasury;
      data = fixture.core.data;
      pausingManager = fixture.core.pausingManager;
      testToken = fixture.testToken;
      snapshotId = await evm_snapshot();
    });

    after(async () => {
      await evm_revert(globalSnapshotId);
    });

    beforeEach(async () => {
      await evm_revert(snapshotId);
      snapshotId = await evm_snapshot();
    });

    it('Should be able to deploy with correct initial data', async () => {
      const treasuryInData = await data.treasury();
      expect(treasuryInData.toLowerCase()).to.be.eq(treasury.address.toLowerCase());
      const pausingManagerInData = await data.pausingManager();
      expect(pausingManagerInData.toLowerCase()).to.be.eq(pausingManager.address.toLowerCase());
      const routerInData = await data.router();
      expect(routerInData.toLowerCase()).to.be.eq(fixture.core.router.address.toLowerCase());
    });

    it('Should not be able to construct with zero address as treasury', async () => {
      await expect(
        deployContract(alice, PendleData, [
          fixture.core.govManager.address,
          consts.ZERO_ADDRESS,
          fixture.core.pausingManager.address,
        ])
      ).to.be.revertedWith(errMsg.ZERO_ADDRESS);
    });

    it('Should not be initialized by non-initializer and should not be able to initialize router to zero address', async () => {
      let testPendleDataContract: Contract;
      testPendleDataContract = await deployContract(alice, PendleData, [
        fixture.core.govManager.address,
        fixture.core.treasury.address,
        fixture.core.pausingManager.address,
      ]);
      await expect(testPendleDataContract.connect(bob).initialize(fixture.core.router.address)).to.be.revertedWith(
        errMsg.FORBIDDEN
      );
      await expect(testPendleDataContract.connect(alice).initialize(consts.ZERO_ADDRESS)).to.be.revertedWith(
        errMsg.ZERO_ADDRESS
      );
    });

    it('Should be able to get allMarketsLength', async () => {
      let allMarketsLength = await data.allMarketsLength();
      expect(allMarketsLength).to.be.eq(4); // numbers of markets that have been created in marketFixture
    });

    it('Should be able to setTreasury', async () => {
      await expect(data.setTreasury(treasury.address)).to.emit(data, 'TreasurySet').withArgs(treasury.address);
    });

    it('Should be able to set interest update rate delta', async () => {
      let delta = 100;
      await expect(data.setInterestUpdateRateDeltaForMarket(BN.from(delta)))
        .to.emit(data, 'InterestUpdateRateDeltaForMarketSet')
        .withArgs(BN.from(delta));
      const newDelta = await data.interestUpdateRateDeltaForMarket();
      expect(newDelta).to.be.eq(BN.from(delta));
    });

    it('Should not be able to set zero address as Treasury', async () => {
      await expect(data.setTreasury(consts.ZERO_ADDRESS)).to.be.revertedWith(errMsg.ZERO_ADDRESS);
    });

    it('Should be able to set lock numerator and denominator', async () => {
      let num = 7;
      let den = 19;
      await expect(data.setLockParams(BN.from(num), BN.from(den)))
        .to.emit(data, 'LockParamsSet')
        .withArgs(BN.from(num), BN.from(den));
      const numInData = await data.lockNumerator();
      const denInData = await data.lockDenominator();
      expect(numInData).to.be.eq(BN.from(num));
      expect(denInData).to.be.eq(BN.from(den));
    });

    it('Should not be able to set invalid lock numerator and denominator', async () => {
      await expect(data.setLockParams(BN.from(17), BN.from(5))).to.be.revertedWith(errMsg.INVALID_LOCK_PARAMS);
      await expect(data.setLockParams(BN.from(0), BN.from(0))).to.be.revertedWith(errMsg.INVALID_LOCK_PARAMS);
    });

    it('Should be able to set expiry divisor', async () => {
      let divisor = 100;
      await expect(data.setExpiryDivisor(BN.from(divisor)))
        .to.emit(data, 'ExpiryDivisorSet')
        .withArgs(BN.from(divisor));
      const divisorInData = await data.expiryDivisor();
      expect(divisorInData).to.be.eq(BN.from(divisor));
    });

    it('Should not be able to set 0 as enpiry divisor', async () => {
      let divisor = 0;
      await expect(data.setExpiryDivisor(BN.from(divisor))).to.be.revertedWith(errMsg.INVALID_EXPIRY_DIVISOR);
    });

    it('Onlyforge modifier should revert transactions from non-forge', async () => {
      await expect(
        data
          .connect(alice)
          .storeTokens(
            consts.FORGE_AAVE_V2,
            fixture.a2Forge.a2OwnershipToken.address,
            fixture.a2Forge.a2FutureYieldToken.address,
            tokens.USDT.address,
            consts.T0_A2.add(consts.SIX_MONTH)
          )
      ).to.be.revertedWith(errMsg.ONLY_FORGE);
    });

    it('Should be able to add forge', async () => {
      const av2ForgeAddress = await data.getForgeAddress(consts.FORGE_AAVE_V2);
      expect(av2ForgeAddress.toLowerCase()).to.be.eq(fixture.a2Forge.aaveV2Forge.address.toLowerCase());
      const cForgeAddress = await data.getForgeAddress(consts.FORGE_COMPOUND);
      expect(cForgeAddress.toLowerCase()).to.be.eq(fixture.cForge.compoundForge.address.toLowerCase());
    });

    it('Should revert invalid forge addition', async () => {
      await expect(data.addForge(consts.ZERO_BYTES, consts.RANDOM_ADDRESS)).to.be.revertedWith(errMsg.ZERO_BYTES);
      await expect(data.addForge(consts.FORGE_COMPOUND, consts.ZERO_ADDRESS)).to.be.revertedWith(errMsg.ZERO_ADDRESS);
      await expect(data.addForge(consts.FORGE_COMPOUND, fixture.a2Forge.aaveV2Forge.address)).to.be.revertedWith(
        errMsg.INVALID_ID
      );
      await expect(data.addForge(consts.FORGE_AAVE_V2, fixture.a2Forge.aaveV2Forge.address)).to.be.revertedWith(
        errMsg.EXISTED_ID
      );
    });

    it('Should be able to set forge fee', async () => {
      await expect(data.setForgeFee(consts.RONE.div(10)))
        .to.emit(data, 'ForgeFeeSet')
        .withArgs(consts.RONE.div(10));
      const forgeFeeInData = await data.forgeFee();
      expect(forgeFeeInData).to.be.eq(consts.RONE.div(10));
    });

    it('Should revert setting forge fee above cap', async () => {
      await expect(data.setForgeFee(consts.RONE)).to.be.revertedWith(errMsg.FEE_EXCEED_LIMIT);
    });

    it('Should be able to return correct pendle yield tokens', async () => {
      const yieldTokens = await data.getPendleYieldTokens(
        consts.FORGE_AAVE_V2,
        tokens.USDT.address,
        consts.T0_A2.add(consts.SIX_MONTH)
      );
      const [ot, xyt] = yieldTokens;
      expect(ot.toLowerCase()).to.be.eq(fixture.a2Forge.a2OwnershipToken.address.toLowerCase());
      expect(xyt.toLowerCase()).to.be.eq(fixture.a2Forge.a2FutureYieldToken.address.toLowerCase());
    });

    it('Should be able to correctly determine validity of xyt', async () => {
      expect(await data.isValidXYT(consts.FORGE_AAVE_V2, tokens.UNI.address, consts.T0_A2.add(consts.SIX_MONTH))).to.be
        .true;
      expect(await data.isValidXYT(consts.FORGE_COMPOUND, tokens.USDT.address, consts.T0_C.add(consts.ONE_YEAR))).to.be
        .false;
    });

    it('Should be able to correctly determine validity of ot', async () => {
      expect(await data.isValidOT(consts.FORGE_COMPOUND, tokens.USDT.address, consts.T0_C.add(consts.SIX_MONTH))).to.be
        .true;
      expect(await data.isValidOT(consts.FORGE_AAVE_V2, tokens.USDC.address, consts.T0_C.add(consts.SIX_MONTH))).to.be
        .false;
    });

    it('Should be able to add market factory', async () => {
      const av2MarketFactoryaddress = await data.getMarketFactoryAddress(consts.MARKET_FACTORY_AAVE_V2);
      expect(av2MarketFactoryaddress.toLowerCase()).to.be.eq(fixture.core.a2MarketFactory.address.toLowerCase());
      const cMarketFactoryaddress = await data.getMarketFactoryAddress(consts.MARKET_FACTORY_COMPOUND);
      expect(cMarketFactoryaddress.toLowerCase()).to.be.eq(fixture.core.cMarketFactory.address.toLowerCase());
    });

    it('Should revert invalid market factory addition', async () => {
      await expect(data.addMarketFactory(consts.ZERO_BYTES, fixture.core.cMarketFactory.address)).to.be.revertedWith(
        errMsg.ZERO_BYTES
      );
      await expect(data.addMarketFactory(consts.RANDOM_BYTES, consts.ZERO_ADDRESS)).to.be.revertedWith(
        errMsg.ZERO_ADDRESS
      );
      await expect(data.addMarketFactory(consts.RANDOM_BYTES, fixture.core.a2MarketFactory.address)).to.be.revertedWith(
        errMsg.INVALID_FACTORY_ID
      );
      await expect(
        data.addMarketFactory(consts.MARKET_FACTORY_COMPOUND, fixture.core.cMarketFactory.address)
      ).to.be.revertedWith(errMsg.EXISTED_ID);
    });

    it('OnlyMarketFactory modifier should revert tansactions from non-marketFactory', async () => {
      await expect(
        data
          .connect(bob)
          .addMarket(
            consts.MARKET_FACTORY_AAVE_V2,
            fixture.a2Forge.a2FutureYieldToken.address,
            testToken.address,
            consts.RANDOM_ADDRESS
          )
      ).to.be.revertedWith(errMsg.ONLY_MARKET_FACTORY);
    });

    it('Should be able to add markets', async () => {
      const aMarketAddress = await data.getMarket(
        consts.MARKET_FACTORY_AAVE_V2,
        fixture.a2Forge.a2FutureYieldToken.address,
        testToken.address
      );
      expect(aMarketAddress.toLowerCase()).to.be.eq(fixture.a2Market.address.toLowerCase());
      const cMarketAddress = await data.getMarket(
        consts.MARKET_FACTORY_COMPOUND,
        fixture.cForge.cFutureYieldToken.address,
        testToken.address
      );
      expect(cMarketAddress.toLowerCase()).to.be.eq(fixture.cMarket.address.toLowerCase());
    });

    // it('Should not be able to add multiple market of same signature', async() => {
    //   await expect(fixture.core.a2MarketFactory.createMarket(fixture.a2Forge.a2FutureYieldToken.address, testToken.address)).to.be.revertedWith("MARKET_KEY_EXISTED");
    // })

    it('Should be able to set forge factory validity', async () => {
      await expect(data.setForgeFactoryValidity(consts.FORGE_AAVE_V2, consts.MARKET_FACTORY_AAVE_V2, true))
        .to.emit(data, 'ForgeFactoryValiditySet')
        .withArgs(consts.FORGE_AAVE_V2, consts.MARKET_FACTORY_AAVE_V2, true);
      expect(await data.validForgeFactoryPair(consts.FORGE_AAVE_V2, consts.MARKET_FACTORY_AAVE_V2)).to.be.true;
    });

    it('Should be able to set market fee', async () => {
      let swapFee = consts.RONE.div(BN.from(100));
      let protocolFee = consts.RONE.div(BN.from(2));
      await expect(data.setMarketFees(swapFee, protocolFee))
        .to.emit(data, 'MarketFeesSet')
        .withArgs(swapFee, protocolFee);
      const swapFeeInData = await data.swapFee();
      const protocolFeeInData = await data.protocolSwapFee();
      expect(swapFeeInData).to.be.eq(swapFee);
      expect(protocolFeeInData).to.be.eq(protocolFee);
    });

    it('Should not be able to set market fee above cap', async () => {
      const swapFeeLimit = consts.RONE.div(10);
      await expect(data.setMarketFees(swapFeeLimit.mul(2), consts.RONE)).to.be.revertedWith(errMsg.FEE_EXCEED_LIMIT);
      await expect(data.setMarketFees(consts.RONE.div(BN.from(100)), consts.RONE.mul(2))).to.be.revertedWith(
        errMsg.PROTOCOL_FEE_EXCEED_LIMIT
      );
    });

    it('Should be able to set curve shift block delta', async () => {
      await expect(data.setCurveShiftBlockDelta(BN.from(1)))
        .to.emit(data, 'CurveShiftBlockDeltaSet')
        .withArgs(BN.from(1));
      expect(await data.curveShiftBlockDelta()).to.be.eq(BN.from(1));
    });

    it('Should be able to get market by index', async () => {
      let allMarketsLength = await data.allMarketsLength();
      const marketAddress = await data.getMarketByIndex(allMarketsLength - 1);
      expect(marketAddress.toLowerCase()).to.be.not.eq(consts.ZERO_ADDRESS);
      await expect(data.getMarketByIndex(allMarketsLength)).to.be.revertedWith(errMsg.INVALID_INDEX);
    });

    it('Should be able to get market by tokens and factory', async () => {
      const marketAddress = await data.getMarketFromKey(
        fixture.a2Forge.a2FutureYieldToken.address,
        fixture.testToken.address,
        consts.MARKET_FACTORY_AAVE_V2
      );
      expect(marketAddress.toLowerCase()).to.be.eq(fixture.a2Market.address.toLowerCase());
      const marketAddressExpectZero = await data.getMarketFromKey(
        fixture.a2Forge.a2FutureYieldToken18.address,
        fixture.testToken.address,
        consts.MARKET_FACTORY_COMPOUND
      );
      expect(marketAddressExpectZero.toLowerCase()).to.be.eq(consts.ZERO_ADDRESS.toLowerCase());
    });
  });
}

describe('PendleData', function () {
  if (checkDisabled(Mode.GENERAL_TEST)) return;
  runTest(Mode.GENERAL_TEST);
});
