const {constants, expectRevert, time} = require('@openzeppelin/test-helpers');
const {BN} = require('@openzeppelin/test-helpers/src/setup');
const {expect, assert} = require('chai');
var RLP = require('rlp');
const BenchmarkFactory = artifacts.require('BenchmarkFactory');
const BenchmarkForge = artifacts.require('BenchmarkForge');
const BenchmarkProvider = artifacts.require('BenchmarkProvider');
// const MockAToken = artifacts.require('aUSDT');
const TestToken = artifacts.require('Token');
const Helpers = require('../helpers');
require('chai').use(require('chai-as-promised')).use(require('chai-bn')(BN)).should();

contract('BenchmarkFactory', ([governance]) => {
  before('Initialize the Factory and test tokens', async () => {
    this.provider = await BenchmarkProvider.new(governance, {from: governance});
    this.factory = await BenchmarkFactory.new(governance, this.provider.address, {from: governance});
    // TODO: use actual aUSDT
    this.token = await TestToken.new('Token', 'TST', '18', {from: governance});
  });

  describe('# Constants', async () => {
    it('should get the constants from contract creation', async () => {
      const factoryGovernance = await this.factory.governance();
      assert.equal(factoryGovernance, governance);

      const factoryProvider = await this.factory.provider();
      assert.equal(factoryProvider, this.provider.address);
    });
  });

  describe('# Forge Creation', async () => {
    const allForges = [];
    const getForge = {};

    it('should create an aUSDT Forge', async () => {
      const computedForgeAddress = Helpers.getCreate2Address(
        this.factory.address,
        web3.utils.sha3(this.token.address),
        BenchmarkForge._json.bytecode,
        '',
        ''
      );
      let forge = await this.factory.createForge(this.token.address);
      forge = forge.logs[0].args.forge;
      allForges.push(forge);
      getForge[this.token.address] = forge;

      assert.equal(forge, computedForgeAddress);
    });

    it('should get forge address given an underlying token', async () => {
      const forgeAddress = await this.factory.getForge(this.token.address);
      assert.equal(forgeAddress, getForge[this.token.address]);
    });

    it('should get all forges', async () => {
      const factoryAllForges = await this.factory.getAllForges();
      const factoryAllForgesLength = await this.factory.allForgesLength();

      assert.equal(factoryAllForgesLength, allForges.length);
      expect(factoryAllForges).to.deep.equal(allForges);
    });
  });
});
