require('@nomiclabs/hardhat-ethers');

const AAVE = '0x3dfd23A6c5E8BbcFc9581d2E864a68feb6a076d3';
const WETH9 = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
const USDT = '0xdac17f958d2ee523a2206206994597c13d831ec7';

function printInfo(tx) {
  console.log(`   > tx hash:\t${tx.hash}`);
  console.log(`   > gas price:\t${tx.gasPrice.toString()}`);
  console.log(`   > gas used:\t${tx.gasLimit.toString()}`);
}

task('deploy', 'Deploys the core contracts').setAction(async () => {
  const [deployer, governance] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  const governanceAddress = await governance.getAddress();
  let tx;

  console.log('Deploying Protocol Contracts');
  console.log('============================\n');

  // Benchmark.sol

  console.log("   1. Deploying 'Benchmark'");
  console.log('   -----------------------');

  const Benchmark = await ethers.getContractFactory('Benchmark');
  const benchmark = await Benchmark.deploy(governanceAddress, WETH9);
  tx = await benchmark.deployed();
  printInfo(tx.deployTransaction);
  console.log(`   > address:\t${benchmark.address}\n\n`);

  // BenchmarkTreasury.sol

  console.log("   2. Deploying 'BenchmarkTreasury'");
  console.log('   -------------------------------');

  const BenchmarkTreasury = await ethers.getContractFactory('BenchmarkTreasury');
  const benchmarkTreasury = await BenchmarkTreasury.deploy(governanceAddress);
  tx = await benchmarkTreasury.deployed();
  printInfo(tx.deployTransaction);
  console.log(`   > address:\t${benchmarkTreasury.address}\n\n`);

  // BenchmarkAaveForge.sol

  console.log("   3. Deploying 'BenchmarkAaveForge'");
  console.log('   ------------------------------------');

  const BenchmarkAaveForge = await ethers.getContractFactory('BenchmarkAaveForge');
  const benchmarkAaveForge = await BenchmarkAaveForge.deploy(
    benchmark.address,
    AAVE,
    ethers.utils.formatBytes32String('Aave')
  );
  tx = await benchmarkAaveForge.deployed();
  printInfo(tx.deployTransaction);
  console.log(`   > address:\t${benchmarkAaveForge.address}\n\n`);

  // BenchmarkMarketFactory.sol

  console.log("   4. Deploying 'BenchmarkMarketFactory'");
  console.log('   ------------------------------------');

  const BenchmarkMarketFactory = await ethers.getContractFactory('BenchmarkMarketFactory');
  const benchmarkMarketFactory = await BenchmarkMarketFactory.deploy(governanceAddress);
  tx = await benchmarkMarketFactory.deployed();
  printInfo(tx.deployTransaction);
  console.log(`   > address:\t${benchmarkMarketFactory.address}\n\n`);

  // BenchmarkData.sol

  console.log("   5. Deploying 'BenchmarkData'");
  console.log('   ------------------------------------');

  const BenchmarkData = await ethers.getContractFactory('BenchmarkData');
  const benchmarkData = await BenchmarkData.deploy(governanceAddress);
  tx = await benchmarkData.deployed();
  printInfo(tx.deployTransaction);
  console.log(`   > address:\t${benchmarkData.address}\n\n`);

  // Initialization

  console.log('Initializing Contracts');
  console.log('======================\n');

  console.log("   6. Initializing 'Benchmark'");
  console.log('   --------------------------');
  tx = await benchmark.initialize(benchmarkData.address, benchmarkMarketFactory.address, benchmarkTreasury.address, {
    gasLimit: 50000,
  });
  printInfo(tx);
  console.log('\n');

  console.log("   7. Initializing 'BenchmarkMarketFactory'");
  console.log('   --------------------------');
  tx = await benchmarkMarketFactory.initialize(benchmark.address, {gasLimit: 50000});
  printInfo(tx);
  console.log('\n');

  console.log("   8. Initializing 'BenchmarkData'");
  console.log('   --------------------------');
  tx = await benchmarkData.initialize(benchmark.address, {gasLimit: 50000});
  printInfo(tx);
  console.log('\n');

  // Add Forge

  console.log('Add Aave Forge to Network');
  console.log('==========================\n');

  console.log("   9. Adding 'BenchmarkAaveForge'");
  console.log('   -----------------------------');
  tx = await benchmark
    .connect(governance)
    .addForge(ethers.utils.formatBytes32String('Aave'), benchmarkAaveForge.address, {
      gasLimit: 50000,
    });
  printInfo(tx);
  console.log('\n');

  // Summary

  console.log('Summary');
  console.log('=======\n');
  console.log(`   > Benchmark:\t\t\t${benchmark.address}`);
  console.log(`   > BenchmarkTreasury:\t\t${benchmarkTreasury.address}`);
  console.log(`   > BenchmarkAaveForge:\t\t${benchmarkAaveForge.address}`);
  console.log(`   > BenchmarkMarketFactory:\t${benchmarkMarketFactory.address}`);
  console.log(`   > BenchmarkData:\t\t${benchmarkData.address}`);

  console.log('\nDeployment complete!');
});
