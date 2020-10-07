const {constants, expectRevert, time} = require('@openzeppelin/test-helpers');
const {BN} = require('@openzeppelin/test-helpers/src/setup');
const {expect, assert} = require('chai');
var RLP = require('rlp');
const BenchmarkFactory = artifacts.require('BenchmarkFactory');
// const MockAToken = artifacts.require('aUSDT');
const TestToken = artifacts.require('Token');
require('chai').use(require('chai-as-promised')).use(require('chai-bn')(BN)).should();

function getCurrentBlock() {
  return new Promise(function (fulfill, reject) {
    web3.eth.getBlockNumber(function (err, result) {
      if (err) reject(err);
      else fulfill(result);
    });
  });
}

function getCurrentBlockTime() {
  return new Promise(function (fulfill, reject) {
    web3.eth.getBlock('latest', false, function (err, result) {
      if (err) reject(err);
      else fulfill(result.timestamp);
    });
  });
}

async function mineBlocks(blocks) {
  for (let i = 0; i < blocks; i++) {
    await time.advanceBlock();
  }
}

function mineBlockAtTime(timestamp) {
  return new Promise((resolve, reject) => {
    web3.currentProvider.send.bind(web3.currentProvider)(
      {
        jsonrpc: '2.0',
        method: 'evm_mine',
        params: [timestamp],
        id: new Date().getTime(),
      },
      (err, res) => {
        if (err) {
          return reject(err);
        }
        resolve(res);
      }
    );
  });
}

contract('BenchmarkFactory', ([governance]) => {
  before('Initialize the Factory and test tokens', async () => {
    this.factory = await BenchmarkFactory.new(governance, {from: governance});
    this.token = await TestToken.new('Token', 'TST', '18', {from: governance});
  });

  describe('# Forge Creation', async () => {
    it('should create an aUSDT Forge', async () => {
      let forgeAddress = await this.factory.createForge(this.token.address);
    });
  });
});
