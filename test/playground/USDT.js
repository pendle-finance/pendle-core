'use strict';

const {expectRevert, time} = require('@openzeppelin/test-helpers');
const {BN} = require('@openzeppelin/test-helpers/src/setup');

const TetherToken = artifacts.require('Token');

const {
  deployContracts,
  getAaveContracts,
  mintUSDT,
  mintAUSDT,
  constants
} = require('../helpers/Helpers');

require('chai').use(require('chai-as-promised')).use(require('chai-bn')(BN)).should();

contract('USDT', (accounts) => {

  describe('transferFrom', async () => {
    it('should be able to transferFrom', async () => {

      const usdt = await TetherToken.at(constants.USDT_ADDRESS);
      await mintUSDT(accounts[0], 10000);

      console.log(`usdt address = ${usdt.address}`);
      const bal = await usdt.balanceOf.call(accounts[0]);
      console.log(`usdt bal = ${bal}`);
      await usdt.approve(accounts[1], bal);
      console.log(`approved, allowance = ${await usdt.allowance.call(accounts[0], accounts[1])}`);
      await usdt.transferFrom(accounts[0], accounts[1], 10000000, { from: accounts[1] });

      console.log(`USDT balance of accounts[1] = ${await usdt.balanceOf.call(accounts[1])}`);

      // // console.log(contracts.benchmarkMarket.address);
      // // console.log(contracts.benchmarkMarket);
      //
      // console.log(`USDT balance of accounts[0] = ${await usdt.balanceOf.call(accounts[0])}`);
      // console.log(`allowance = ${await usdt.allowance.call(accounts[0], contracts.benchmarkMarket.address)}`)
      // console.log(`token in benchmarkMarket = ${await contracts.benchmarkMarket.token.call()}`);
      // await contracts.benchmarkMarket.bootstrap(
      //     1000000,
      //     1000000
      // );
      // console.log(`temp = ${await contracts.benchmarkMarket.temp.call()}`);
      //
      // const totalSupply = await contracts.benchmarkMarket.totalSupply.call();
      // console.log(`\t\tTotal Supply of LP: ${totalSupply}`);
    });
  });
});
