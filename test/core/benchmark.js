// const Benchmark = artifacts.require("Benchmark");

const {deployContracts} = require('../helpers');

contract('Benchmark', function (accounts) {
  describe('Test Benchmark protocol deployment', async function () {
    it('Contracts can deploy', async function () {
      const contracts = await deployContracts();
      console.log('\tFinished deploying');
      // console.log("\tContracts object:");
      // console.log(contracts);
    });
  });
});
