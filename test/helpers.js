const BN = web3.utils.BN;
const AddressesProvider = artifacts.require('AddressesProvider');
const Benchmark = artifacts.require('Benchmark');
const BenchmarkFactory = artifacts.require('BenchmarkFactory');
const BenchmarkForge = artifacts.require('BenchmarkForge');
const BenchmarkOwnershipToken = artifacts.require('BenchmarkOwnershipToken');
const BenchmarkFutureYieldToken = artifacts.require('BenchmarkFutureYieldToken');

const constants = {
  DUMMY_GOVERNANCE_ADDRESS: '0xdac17f958d2ee523a2206206994597c13d831ec7',
  USDT_ADDRESS: '0xdac17f958d2ee523a2206206994597c13d831ec7',
  AAVE_LENDING_POOL_CORE_ADDRESS: '0x3dfd23A6c5E8BbcFc9581d2E864a68feb6a076d3',
  DURATION_ONEMONTH: 0,
  DURATION_THREEMONTHS: 1,
  DURATION_SIXMONTHS: 2,
  MAX_ALLOWANCE: new BN(2).pow(new BN(256)).sub(new BN(1)),
  TEST_EXPIRY: 1606780800, // 1st Dec 2020, 0:00 UTC
};

async function deployContracts() {
  const contracts = {};

  contracts.addressesProvider = await AddressesProvider.new(constants.DUMMY_GOVERNANCE_ADDRESS);
  await contracts.addressesProvider.setAddresses(constants.AAVE_LENDING_POOL_CORE_ADDRESS);
  console.log(`\t\tDeployed and setup AddressesProvider contract at ${contracts.addressesProvider.address}`);

  contracts.benchmark = await Benchmark.new(constants.DUMMY_GOVERNANCE_ADDRESS);
  console.log(`\t\tDeployed Benchmark contract at ${contracts.benchmark.address}`);

  contracts.benchmarkFactory = await BenchmarkFactory.new(
    constants.DUMMY_GOVERNANCE_ADDRESS,
    contracts.addressesProvider.address
  );
  console.log(`\t\tDeployed BenchmarkFactory contract at ${contracts.benchmarkFactory.address}`);

  await contracts.benchmarkFactory.createForge(constants.USDT_ADDRESS);
  const forgeAddress = await contracts.benchmarkFactory.getForge.call(constants.USDT_ADDRESS);
  console.log(`\t\tDeployed USDT forge contract at ${forgeAddress}`);
  contracts.benchmarkForge = await BenchmarkForge.at(forgeAddress);

  await contracts.benchmarkForge.generateNewContracts(constants.DURATION_THREEMONTHS, constants.TEST_EXPIRY);
  const otTokenAddress = await contracts.benchmarkForge.otTokens.call(
    constants.DURATION_THREEMONTHS,
    constants.TEST_EXPIRY
  );
  const xytTokenAddress = await contracts.benchmarkForge.xytTokens.call(
    constants.DURATION_THREEMONTHS,
    constants.TEST_EXPIRY
  );
  contracts.benchmarkOwnershipToken = await BenchmarkOwnershipToken.at(otTokenAddress);
  contracts.benchmarkFutureYieldToken = await BenchmarkFutureYieldToken.at(xytTokenAddress);
  console.log(`\t\tDeployed OT contract at ${otTokenAddress} and XYT contract at ${xytTokenAddress}`);

  return contracts;
}

function getCreate2Address(factory, salt, contractBytecode, constructorTypes, constructorArgs) {
  const bytecode = `${contractBytecode}${web3.eth.abi.encodeParameter(constructorTypes, constructorArgs).slice(2)}`;
  const address = `0x${web3.utils
    .sha3(`0x${['ff', factory, salt, web3.utils.sha3(bytecode)].map((x) => x.replace(/0x/, '')).join('')}`)
    .slice(-40)}`;

  return web3.utils.toChecksumAddress(address);
}

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

module.exports = {
  deployContracts,
  getCreate2Address,
  getCurrentBlock,
  getCurrentBlockTime,
  mineBlocks,
  mineBlockAtTime,
};
