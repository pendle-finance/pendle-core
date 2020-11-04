// const Benchmark = artifacts.require("Benchmark");

const { deployContracts } = require('../helpers/Helpers');

contract('Benchmark', function (accounts) {
  describe('Test Benchmark protocol deployment', async function () {
    it('Contracts can deploy', async function () {
      this.timeout(100000);
      console.log(`Root account = ${accounts[0]}`);
      const contracts = await deployContracts(accounts[0]);
      console.log('\tFinished deploying');
    });
  });

  describe('# Initialization and Constants', async () => {
    //TODO
    // before('create the factory', async () => {
    // });
    //
    // it('should set the new treasury address', async () => {
    //   await this.factory.setTreasury(stub, {from: governance});
    //
    //   const factoryTreasury = await this.factory.treasury();
    //   expect(factoryTreasury).to.eq(stub);
    // });
    //
    // it('should revert if non-governance address sets the new treasury', async () => {
    //   await expectRevert(this.factory.setTreasury(stub, {from: stub}), 'Benchmark: only governance');
    // });
  });
});
