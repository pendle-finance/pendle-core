require('@nomiclabs/hardhat-ethers');

const AAVE = '0x3dfd23A6c5E8BbcFc9581d2E864a68feb6a076d3';
const WETH9 = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
const USDT = '0xdac17f958d2ee523a2206206994597c13d831ec7';
const USDT_OWNER_ADDRESS = '0xC6CDE7C39eB2f0F0095F41570af89eFC2C1Ea828';
const AAVE_LENDING_POOL_CORE_ADDRESS = '0x3dfd23A6c5E8BbcFc9581d2E864a68feb6a076d3';
const AAVE_LENDING_POOL_ADDRESS = '0x398ec7346dcd622edc5ae82352f02be94c62d119';
const TEST_EXPIRY = 1619827200; // 1st May 2021, 0:00 UTC

function printInfo(tx) {
  console.log(`   > tx hash:\t${tx.hash}`);
  console.log(`   > gas price:\t${tx.gasPrice.toString()}`);
  console.log(`   > gas used:\t${tx.gasLimit.toString()}`);
}

function getTokenAmount(tokenSymbol, amount) {
  const multipliers = {
    USDT: ethers.BigNumber.from(1000000),
  };

  // console.log(`multiplier = ${multipliers[tokenSymbol]}, amount = ${amount}`);
  return multipliers[tokenSymbol].mul(ethers.BigNumber.from(amount));
}

task('deploy', 'Deploys the core contracts')
  .addParam('account', "The account's address")
  .setAction(async (taskArgs) => {
    const FORGE_AAVE = ethers.utils.formatBytes32String('Aave');
    const MAX_ALLOWANCE = ethers.BigNumber.from(2).pow(ethers.BigNumber.from(128));
    const usdtOwner_Signer = await ethers.provider.getSigner(USDT_OWNER_ADDRESS);

    const account = taskArgs.account;
    console.log('account', account);

    // console.log('getSigners', await ethers.getSigners());
    async function getAaveContracts() {
      const LendingPoolCore = await ethers.getContractAt('IAaveLendingPoolCore');
      const LendingPool = await ethers.getContractAt('IAaveLendingPool');
      const AToken = await ethers.getContractAt('IAToken').catch(() => {});

      const lendingPoolCore = await LendingPoolCore.attach(AAVE_LENDING_POOL_CORE_ADDRESS);
      const lendingPool = await LendingPool.attach(AAVE_LENDING_POOL_ADDRESS);
      const aUSDTAddress = await lendingPoolCore.getReserveATokenAddress(USDT);
      const aUSDT = await AToken.attach(aUSDTAddress);
      return {
        lendingPoolCore,
        lendingPool,
        aUSDT,
      };
    }

    async function mintAUSDT(receiver, amount, aaveContracts) {
      const TetherToken = await ethers.getContractAt('IUSDT');
      const usdt = await TetherToken.attach(USDT, usdtOwner_Signer);

      console.log('impersonating USDT_OWNER_ADDRESS:', USDT_OWNER_ADDRESS);
      // Let's use USDT_OWNER_ADDRESS as the address to deposit USDT to Aave to get aUSDT
      const lendingPoolCoreAllowance = await usdt.allowance(USDT_OWNER_ADDRESS, AAVE_LENDING_POOL_CORE_ADDRESS);
      console.log(`\t\tAllowance for aave lending pool = ${lendingPoolCoreAllowance}`);
      if (lendingPoolCoreAllowance < 1) {
        await usdt.approve(AAVE_LENDING_POOL_CORE_ADDRESS, MAX_ALLOWANCE.toString());
      }

      const tokenAmount = getTokenAmount('USDT', amount);
      console.log('tokenAmount', tokenAmount);
      // await usdt.issue(tokenAmount);

      console.log(`\t\tUSDT balance of USDT_OWNER_ADDRESS = ${await usdt.balanceOf(USDT_OWNER_ADDRESS)}`);

      await aaveContracts.lendingPool.deposit(USDT, tokenAmount.toString(), 0);
      await aaveContracts.aUSDT.transfer(receiver, tokenAmount);

      console.log('impersonating stopped\n');

      console.log(
        `\tMinted ${amount} aUSDT to ${receiver}, balance = ${(await aaveContracts.aUSDT.balanceOf(receiver)).div(
          ethers.BigNumber.from(1000000)
        )}`
      );
    }

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
    const benchmarkAaveForge = await BenchmarkAaveForge.deploy(benchmark.address, AAVE, FORGE_AAVE);
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
    tx = await benchmark.connect(governance).addForge(FORGE_AAVE, benchmarkAaveForge.address, {
      gasLimit: 50000,
    });
    printInfo(tx);
    console.log('\n');

    console.log('Creating Test markets');
    console.log('=====================\n');

    const BenchmarkOwnershipToken = await ethers.getContractFactory('BenchmarkOwnershipToken');
    const BenchmarkFutureYieldToken = await ethers.getContractFactory('BenchmarkFutureYieldToken');

    console.log('   1. Creating Test Token');
    console.log('   -----------------------------');
    const TestToken = await ethers.getContractFactory('TestToken');
    const testToken = await TestToken.deploy('Test Token', 'TEST', 6);
    tx = await testToken.deployed();
    printInfo(tx.deployTransaction);
    console.log(`   > address:\t${testToken.address}\n\n`);
    console.log('\n');

    console.log('   2. Creating new newYieldContract');
    console.log('   -----------------------------');

    await benchmarkAaveForge.newYieldContracts(USDT, TEST_EXPIRY);

    const benchmarkFutureYieldToken = await BenchmarkFutureYieldToken.attach(
      await benchmarkData.xytTokens(FORGE_AAVE, USDT, TEST_EXPIRY)
    );
    console.log('   benchmarkFutureYieldToken.address', benchmarkFutureYieldToken.address);

    const benchmarkOTToken = await BenchmarkOwnershipToken.attach(
      await benchmarkData.otTokens(FORGE_AAVE, USDT, TEST_EXPIRY)
    );

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
    console.log(`   Market Created: ${benchmarkMarketAddress}`);
    await testToken.approve(benchmarkMarketAddress, MAX_ALLOWANCE);
    await benchmarkFutureYieldToken.approve(benchmarkMarketAddress, MAX_ALLOWANCE);
    // let's mint a lot of aUSDT to account
    const aaveContracts = await getAaveContracts();
    console.log('fetched aaveContracts');

    await mintAUSDT(account, 100000, aaveContracts);
    // await aaveContracts.aUSDT.approve(benchmarkAaveForge.address, MAX_ALLOWANCE);
    // await benchmark.tokenizeYield(FORGE_AAVE, USDT, TEST_EXPIRY, 50000 * 1000000, account);

    console.log(`\tMinted 100000*1e6 AUSDT to account: ${account}\n deposited 50000*1e6 of them into AaveForge`);
    // Summary

    console.log('Summary');
    console.log('=======\n');
    console.log(`   > Benchmark:\t\t\t${benchmark.address}`);
    console.log(`   > BenchmarkTreasury:\t\t${benchmarkTreasury.address}`);
    console.log(`   > BenchmarkAaveForge:\t${benchmarkAaveForge.address}`);
    console.log(`   > BenchmarkMarketFactory:\t${benchmarkMarketFactory.address}`);
    console.log(`   > BenchmarkData:\t\t${benchmarkData.address}`);
    console.log('\n');
    console.log(`   > Test XYT Token:\t${benchmarkFutureYieldToken.address}`);
    console.log(`   > Test OT Token:\t${benchmarkOTToken.address}`);
    console.log(`   > aUSDT Token:\t${aaveContracts.aUSDT.address}`);
    console.log(`   > Wallet Address:\t${account}`);

    console.log('\nDeployment complete!');
  });
