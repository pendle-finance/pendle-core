const {expectRevert, time} = require('@openzeppelin/test-helpers');
const {BN} = require('@openzeppelin/test-helpers/src/setup');
const {expect, assert} = require('chai');

var RLP = require('rlp');


const BenchmarkAaveForge = artifacts.require('BenchmarkAaveForge');

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

contract('BenchmarkAaveForge', (accounts) => {
  let contracts;
  let aaveContracts;

  const emptyAUSDT = async (account) => {
    console.log(`\tEmptying AUSDT from [user account] - ${account}`);
    const balance = await aaveContracts.aUSDT.balanceOf.call(account);
    if (balance.toNumber() === 0) return;
    await aaveContracts.aUSDT.transfer(accounts[8], balance, {from: account});
    console.log(`\tEmptied AUSDT from ${account}`);
  };

  before(async () => {
    contracts = await deployContracts(accounts[0]);
    aaveContracts = await getAaveContracts();
    await aaveContracts.aUSDT.approve(contracts.benchmarkAaveForge.address, constants.MAX_ALLOWANCE);
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
      await contracts.benchmarkAaveForge.tokenizeYield(

        constants.TEST_EXPIRY,
        testAmount,
        accounts[1]
      );

      console.log('\n\tAfter tokenizing 1000 AUSDT via Benchmark:');
      await printBenchmarkAddressDetails(contracts, accounts[1]);
    });
  });

  describe('redeemUnderlying', async () => {
    it('[After 1 month] should be able to redeem aUSDT to get back OT, XYT and interests $', async () => {
      const testAmount = 1000 * 1000000; // 1000 USDT

      console.log('\tBefore [user account]');
      await printBenchmarkAddressDetails(contracts, accounts[1]);

      console.log('\tBefore [BenchmarkAaveForge]');
      await printBenchmarkAddressDetails(contracts, contracts.benchmarkAaveForge.address);

      const oneMonth = 3600 * 24 * 30;
      await time.increase(oneMonth);

      console.log('\tOne month has passed ...');
      console.log('\tUser account has called redeemUnderlying()');

      const aUSDTbalanceBefore = await aaveContracts.aUSDT.balanceOf.call(accounts[1]);
      await contracts.benchmarkAaveForge.redeemUnderlying(

        constants.TEST_EXPIRY,
        testAmount,
        accounts[1],
        {from: accounts[1]}
      );
      const aUSDTbalanceAfter = await aaveContracts.aUSDT.balanceOf.call(accounts[1]);

      console.log('\n\tAfter 1 month [user account]');
      await printBenchmarkAddressDetails(contracts, accounts[1]);
      console.log('\tAfter 1 month [BenchmarkAaveForge]');
      await printBenchmarkAddressDetails(contracts, contracts.benchmarkAaveForge.address);

      const interests = aUSDTbalanceAfter - aUSDTbalanceBefore - testAmount;
      console.log(`\n\tInterest amount = ${interests/1000000}, or ${(interests / testAmount) * 100} %`);
    });
  });

  describe('redeemDueInterests', async () => {
    it('After one month, should be able to ping to get due interests', async () => {
      const testAmount = 1000 * 1000000; // 1000 USDT
      await contracts.benchmarkAaveForge.tokenizeYield(

        constants.TEST_EXPIRY,
        testAmount,
        accounts[1]
      );

      const balance = await contracts.benchmarkOwnershipToken.balanceOf.call(accounts[1]);
      await contracts.benchmarkOwnershipToken.transfer(accounts[8], balance, {from: accounts[1]});

      console.log('\tBefore one month [user account]');
      await printBenchmarkAddressDetails(contracts, accounts[1]);
      console.log('\tBefore one month [BenchmarkAaveForge]');
      await printBenchmarkAddressDetails(contracts, contracts.benchmarkAaveForge.address);
      const lastNormalisedIncomeBeforeExpiry = await contracts.benchmarkAaveForge.lastNormalisedIncomeBeforeExpiry.call(constants.TEST_EXPIRY);

      console.log(`\tLastNormalisedIncomeBeforeExpiry = ${lastNormalisedIncomeBeforeExpiry}`);

      const aUSDTbalanceBefore = await aaveContracts.aUSDT.balanceOf.call(accounts[1]);

      const oneMonth = 3600 * 24 * 30;
      await time.increase(oneMonth);

      console.log('\t1 month has passed ...');
      console.log('\tUser account has called redeemDueInterests()');

      await contracts.benchmarkAaveForge.redeemDueInterests( constants.TEST_EXPIRY, {
        from: accounts[1],
      });

      const aUSDTbalanceAfter = await aaveContracts.aUSDT.balanceOf.call(accounts[1]);
      console.log('\n\tAfter redeeming:');
      await printBenchmarkAddressDetails(contracts, accounts[1]);

      const interests = aUSDTbalanceAfter - aUSDTbalanceBefore;
      console.log(`\n\tInterest amount = ${interests/1000000}, or ${(interests / testAmount) * 100} %`);
    });
  });

  describe('redeemAfterExpiry', async () => {
    it('After expiry, should be able to redeem aUSDT from OT', async () => {
      // lets use accounts[2] now
      const testAmount = 1000 * 1000000; // 1000 USDT
      await contracts.benchmarkAaveForge.tokenizeYield(

        constants.TEST_EXPIRY,
        testAmount,
        accounts[2]
      );
      await contracts.benchmarkFutureYieldToken.transfer(accounts[8], testAmount, {from: accounts[2]});
      console.log('\tTransfered out all XYT tokens away from User account');

      const twoYears = 3600 * 24 * 30 * 24;
      await time.increase(twoYears);

      console.log('\t2 years have passed ... Its already past the expiry');

      console.log('\tBefore calling redeemAfterExpiry():');
      await printBenchmarkAddressDetails(contracts, accounts[2]);
      const aUSDTbalanceBefore = await aaveContracts.aUSDT.balanceOf.call(accounts[2]);

      await contracts.benchmarkAaveForge.redeemAfterExpiry(
        constants.TEST_EXPIRY,
        accounts[2],
        {from: accounts[2]}
      );

      const aUSDTbalanceAfter = await aaveContracts.aUSDT.balanceOf.call(accounts[2]);
      console.log('\n\tAfter User account has called redeemAfterExpiry():');
      await printBenchmarkAddressDetails(contracts, accounts[2]);
      // expect(aUSDTbalanceBefore.add(new BN(testAmount))).to.eql(aUSDTbalanceAfter);
    });
  });
});
