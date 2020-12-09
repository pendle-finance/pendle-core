'use strict';

const {expectRevert, time} = require('@openzeppelin/test-helpers');
const {BN} = require('@openzeppelin/test-helpers/src/setup');
const {expect, assert} = require('chai');
const BenchmarkMarket = artifacts.require('BenchmarkMarket');


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
    await aaveContracts.aUSDT.approve(contracts.benchmarkAaveForge.address, constants.MAX_ALLOWANCE);
    // give accounts[0] 100000 AUSDT
    await mintAUSDT(accounts[0], 100000);
  });

  describe('joinPoolByAll', async () => {
    it('should be able to join pool', async () => {
      // console.log(contracts.benchmarkMarket.address);
      await contracts.benchmarkMarket.bootstrap(
          1000000,
          1000000
      );

      const totalSupply = await contracts.benchmarkMarket.totalSupply.call();
      console.log(`\t\tTotal Supply of LP: ${totalSupply}`);
    });
  });
});
