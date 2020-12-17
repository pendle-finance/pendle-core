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
  printBenchmarkAddressDetails,
  constants
} = require('../helpers/Helpers');

require('chai').use(require('chai-as-promised')).use(require('chai-bn')(BN)).should();

const printAmmDetails = async(amm) => {
  const xyt = await TestToken.at(await amm.xyt.call());
  const ausdt = await TestToken.at(constants.AUSDT_ADDRESS);
  const token = await TestToken.at(await amm.token.call());
  console.log(`\tPrinting details for amm for xyt ${xyt.address} and token ${token.address}`);
  console.log(`\t\tXyt bal = ${await xyt.balanceOf.call(amm.address)}`);
  console.log(`\t\tToken bal = ${await token.balanceOf.call(amm.address)}`);
  console.log(`\t\taUSDT bal = ${await ausdt.balanceOf.call(amm.address)}`);
  const totalLp = await amm.totalSupply.call();
  console.log(`\t\tTotal Supply of LP: ${totalLp}`);
}

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
      console.log("Before bootstrap:");
      await printAmmDetails(contracts.benchmarkMarket);

      await contracts.benchmarkMarket.bootstrap(
          1e10,
          1e10
      );

      console.log("After bootstrap:");
      await printAmmDetails(contracts.benchmarkMarket);
    });
  });
  describe('joinPoolByAll', async () => {
    it('should be able to join a bootstrapped pool', async () => {
      console.log("Before joinPoolByAll:");
      await printAmmDetails(contracts.benchmarkMarket);

      await contracts.benchmarkMarket.joinPoolByAll(
        '500000000000000000', // 5e17, half of current LP pool
        '1000000000000',
        '1000000000000'
      );

      console.log("After joinPoolByAll:");
      await printAmmDetails(contracts.benchmarkMarket);
    });
  });
  describe('swapAmountOut', async () => {
    it('should be able to swap amount out', async () => {
      console.log("Before swapAmountOut:");
      await printAmmDetails(contracts.benchmarkMarket);

      // swap out 10% of the pool, 15e8 xyts

      await contracts.benchmarkMarket.swapAmountOut(
        contracts.testToken.address, //inToken
        constants.MAX_ALLOWANCE,
        contracts.benchmarkFutureYieldToken.address, // outToken
        '1500000000', //outAmount, 15e8, 10% of pool
        constants.MAX_ALLOWANCE, //maxPrice
      );

      console.log("After swapAmountOut: (swapped 15e8, 10% of xyt out)");
      await printAmmDetails(contracts.benchmarkMarket);
    });
  });
  describe('exitPoolByAll', async () => {
    it('should be able to exit a pool', async () => {
      console.log("Before exitPoolByAll:");
      await printAmmDetails(contracts.benchmarkMarket);

      const oneMonth = 3600*24*30;
      await time.increase(oneMonth);
      console.log("one month has passed");

      console.log("Before exitPoolByAll");
      await printBenchmarkAddressDetails(contracts, accounts[0]);

      await contracts.benchmarkMarket.exitPoolByAll(
        '500000000000000000', // 5e17, 1/3 of current LP pool
        '1000000000', //small number
        '1000000000'  //small number
      );

      console.log("After exitPoolByAll: (exited 5e17, 1/3 of current pool)");
      await printAmmDetails(contracts.benchmarkMarket);
      await printBenchmarkAddressDetails(contracts, accounts[0]);
    });
  });
});
