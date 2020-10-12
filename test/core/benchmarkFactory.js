const {constants, expectRevert, time} = require('@openzeppelin/test-helpers');
const {BN} = require('@openzeppelin/test-helpers/src/setup');
const {expect, assert} = require('chai');
var RLP = require('rlp');
const AddressesProvider = artifacts.require('AddressesProvider');
const BenchmarkFactory = artifacts.require('BenchmarkFactory');
const BenchmarkForge = artifacts.require('BenchmarkForge');
// const MockAToken = artifacts.require('aUSDT');
const TestToken = artifacts.require('Token');
const Helpers = require('../helpers');
require('chai').use(require('chai-as-promised')).use(require('chai-bn')(BN)).should();

contract('BenchmarkFactory', ([governance]) => {
  before('Initialize the Factory and test tokens', async () => {
    this.addressesProvider = await AddressesProvider.new(governance, {from: governance});
    this.factory = await BenchmarkFactory.new(governance, this.addressesProvider.address, {from: governance});
    this.token = await TestToken.new('Token', 'TST', '18', {from: governance});
  });

  describe('# Forge Creation', async () => {
    it('should create an aUSDT Forge', async () => {
      const computedForgeAddress = Helpers.getCreate2Address(
        this.factory.address,
        web3.utils.sha3(this.token.address),
        BenchmarkForge._json.bytecode,
        '',
        ''
      );

      const forge = await this.factory.createForge(this.token.address);

      assert.equal(forge.logs[0].args.forge.toLowerCase(), computedForgeAddress);
    });
  });
});
