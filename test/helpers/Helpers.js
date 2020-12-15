const BN = web3.utils.BN;
const {time} = require('@openzeppelin/test-helpers');

const Benchmark = artifacts.require('Benchmark');
const BenchmarkMarketFactory = artifacts.require('BenchmarkMarketFactory');
const BenchmarkMarket = artifacts.require('BenchmarkMarket');
const BenchmarkAaveForge = artifacts.require('BenchmarkAaveForge');
// const ForgeCreator = artifacts.require('ForgeCreator');
const BenchmarkData = artifacts.require('BenchmarkData');
const BenchmarkTreasury = artifacts.require('BenchmarkTreasury');
const BenchmarkOwnershipToken = artifacts.require('BenchmarkOwnershipToken');
const BenchmarkFutureYieldToken = artifacts.require('BenchmarkFutureYieldToken');
const TetherToken = artifacts.require('IUSDT');
const TestToken = artifacts.require('TestToken');

const {constants} = require('./Constants');

const {getAaveContracts, mintUSDT, mintAUSDT, printAaveAddressDetails} = require('./AaveHelpers');
const {getTokenAmount} = require('./Math');

const hre = require('hardhat');

async function deployTestBenchmarkTokens(contracts, constantsObject = constants) {
  console.log('\t\tDeploying test Benchmark Tokens');
  contracts.benchmarkAaveForge = await BenchmarkAaveForge.new(
    contracts.benchmark.address,
    constantsObject.AAVE_LENDING_POOL_CORE_ADDRESS,
    constantsObject.FORGE_AAVE
  );
  console.log(`\t\tDeployed USDT forge contract at ${contracts.benchmarkAaveForge.address}`);

  await contracts.benchmark.addForge(constantsObject.FORGE_AAVE, contracts.benchmarkAaveForge.address);
  console.log(`\t\tAdded Aave protocol to Benchmark`);

  await contracts.benchmarkAaveForge.newYieldContracts(constantsObject.USDT_ADDRESS, constantsObject.TEST_EXPIRY);

  const otTokenAddress = await contracts.benchmarkData.otTokens.call(
    constantsObject.FORGE_AAVE,
    constantsObject.USDT_ADDRESS,
    constantsObject.TEST_EXPIRY
  );
  const xytTokenAddress = await contracts.benchmarkData.xytTokens.call(
    constantsObject.FORGE_AAVE,
    constantsObject.USDT_ADDRESS,
    constantsObject.TEST_EXPIRY
  );
  console.log(`\t\tDeployed OT contract at ${otTokenAddress} and XYT contract at ${xytTokenAddress}`);
  // console.log(`otTokenAddress = ${otTokenAddress}, xytTokenAddress = ${xytTokenAddress}`);
  contracts.benchmarkOwnershipToken = await BenchmarkOwnershipToken.at(otTokenAddress);
  contracts.benchmarkFutureYieldToken = await BenchmarkFutureYieldToken.at(xytTokenAddress);

  return contracts;
}

async function deployTestMarketContracts(contracts, constantsObject = constants) {
  console.log('\t\tDeploying test Benchmark Market');
  contracts.testToken = await TestToken.new('Test Token', 'TEST', 6);

  await contracts.benchmarkMarketFactory.createMarket(
    constantsObject.FORGE_AAVE,
    contracts.benchmarkFutureYieldToken.address,
    contracts.testToken.address,
    constantsObject.TEST_EXPIRY
  );

  const benchmarkMarketAddress = await contracts.benchmarkData.getMarket.call(
    constantsObject.FORGE_AAVE,
    contracts.benchmarkFutureYieldToken.address,
    contracts.testToken.address
  );

  contracts.benchmarkMarket = await BenchmarkMarket.at(benchmarkMarketAddress);
  console.log(`\t\tDeployed BenchmarkMarket at ${benchmarkMarketAddress}`);

  await contracts.testToken.approve(benchmarkMarketAddress, constantsObject.MAX_ALLOWANCE);
  await contracts.benchmarkFutureYieldToken.approve(benchmarkMarketAddress, constantsObject.MAX_ALLOWANCE);
  // let's mint a lot of aUSDT to accounts[0]
  const aaveContracts = await getAaveContracts();

  const accounts = await web3.eth.getAccounts();
  await mintAUSDT(accounts[0], 100000);
  await aaveContracts.aUSDT.approve(contracts.benchmarkAaveForge.address, constantsObject.MAX_ALLOWANCE);
  await contracts.benchmark.tokenizeYield(
    constantsObject.FORGE_AAVE,
    constantsObject.USDT_ADDRESS,
    constantsObject.TEST_EXPIRY,
    50000 * 1000000,
    accounts[0]
  );
  console.log(`\tMinted 100000*1e6 AUSDT to accounts[0]; deposited 50000*1e6 of them into AaveForge`);
}

// governanceAddress should be an unlocked address
async function deployCoreContracts(governanceAddress, constantsObject = constants) {
  console.log('\tDeploying core contracts');
  const contracts = {};

  contracts.benchmark = await Benchmark.new(governanceAddress, constantsObject.WETH_ADDRESS);
  console.log(`\t\tDeployed Benchmark contract at ${contracts.benchmark.address}`);

  contracts.benchmarkTreasury = await BenchmarkTreasury.new(governanceAddress);

  contracts.benchmarkMarketFactory = await BenchmarkMarketFactory.new(governanceAddress);
  console.log(`\t\tDeployed BenchmarkMarketFactory contract at ${contracts.benchmarkMarketFactory.address}`);
  // contracts.forgeCreator = await ForgeCreator.new(contracts.benchmarkMarketFactory.address);
  // console.log(`\t\tDeployed ForgeCreator contract at ${contracts.forgeCreator.address}`);
  contracts.benchmarkData = await BenchmarkData.new(governanceAddress);
  console.log(`\t\tDeployed BenchmarkData contract at ${contracts.benchmarkData.address}`);

  await contracts.benchmarkMarketFactory.initialize(contracts.benchmark.address);
  console.log(`\t\tInitialized BenchmarkMarketFactory`);
  await contracts.benchmarkData.initialize(contracts.benchmark.address);
  console.log(`\t\tInitialized BenchmarkData`);

  await contracts.benchmark.initialize(
    contracts.benchmarkData.address,
    contracts.benchmarkMarketFactory.address,
    contracts.benchmarkTreasury.address
  );

  console.log('\t\tInitialised Benchmark');

  return contracts;
}

async function impersonateAccounts() {
  if (hre.network.name == 'hardhat') {
    console.log('impersonating');
    await hre.network.provider.request({
      method: 'hardhat_impersonateAccount',
      params: [constants.USDT_OWNER_ADDRESS],
    });
  }
}

async function deployContracts(governance, kovan = false) {
  await impersonateAccounts();

  if (kovan) {
    // TODO: use kovan addresses
  }
  const contracts = await deployCoreContracts(governance);
  await deployTestMarketContracts(await deployTestBenchmarkTokens(contracts));
  return contracts;
}

function getCreate2Address(factory, salt, contractBytecode, constructorTypes, constructorArgs) {
  const bytecode = `${contractBytecode}${web3.eth.abi.encodeParameters(constructorTypes, constructorArgs).slice(2)}`;
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

async function printBenchmarkAddressDetails(contracts, address) {
  const aaveContracts = await getAaveContracts();
  console.log(`\tBenchmark balances for address ${address}:`);
  console.log(
    `\t\tOT balance = ${(await contracts.benchmarkOwnershipToken.balanceOf.call(address)).div(new BN(1000000))}`
  );
  console.log(
    `\t\tXYT balance = ${(await contracts.benchmarkFutureYieldToken.balanceOf.call(address)).div(new BN(1000000))}`
  );
  console.log(
    `\t\tlastNormalisedIncome = ${await contracts.benchmarkAaveForge.lastNormalisedIncome.call(
      constants.TEST_EXPIRY,
      address
    )}`
  );
  console.log(`\t\taUSDT balance = ${(await aaveContracts.aUSDT.balanceOf.call(address)) / 1000000}`);
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

async function sendDummyTransactions(accounts, count) {
  if (count == 0) return;
  await web3.eth.sendTransaction({from: accounts[0], to: accounts[0], value: 1});
  await sendDummyTransactions(accounts, count - 1);
}

module.exports = {
  getTokenAmount,
  constants,

  getAaveContracts,
  mintUSDT,
  mintAUSDT,
  printAaveAddressDetails,
  impersonateAccounts,

  sendDummyTransactions,
  deployCoreContracts,
  deployContracts,
  deployTestBenchmarkTokens,
  deployTestMarketContracts,
  getCreate2Address,
  getCurrentBlock,
  getCurrentBlockTime,
  mineBlocks,
  mineBlockAtTime,
  printBenchmarkAddressDetails,
};