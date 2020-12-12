'use strict';

const {expectRevert, time} = require('@openzeppelin/test-helpers');
const {BN} = require('@openzeppelin/test-helpers/src/setup');

const TetherToken = artifacts.require('TestToken');
const TestUsdtTransferFrom = artifacts.require('TestUsdtTransferFrom');
const TestToken = artifacts.require('TestToken');

const {
  deployContracts,
  getAaveContracts,
  mintUSDT,
  mintAUSDT,
  constants,
  impersonateAccounts
} = require('../helpers/Helpers');

require('chai').use(require('chai-as-promised')).use(require('chai-bn')(BN)).should();

contract('USDT', (accounts) => {

  describe('transferFrom', async () => {
    it('for a random ERC20', async () => {
      const testUsdt = await TestUsdtTransferFrom.new();
      const testErc20 = await TestToken.new("test", "TEST", 18);

      await testErc20.approve(testUsdt.address, constants.MAX_ALLOWANCE);

      console.log(`approved, allowance = ${await testErc20.allowance.call(accounts[0], testUsdt.address)}`);
      await testUsdt.testTransferFrom(testErc20.address, 1000000);

      console.log(`Balance of test contract = ${await testErc20.balanceOf.call(testUsdt.address)}`);
    });
    it('for USDT', async () => {
      await impersonateAccounts();
      const testUsdt = await TestUsdtTransferFrom.new();

      const usdt = await TetherToken.at(constants.USDT_ADDRESS);
      await mintUSDT(accounts[0], 10000);
      const bal = await usdt.balanceOf.call(accounts[0]);
      console.log(`usdt bal = ${bal}`);

      await usdt.approve(testUsdt.address, constants.MAX_ALLOWANCE);

      console.log(`approved, allowance = ${await usdt.allowance.call(accounts[0], testUsdt.address)}`);
      await testUsdt.testTransferFrom(constants.USDT_ADDRESS, 1000000);

      console.log(`USDT balance of test contract = ${await usdt.balanceOf.call(testUsdt.address)}`);
    });
  });
});
