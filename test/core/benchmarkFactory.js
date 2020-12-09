'use strict';
// deprecated

const {constants, expectRevert, time} = require('@openzeppelin/test-helpers');
const web3 = require('@openzeppelin/test-helpers/src/config/web3');
const {BN} = require('@openzeppelin/test-helpers/src/setup');
const {expect, assert} = require('chai');
var RLP = require('rlp');
const Benchmark = artifacts.require('Benchmark');
const BenchmarkFactory = artifacts.require('BenchmarkFactory');
// const BenchmarkForge = artifacts.require('BenchmarkForge');
const BenchmarkTreasury = artifacts.require('BenchmarkTreasury');
// const MockAToken = artifacts.require('aUSDT');
const TestToken = artifacts.require('Token');
const Helpers = require('../helpers/Helpers');
require('chai').use(require('chai-as-promised')).use(require('chai-bn')(BN)).should();

contract('BenchmarkFactory', ([deployer, governance, stub]) => {
  describe('# Initialization and Constants', async () => {
    // before('create the factory', async () => {
    //   this.benchmark = await Benchmark.new(governance, {from: deployer});
    //   this.treasury = await BenchmarkTreasury.new(governance, {from: deployer});
    //   this.factory = await BenchmarkFactory.new(governance, this.treasury.address, {
    //     from: deployer,
    //   });
    // });
    //
    // it('should initialize the factory', async () => {
    //   await this.factory.initialize(this.benchmark.address, {from: deployer});
    //
    //   const factoryCore = await this.factory.core();
    //   expect(factoryCore).to.eq(this.benchmark.address);
    // });
    //
    // it('should get the constants from contract creation', async () => {
    //   const factoryGovernance = await this.factory.governance();
    //   expect(factoryGovernance).to.eq(governance);
    // });
  });

  // describe('# Forge Creation', async () => {
  //   const allForges = [];
  //   const getForge = {};
  //
  //   before('create the factory and tokens', async () => {
  //     this.benchmark = await Benchmark.new(governance, {from: deployer});
  //     this.provider = await BenchmarkProvider.new(governance, {from: deployer});
  //     this.treasury = await BenchmarkTreasury.new(governance, {from: deployer});
  //     this.factory = await BenchmarkFactory.new(governance, this.treasury.address, this.provider.address, {
  //       from: deployer,
  //     });
  //     this.token = await TestToken.new('Token', 'TST', '18', {from: deployer});
  //     console.log(this.token.address)
  //   });
  //
  //   it('should create an aUSDT Forge', async () => {
  //     // Initialize
  //     await this.factory.initialize(this.benchmark.address, {from: deployer});
  //
  //     const computedForgeAddress = Helpers.getCreate2Address(
  //       this.factory.address,
  //       web3.utils.sha3(this.token.address),
  //       BenchmarkForge._json.bytecode,
  //       ['address', 'address', 'address'],
  //       [this.token.address, this.treasury.address, this.provider.address]
  //     );
  //
  //     let forge = await this.factory.createForge(this.token.address);
  //     forge = forge.logs[0].args.forge;
  //
  //     allForges.push(forge);
  //     getForge[this.token.address] = forge;
  //
  //     expect(forge).to.eq(computedForgeAddress);
  //   });
  //
  //   it('should get forge address given an underlying token', async () => {
  //     const forgeAddress = await this.factory.getForge(this.token.address);
  //     expect(forgeAddress).to.eq(getForge[this.token.address]);
  //   });
  //
  //   it('should get all forges', async () => {
  //     const factoryAllForges = await this.factory.getAllForges();
  //     expect(factoryAllForges).to.deep.equal(allForges);
  //   });
  // });

  // describe('# Forge Reverts', async () => {
  //   before('create the factory', async () => {
  //     this.benchmark = await Benchmark.new(governance, {from: deployer});
  //     this.provider = await BenchmarkProvider.new(governance, {from: deployer});
  //     this.treasury = await BenchmarkTreasury.new(governance, {from: deployer});
  //     this.factory = await BenchmarkFactory.new(governance, this.treasury.address, this.provider.address, {
  //       from: deployer,
  //     });
  //     this.token = await TestToken.new('Token', 'TST', '18', {from: deployer});
  //   });
  //
  //   it('should revert for initialize() if initializer was not the deployer address', async () => {
  //     await expectRevert(this.factory.initialize(this.benchmark.address, {from: stub}), 'Benchmark: forbidden');
  //   });
  //
  //   it('should revert for initialize() if Benchmark core address param is zero address', async () => {
  //     await expectRevert(this.factory.initialize(constants.ZERO_ADDRESS, {from: deployer}), 'Benchmark: zero address');
  //   });
  //
  //   it('should revert for createForge() if factory is not initialized', async () => {
  //     await expectRevert(this.factory.createForge(this.token.address), 'Benchmark: not initialized');
  //   });
  //
  //   it('should revert for createForge() if underlying yield token is zero address', async () => {
  //     await this.factory.initialize(this.benchmark.address, {from: deployer});
  //     await expectRevert(this.factory.createForge(constants.ZERO_ADDRESS), 'Benchmark: zero address');
  //   });
  //
  //   it('should revert for createForge() if the forge for underlying yield token already exists', async () => {
  //     await this.factory.createForge(this.token.address);
  //     await expectRevert(this.factory.createForge(this.token.address), 'Benchmark: forge exists');
  //   });
  // });

  // describe('# Market Creation', async () => {});

  // describe('# Market Reverts', async () => {});
});
