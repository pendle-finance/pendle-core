const LendingPoolCore = artifacts.require('LendingPoolCore');
const {
  getAaveContracts,
  mintUSDT,
  mintAUSDT,
  constants,
  getTokenAmount,
  getCurrentBlockTime,
  mineBlockAtTime,
  printAaveAddressDetails,
} = require('../helpers/Helpers');

contract('Aave', function (accounts) {
  describe('LendingPoolCore', async function () {
    it('Get reserve address', async function () {
      const contracts = await getAaveContracts();
      console.log(`lendingPoolCore ${contracts.lendingPoolCore.address}`);

      const usdtReserve = await contracts.lendingPoolCore.getReserveATokenAddress(constants.USDT_ADDRESS);
      console.log(`usdtReserve at ${usdtReserve}`);
    });
  });

  describe('aUSDT', async function () {
    it('Mint USDT and aUSDT', async function () {
      await mintUSDT(accounts[0], 10000);
      await mintAUSDT(accounts[0], 10000);
    });

    it('deposit aUSDT in one month', async function () {
      await mintAUSDT(accounts[0], 10000);
      console.log('\n\tBefore:');
      await printAaveAddressDetails(accounts[0]);

      const currentTime = await getCurrentBlockTime();
      const oneMonthFromNow = currentTime + 3600 * 24 * 30;
      await mineBlockAtTime(oneMonthFromNow);
      const timeAfterOneMonth = await getCurrentBlockTime();

      const aaveContracts = await getAaveContracts();
      console.log('\n\tAfter one month:');
      await printAaveAddressDetails(accounts[0]);
    });
  });
});
