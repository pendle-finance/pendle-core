const {expectRevert, time} = require('@openzeppelin/test-helpers');
const {BN} = require('@openzeppelin/test-helpers/src/setup');
const {expect, assert} = require('chai');
var RLP = require('rlp');

const BenchmarkForge = artifacts.require('BenchmarkForge');
const BenchmarkProvider = artifacts.require('BenchmarkProvider');

// const MockAToken = artifacts.require('aUSDT');
const TestToken = artifacts.require('Token');
const {
  deployContracts,
  getAaveContracts,
  mintUSDT,
  mintAUSDT,
  constants,
  getTokenAmount,
  getCurrentBlockTime,
  mineBlockAtTime,
  printAaveAddressDetails,
  printBenchmarkAddressDetails,
  sendDummyTransactions,
  mineBlocks,
} = require('../helpers/Helpers');

require('chai').use(require('chai-as-promised')).use(require('chai-bn')(BN)).should();



contract('BenchmarkForge', (accounts) => {
  let contracts;
  let aaveContracts;

  const emptyAUSDT = async (account) => {
    const balance = await aaveContracts.aUSDT.balanceOf.call(account);
    if (balance.toNumber() == 0) return;
    await aaveContracts.aUSDT.transfer(accounts[8], balance, { from: account });
  }

  before('Initialize the Forge and test tokens', async () => {
    contracts = await deployContracts(accounts[0]);
    aaveContracts = await getAaveContracts();
    await aaveContracts.aUSDT.approve(contracts.benchmarkForge.address, constants.MAX_ALLOWANCE);
    // give accounts[0] 10000 AUSDT
    await mintAUSDT(accounts[0], 10000);
  });

  beforeEach(async () => {
    await emptyAUSDT(accounts[1]);
  });

  describe('tokenizeYield', async () => {
    it('should be able to deposit aUSDT to get back OT and XYT', async () => {
      // Using accounts[0] (with lots of aUSDT), to mint to accounts[1]
      console.log('\tBefore:');
      await printBenchmarkAddressDetails(contracts, accounts[1]);
      const testAmount = 1000 * 1000000; // 1000 USDT
      await contracts.benchmarkForge.tokenizeYield(
        constants.DURATION_ONEYEAR,
        constants.TEST_EXPIRY,
        testAmount,
        accounts[1]
      );

      console.log('\n\tAfter:');
      await printBenchmarkAddressDetails(contracts, accounts[1]);
    });
  });

  describe('redeemUnderlying', async () => {
    it('[After 1 month] should be able to redeem aUSDT to get back OT, XYT and interests $', async () => {
      const testAmount = 1000 * 1000000; // 1000 USDT

      console.log('\tBefore:');
      await printBenchmarkAddressDetails(contracts, accounts[1]);

      console.log('\tBefore [BenchmarkForge]');
      await printBenchmarkAddressDetails(contracts, contracts.benchmarkForge.address);

      const oneMonth = 3600 * 24 * 30;
      await time.increase(oneMonth);

      console.log('\tOne month has passed ...');

      const aUSDTbalanceBefore = await aaveContracts.aUSDT.balanceOf.call(accounts[1]);
      await contracts.benchmarkForge.redeemUnderlying(
        constants.DURATION_ONEYEAR,
        constants.TEST_EXPIRY,
        testAmount,
        accounts[1],
        {from: accounts[1]}
      );
      const aUSDTbalanceAfter = await aaveContracts.aUSDT.balanceOf.call(accounts[1]);

      console.log('\n\tAfter:');
      await printBenchmarkAddressDetails(contracts, accounts[1]);
      console.log('\tAfter [BenchmarkForge]');
      await printBenchmarkAddressDetails(contracts, contracts.benchmarkForge.address);

      const interests = aUSDTbalanceAfter - aUSDTbalanceBefore - testAmount;
      console.log(`\n\tInterest amount = ${interests}, or ${(interests / testAmount) * 100} %`);
    });
  });



  describe('redeemDueInterests', async () => {
    it('After one month, should be able to ping to get due interests', async () => {
      const testAmount = 1000 * 1000000; // 1000 USDT
      await contracts.benchmarkForge.tokenizeYield(
        constants.DURATION_ONEYEAR,
        constants.TEST_EXPIRY,
        testAmount,
        accounts[1]
      );

      console.log('\tBefore one month:');
      await printBenchmarkAddressDetails(contracts, accounts[1]);
      console.log('\tBefore [BenchmarkForge]');
      await printBenchmarkAddressDetails(contracts, contracts.benchmarkForge.address);

      console.log('\tLastNormalisedIncomeBeforeExpiry = ', await contracts.benchmarkForge.lastNormalisedIncomeBeforeExpiry.call(constants.TEST_EXPIRY));

      const aUSDTbalanceBefore = await aaveContracts.aUSDT.balanceOf.call(accounts[1]);

      const oneMonth = 3600 * 24 * 30;
      await time.increase(oneMonth);

      console.log('\t1 month has passed ...');

      await contracts.benchmarkForge.redeemDueInterests(
        constants.DURATION_ONEYEAR,
        constants.TEST_EXPIRY,
        { from: accounts[1] }
      );

      const aUSDTbalanceAfter = await aaveContracts.aUSDT.balanceOf.call(accounts[1]);
      console.log('\n\tAfter redeeming:');
      await printBenchmarkAddressDetails(contracts, accounts[1]);

      const interests = aUSDTbalanceAfter - aUSDTbalanceBefore;
      console.log(`\n\tInterest amount = ${interests}, or ${(interests / testAmount) * 100} %`);
    });
  });

  describe('redeemAfterExpiry', async () => {
    it('After expiry, should be able to redeem aUSDT from OT', async () => {
      const testAmount = 1000 * 1000000; // 1000 USDT
      await contracts.benchmarkForge.tokenizeYield(
        constants.DURATION_ONEYEAR,
        constants.TEST_EXPIRY,
        testAmount,
        accounts[1]
      );
      await contracts.benchmarkFutureYieldToken.transfer(accounts[2], testAmount, { from: accounts[1] });
      console.log('\tTransfered out all XYT tokens away');


      const twoYears = 3600 * 24 * 30 * 24;
      await time.increase(twoYears);

      console.log('\t2 years have passed ... Its already past the expiry');

      console.log('\tBefore redeeming:');
      await printBenchmarkAddressDetails(contracts, accounts[1]);
      const aUSDTbalanceBefore = await aaveContracts.aUSDT.balanceOf.call(accounts[1]);

      await contracts.benchmarkForge.redeemAfterExpiry(
        constants.DURATION_ONEYEAR,
        constants.TEST_EXPIRY,
        accounts[1],
        { from: accounts[1] }
      );

      const aUSDTbalanceAfter = await aaveContracts.aUSDT.balanceOf.call(accounts[1]);
      console.log('\n\tAfter redeeming:');
      await printBenchmarkAddressDetails(contracts, accounts[1]);
      // expect(aUSDTbalanceBefore.add(new BN(testAmount))).to.eql(aUSDTbalanceAfter);
    });
  });
});
