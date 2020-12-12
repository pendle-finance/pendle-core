'use strict';

const {expectRevert, time} = require('@openzeppelin/test-helpers');
const {BN} = require('@openzeppelin/test-helpers/src/setup');
const {expect, assert} = require('chai');
const BenchmarkMarket = artifacts.require('BenchmarkMarket');
const TestToken = artifacts.require('TestToken');

const {
  deployContracts,
  getAaveContracts,
  mintUSDT,
  mintAUSDT,
  constants
} = require('../helpers/Helpers');

require('chai').use(require('chai-as-promised')).use(require('chai-bn')(BN)).should();

contract('BenchmarkMarket', (accounts) => {
  let contracts;
  let aaveContracts;

  before(async () => {
    contracts = await deployContracts(accounts[0]);
    aaveContracts = await getAaveContracts();
    // await aaveContracts.aUSDT.approve(contracts.benchmarkAaveForge.address, constants.MAX_ALLOWANCE);
  });

  describe('bootstrap', async () => {
    it('should be able to bootstrap', async () => {
      console.log(`\tTestToken balance of accounts[0] = ${await contracts.testToken.balanceOf.call(accounts[0])}`);
      console.log(`\tXYT balance of accounts[0] = ${await contracts.benchmarkFutureYieldToken.balanceOf.call(accounts[0])}`);
      console.log(`\tallowance for TestToken = ${await contracts.testToken.allowance.call(accounts[0], contracts.benchmarkMarket.address)}`);

      await contracts.benchmarkMarket.bootstrap(
          10000000000,
          10000000000
      );

      const totalSupply = await contracts.benchmarkMarket.totalSupply.call();
      console.log(`\t\tTotal Supply of LP: ${totalSupply}`);
    });
  });
});
