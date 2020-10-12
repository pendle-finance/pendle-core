const LendingPoolCore = artifacts.require('LendingPoolCore');
const {getContracts} = require('./AaveHelper');

USDT_ADDRESS = '0xdac17f958d2ee523a2206206994597c13d831ec7';

contract('Aave', function (accounts) {
  describe('LendingPoolCore', async function () {
    it('Get reserve address', async function () {
      const contracts = await getContracts();
      console.log(`lendingPoolCore ${contracts.lendingPoolCore.address}`);

      const usdtReserve = await contracts.lendingPoolCore.getReserveATokenAddress(USDT_ADDRESS);
      console.log(`usdtReserve at ${usdtReserve}`);
    });
  });
});
