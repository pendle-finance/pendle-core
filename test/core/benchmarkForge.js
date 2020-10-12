const {constants, expectRevert, time} = require('@openzeppelin/test-helpers');
const {BN} = require('@openzeppelin/test-helpers/src/setup');
const {expect, assert} = require('chai');
var RLP = require('rlp');
const BenchmarkForge = artifacts.require('BenchmarkForge');
const BenchmarkProvider = artifacts.require('BenchmarkProvider');
// const MockAToken = artifacts.require('aUSDT');
const TestToken = artifacts.require('Token');
const Helpers = require('../helpers');
require('chai').use(require('chai-as-promised')).use(require('chai-bn')(BN)).should();

contract('BenchmarkForge', ([governance]) => {
  before('Initialize the Forge and test tokens', async () => {
  });

  describe('# Constants', async () => {
    it('should', async () => {
    });
  });
});
