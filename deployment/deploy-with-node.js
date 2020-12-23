/**
 * @dev Deploy core contracts to local dev blockchain such as ganache-cli
 * 
 * Step 1: run ganache
   ganache-cli --fork https://mainnet.infura.io/v3/<insert your infura ID> --accounts 10 --defaultBalanceEther 1000 --gasPrice 20000000000 --gasLimit 12400000 --networkId 5777 --debug --unlock <eth address > accounts you want to impersonate>

   Step 2: 
   node deployment/deploy-with-node.js
 */
const ethers = require("ethers")
const Web3 = require("web3")

const { BenchmarkArtifact, BenchmarkTreasuryArtifact, BenchmarkAaveForgeArtifact, BenchmarkMarketFactoryArtifact, BenchmarkDataArtifact, TestTokenArtifact, BenchmarkFutureYieldTokenArtifact, BenchmarkOwnershipTokenArtifact, IAaveLendingPoolCoreArtifact, IAaveLendingPoolArtifact, IATokenArtifact, IUSDTArtifact } = require("./exports")

const WETH9 = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
const AAVE = '0x3dfd23A6c5E8BbcFc9581d2E864a68feb6a076d3';
const AUSDT_OWNER_ADDRESS = '0x21e12F11702B65EF0F6666114a2155B838bCD952';

const USDT = '0xdac17f958d2ee523a2206206994597c13d831ec7';
const USDT_OWNER_ADDRESS = '0x1062a747393198f70f71ec65a582423dba7e5ab3';

const AAVE_LENDING_POOL_CORE_ADDRESS = '0x3dfd23A6c5E8BbcFc9581d2E864a68feb6a076d3';
const AAVE_LENDING_POOL_ADDRESS = '0x398ec7346dcd622edc5ae82352f02be94c62d119';

const FORGE_AAVE = ethers.utils.formatBytes32String('Aave');
const TEST_EXPIRY = 1619827200; // 1st May 2021, 0:00 UTC

function printInfo(tx) {
  console.log(`   > tx hash:\t${tx.hash}`);
  console.log(`   > gas price:\t${tx.gasPrice.toString()}`);
  console.log(`   > gas used:\t${tx.gasLimit.toString()}`);
}

function deployCoreContracts({ signer, governanceAddress }) {
  return new Promise(async (resolve, reject) => {

    console.log('Deploying Protocol Contracts');
    console.log('============================\n');

    // Benchmark.sol

    console.log("   1. Deploying 'Benchmark'");
    console.log('   -----------------------');

    const Benchmark = new ethers.ContractFactory(BenchmarkArtifact.abi, BenchmarkArtifact.bytecode, signer)
    const benchmark = await Benchmark.deploy(governanceAddress, WETH9);
    tx = await benchmark.deployed();
    printInfo(tx.deployTransaction);
    console.log(`   > address:\t${benchmark.address}\n\n`);

    // BenchmarkTreasury.sol
    console.log("   2. Deploying 'BenchmarkTreasury'");
    console.log('   -------------------------------');

    const BenchmarkTreasury = new ethers.ContractFactory(BenchmarkTreasuryArtifact.abi, BenchmarkTreasuryArtifact.bytecode, signer)
    const benchmarkTreasury = await BenchmarkTreasury.deploy(governanceAddress);
    tx = await benchmarkTreasury.deployed();
    printInfo(tx.deployTransaction);
    console.log(`   > address:\t${benchmarkTreasury.address}\n\n`);

    // BenchmarkAaveForge.sol

    console.log("   3. Deploying 'BenchmarkAaveForge'");
    console.log('   ------------------------------------');

    const BenchmarkAaveForge = new ethers.ContractFactory(BenchmarkAaveForgeArtifact.abi, BenchmarkAaveForgeArtifact.bytecode, signer)
    const benchmarkAaveForge = await BenchmarkAaveForge.deploy(benchmark.address, AAVE, FORGE_AAVE);
    tx = await benchmarkAaveForge.deployed();
    printInfo(tx.deployTransaction);
    console.log(`   > address:\t${benchmarkAaveForge.address}\n\n`);

    // BenchmarkMarketFactory.sol

    console.log("   4. Deploying 'BenchmarkMarketFactory'");
    console.log('   ------------------------------------');

    const BenchmarkMarketFactory = new ethers.ContractFactory(BenchmarkMarketFactoryArtifact.abi, BenchmarkMarketFactoryArtifact.bytecode, signer)
    const benchmarkMarketFactory = await BenchmarkMarketFactory.deploy(governanceAddress);
    tx = await benchmarkMarketFactory.deployed();
    printInfo(tx.deployTransaction);
    console.log(`   > address:\t${benchmarkMarketFactory.address}\n\n`);

    // BenchmarkData.sol

    console.log("   5. Deploying 'BenchmarkData'");
    console.log('   ------------------------------------');

    const BenchmarkData = new ethers.ContractFactory(BenchmarkDataArtifact.abi, BenchmarkDataArtifact.bytecode, signer)
    const benchmarkData = await BenchmarkData.deploy(governanceAddress);
    tx = await benchmarkData.deployed();
    printInfo(tx.deployTransaction);
    console.log(`   > address:\t${benchmarkData.address}\n\n`);

    const markets = await benchmarkData.getAllMarkets()

    console.log('markets', markets)
    console.log('benchmarkData.address', benchmarkData.address)

    resolve({
      benchmark,
      benchmarkTreasury,
      benchmarkAaveForge,
      benchmarkMarketFactory,
      benchmarkData,
    })
  })
}

function initializeCoreContracts({ contracts, governanceAddress }) {
  return new Promise(async (resolve) => {
    const {
      benchmark,
      benchmarkTreasury,
      benchmarkAaveForge,
      benchmarkMarketFactory,
      benchmarkData,
    } = contracts

    console.log('Initializing Contracts');
    console.log('======================\n');

    console.log("   6. Initializing 'Benchmark'");
    console.log('   --------------------------');
    tx = await benchmark.initialize(benchmarkData.address, benchmarkMarketFactory.address, benchmarkTreasury.address);
    printInfo(tx);
    console.log('\n');

    console.log("   7. Initializing 'BenchmarkMarketFactory'");
    console.log('   --------------------------');
    tx = await benchmarkMarketFactory.initialize(benchmark.address, { gasLimit: 50000 });
    printInfo(tx);
    console.log('\n');

    console.log("   8. Initializing 'BenchmarkData'");
    console.log('   --------------------------');
    tx = await benchmarkData.initialize(benchmark.address, { gasLimit: 50000 });
    printInfo(tx);
    console.log('\n');

    // Add Forge

    console.log('Add Aave Forge to Network');
    console.log('==========================\n');

    console.log("   9. Adding 'BenchmarkAaveForge'");
    console.log('   -----------------------------');
    tx = await benchmark.addForge(FORGE_AAVE, benchmarkAaveForge.address);
    printInfo(tx);
    console.log('\n');

    resolve(true)
  })
}

function initializeTestMarkets({ contracts, signer }) {
  return new Promise(async (resolve, reject) => {
    const {
      benchmark,
      benchmarkTreasury,
      benchmarkAaveForge,
      benchmarkMarketFactory,
      benchmarkData,
    } = contracts

    console.log('   1. Creating Test Token');
    console.log('   -----------------------------');
    const TestToken = new ethers.ContractFactory(TestTokenArtifact.abi, TestTokenArtifact.bytecode, signer)
    const testToken = await TestToken.deploy('Test Token', 'TEST', 6);
    tx = await testToken.deployed();
    printInfo(tx.deployTransaction);
    console.log(`   > address:\t${testToken.address}\n\n`);
    console.log('\n');

    console.log('   2. Creating new newYieldContract');
    console.log('   -----------------------------');

    await benchmarkAaveForge.newYieldContracts(USDT, TEST_EXPIRY);

    const BenchmarkFutureYieldToken = new ethers.ContractFactory(BenchmarkFutureYieldTokenArtifact.abi, BenchmarkFutureYieldTokenArtifact.bytecode, signer)
    const benchmarkFutureYieldToken = await BenchmarkFutureYieldToken.attach(
      await benchmarkData.xytTokens(FORGE_AAVE, USDT, TEST_EXPIRY)
    );
    console.log('   benchmarkFutureYieldToken.address', benchmarkFutureYieldToken.address);

    const BenchmarkOwnershipToken = new ethers.ContractFactory(BenchmarkOwnershipTokenArtifact.abi, BenchmarkOwnershipTokenArtifact.bytecode, signer)
    const benchmarkOTToken = await BenchmarkOwnershipToken.attach(
      await benchmarkData.otTokens(FORGE_AAVE, USDT, TEST_EXPIRY)
    );
    console.log('   benchmarkOTToken.address', benchmarkOTToken.address);

    tx = await benchmarkMarketFactory.createMarket(
      FORGE_AAVE,
      benchmarkFutureYieldToken.address,
      testToken.address,
      TEST_EXPIRY
    );
    const benchmarkMarketAddress = await benchmarkData.getMarket(
      FORGE_AAVE,
      benchmarkFutureYieldToken.address,
      testToken.address
    );
    console.log(` Market Created: ${benchmarkMarketAddress}`);

    resolve(true)
  })
}

function getAaveContracts({ provider }) {
  return new Promise(async (resolve) => {
    console.log('Getting Aave Contracts');
    console.log('======================\n');
    const lendingPoolCore = new ethers.Contract(AAVE_LENDING_POOL_CORE_ADDRESS, IAaveLendingPoolCoreArtifact.abi, provider)
    const lendingPool = new ethers.Contract(AAVE_LENDING_POOL_ADDRESS, IAaveLendingPoolArtifact.abi, provider)
    const aUSDTAddress = await lendingPoolCore.getReserveATokenAddress(USDT);
    const aUSDT = new ethers.Contract(aUSDTAddress, IATokenArtifact.abi, provider)

    resolve({
      lendingPoolCore,
      lendingPool,
      aUSDTAddress,
      aUSDT,
    });
  })
}

function mintAUSDT({ receiver, amount, aaveContracts, usdtOwner_Signer, provider, web3 }) {
  return new Promise(async (resolve) => {
    console.log('Minting aUSDT Contracts');
    console.log('======================\n');
    // await ethers.getContractAt('IUSDT', USDT);
    const aUSDTToken = new web3.eth.Contract(IATokenArtifact.abi, aaveContracts.aUSDTAddress)

    // new ethers.Contract(USDT, IUSDTArtifact.abi, provider)
    // const MAX_ALLOWANCE = ethers.BigNumber.from(2).pow(ethers.BigNumber.from(128));

    console.log('Owner Balance: ', await aUSDTToken.methods.balanceOf(AUSDT_OWNER_ADDRESS).call())
    console.log('Receiver Balance: ', await aUSDTToken.methods.balanceOf(receiver).call())

    await aUSDTToken.methods.transfer(receiver, amount).send({ from: AUSDT_OWNER_ADDRESS, gas: 900000 })

    console.log('Owner Balance: ', await aUSDTToken.methods.balanceOf(AUSDT_OWNER_ADDRESS).call())
    console.log('Receiver Balance: ', await aUSDTToken.methods.balanceOf(receiver).call())

    console.log(`\tMinted ${amount.toString()} aUSDT to ${receiver}`);

  })
}
async function main() {

  const provider = new ethers.providers.JsonRpcProvider('http://localhost:8545')
  const web3 = new Web3('http://localhost:8545')
  const signer = provider.getSigner()
  console.log('signer', signer)

  const governanceAddress = await signer.getAddress()
  console.log('governanceAddress', governanceAddress);
  const coreContracts = await deployCoreContracts({ signer, governanceAddress })
  console.log('\n\t========= Core Contracts Deployed =========\n\n')
  await initializeCoreContracts({ contracts: coreContracts })
  console.log('\n\t========= Core Contracts Initialized =========\n\n')
  await initializeTestMarkets({ contracts: coreContracts, signer })
  console.log('\n\t========= Test Markets Initialized =========\n\n')
  const aaveContracts = await getAaveContracts({ provider })
  console.log('\n\t========= Fetched Aave Contracts =========\n\n')
  await mintAUSDT({
    receiver: governanceAddress,
    amount: ethers.BigNumber.from(1000),
    aaveContracts,
    // usdtOwner_Signer,
    provider,
    web3
  });

  console.log('benchmarkData.getAllMarkets()', await coreContracts.benchmarkData.getAllMarkets())

}

main()
