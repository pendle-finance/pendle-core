require('@nomiclabs/hardhat-ethers');

const AAVE = '0x3dfd23A6c5E8BbcFc9581d2E864a68feb6a076d3';
const WETH9 = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
const USDT = '0xdac17f958d2ee523a2206206994597c13d831ec7';
const ADDRESSES = {};

async function deploy(step, ethers, contract, ...args) {
  console.log(`   ${parseInt(step) + 1}. Deploying '${contract}'`);
  console.log('   ------------------------------------');

  const Contract = await ethers.getContractFactory(contract);
  const instance = await Contract.deploy(...args);
  tx = await instance.deployed();
  printInfo(tx.deployTransaction);
  console.log(`   > address:\t${instance.address}\n\n`);

  ADDRESSES[contract] = instance.address;
}

async function initialize(step, ethers, contract, ...args) {
  console.log(`   ${parseInt(step) + 1}. Initializing '${contract}'`);
  console.log('   ------------------------------------');
  const instance = await ethers.getContractAt(contract, ADDRESSES[contract]);
  tx = await instance.initialize(...args, {
    gasLimit: 50000,
  });
  printInfo(tx);
  console.log('\n');
}

function printInfo(tx) {
  console.log(`   > tx hash:\t${tx.hash}`);
  console.log(`   > gas price:\t${tx.gasPrice.toString()}`);
  console.log(`   > gas used:\t${tx.gasLimit.toString()}`);
}

task('deploy_', 'Deploys the core contracts').setAction(async () => {
  const FORGE_AAVE = ethers.utils.formatBytes32String('Aave');
  const [deployer, governance] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  const governanceAddress = await governance.getAddress();
  const deployContracts = [
    'Benchmark',
    'BenchmarkTreasury',
    'BenchmarkAaveForge',
    'BenchmarkMarketFactory',
    'BenchmarkData',
  ];
  const initContracts = ['Benchmark', 'BenchmarkMarketFactory', 'BenchmarkData'];
  const instances = {};
  let args;
  let step = 0;
  let tx;

  // Deployment

  console.log('Deploying Protocol Contracts');
  console.log('============================\n');

  args = [
    [governanceAddress, WETH9],
    [governanceAddress],
    [null, AAVE, FORGE_AAVE],
    [governanceAddress],
    [governanceAddress],
  ];
  for (let index in deployContracts) {
    if (deployContracts[index] === 'BenchmarkAaveForge') args[index][0] = ADDRESSES['Benchmark'];
    instances[deployContracts[index]] = await deploy(step, ethers, deployContracts[index], ...args[index]);
    step++;
  }

  // Initialization

  console.log('Initializing Contracts');
  console.log('======================\n');

  args = [
    [ADDRESSES.BenchmarkData, ADDRESSES.BenchmarkMarketFactory, ADDRESSES.BenchmarkTreasury],
    [ADDRESSES.Benchmark],
    [ADDRESSES.Benchmark],
  ];
  for (let index in initContracts) {
    instances[initContracts[index]] = await initialize(step, ethers, initContracts[index], ...args[index]);
    step++;
  }

  // Add Forge

  console.log('Add Aave Forge to Network');
  console.log('==========================\n');

  console.log(`   ${++step}. Adding 'BenchmarkAaveForge'`);
  console.log('   -----------------------------');
  const instance = await ethers.getContractAt('Benchmark', ADDRESSES.Benchmark);
  tx = await instance.connect(governance).addForge(FORGE_AAVE, ADDRESSES.BenchmarkAaveForge, {
    gasLimit: 50000,
  });
  printInfo(tx);
  console.log('\n');

  // Summary

  console.log('Summary');
  console.log('=======\n');
  for (let contract of deployContracts) {
    console.log(`   > ${contract}: ${ADDRESSES[contract]}`);
  }

  console.log('\nDeployment complete!');
});
