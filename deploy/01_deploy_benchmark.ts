import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import {devConstants, kovanConstants} from '../deploy_helpers/Constants';
import {impersonateAccount} from '../test/helpers/Helpers';
const { BenchmarkArtifact, BenchmarkMarketArtifact, BenchmarkTreasuryArtifact, BenchmarkAaveForgeArtifact, BenchmarkMarketFactoryArtifact, BenchmarkDataArtifact, TestTokenArtifact, BenchmarkFutureYieldTokenArtifact, BenchmarkOwnershipTokenArtifact, IAaveLendingPoolCoreArtifact, IAaveLendingPoolArtifact, IATokenArtifact, IUSDTArtifact } = require("../deploy_helpers/exports")
const Web3 = require("web3");


const TEST_AMOUNT_TO_MINT =      1000000000;
const TEST_AMOUNT_TO_TOKENIZE =  100000000;
const TEST_AMOUNT_TO_BOOTSTRAP = 10000000;

const deployContract = async (deploy: any, deployer: String, contract: String, args: Array<any>) => {
  await deploy(contract, {
    from: deployer,
    contract,
    args,
    log: true,
    deterministicDeployment: true,
  });
}

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const web3 = new Web3(hre.network.provider);
  const {deployments, getNamedAccounts, getChainId} = hre;
  const {deploy} = deployments;

  const {deployer} = await getNamedAccounts();

  console.log(`\tDeployer = ${deployer}`);
  const chainId = await getChainId();
  console.log(`\tChainId = ${chainId}`);

  const constants = chainId == '42' ? kovanConstants : devConstants;

  await deployContract(deploy, deployer, 'Benchmark', [ deployer, constants.tokens.WETH.address, deployer ]);
  const benchmark = await deployments.get('Benchmark');

  await deployContract(deploy, deployer, 'BenchmarkTreasury', [ deployer, deployer ]);
  const benchmarkTreasury = await deployments.get('BenchmarkTreasury');

  await deployContract(
    deploy,
    deployer,
    'BenchmarkAaveForge',
    [
      benchmark.address,
      constants.misc.AAVE_LENDING_POOL_CORE_ADDRESS,
      constants.misc.FORGE_AAVE,
    ]);
  const benchmarkAaveForge = await deployments.get('BenchmarkAaveForge');

  await deployContract(deploy, deployer, 'BenchmarkMarketFactory', [ deployer, deployer ]);
  const benchmarkMarketFactory = await deployments.get('BenchmarkMarketFactory');

  await deployContract(deploy, deployer, 'BenchmarkData', [ deployer, deployer ]);
  const benchmarkData = await deployments.get('BenchmarkData');


  // =============================================================================
  console.log("----- Initialising core contracts");

  // const initialized = await
  await deployments.execute(
    "Benchmark",
    { from: deployer },
    "initialize",
    benchmarkData.address, benchmarkMarketFactory.address, benchmarkTreasury.address,
  );

  await deployments.execute(
    "BenchmarkMarketFactory",
    { from: deployer },
    "initialize",
    benchmark.address,
  );

  await deployments.execute(
    "BenchmarkData",
    { from: deployer },
    "initialize",
    benchmark.address,
  );


  // =============================================================================
  console.log("----- Adding Aave Forge");
  await deployments.execute(
    "Benchmark",
    { from: deployer },
    "addForge",
    constants.misc.FORGE_AAVE, benchmarkAaveForge.address,
  );

  // accounts[0] is assumed to have USDTs and AUSDTs already
  if (chainId != '42') {
    if (hre.network.name == 'hardhat') {
      await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [constants.tokens.USDT.owner],
      });
      await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [constants.tokens.AUSDT.owner],
      });
    }
    const aUSDTToken = new web3.eth.Contract(IATokenArtifact.abi, constants.tokens.AUSDT.address);
    const USDTToken = new web3.eth.Contract(IUSDTArtifact.abi, constants.tokens.USDT.address);


    const ethBalance = await web3.eth.getBalance(constants.tokens.USDT.owner);
    console.log(`\t\tEth balance of usdt owner = ${ethBalance}`);
    await USDTToken.methods.transfer(deployer, TEST_AMOUNT_TO_MINT).send({ from: constants.tokens.USDT.owner });

    const ethBalance2 = await web3.eth.getBalance(constants.tokens.AUSDT.owner);
    console.log(`\t\tEth balance of usdt owner = ${ethBalance2}`);

    await aUSDTToken.methods.transfer(deployer, TEST_AMOUNT_TO_MINT/2).send({ from: constants.tokens.AUSDT.owner, gas: 900000 })
    console.log("\t\tMinted USDT and AUSDT to deployer");
  }

  // =============================================================================
  console.log("----- Creating Yield contracts and minting XYT/OTs");
  await deployments.execute(
    "Benchmark",
    { from: deployer },
    "newYieldContracts",
    constants.misc.FORGE_AAVE, constants.tokens.USDT.address, constants.misc.TEST_EXPIRY,
  );

  const xytAddress = await deployments.read(
    "BenchmarkData",
    { from: deployer },
    "xytTokens",
    constants.misc.FORGE_AAVE, constants.tokens.USDT.address, constants.misc.TEST_EXPIRY,
  );
  const otAddress = await deployments.read(
    "BenchmarkData",
    { from: deployer },
    "otTokens",
    constants.misc.FORGE_AAVE, constants.tokens.USDT.address, constants.misc.TEST_EXPIRY,
  );
  console.log(`\tXYT contract deployed, address = ${xytAddress}`);
  console.log(`\tOT contract deployed, address = ${otAddress}`);

  const accounts = await hre.ethers.getSigners();
  const signer = accounts[0];

  const usdtContract = new hre.ethers.Contract(constants.tokens.USDT.address, IATokenArtifact.abi, signer);
  const ausdtContract = new hre.ethers.Contract(constants.tokens.AUSDT.address, IUSDTArtifact.abi, signer);
  const xytContract = new hre.ethers.Contract(xytAddress, IUSDTArtifact.abi, signer);


  await ausdtContract.approve(benchmarkAaveForge.address, constants.misc.MAX_ALLOWANCE);
  console.log(`\tApproved Aave forge to spend aUSDT`);

  // const aUSDT = new ethers.Contract(aUSDTAddress, IUSDTArtifact.abi, signer)

  await deployments.execute(
    "Benchmark",
    { from: deployer },
    "tokenizeYield",
    constants.misc.FORGE_AAVE, constants.tokens.USDT.address, constants.misc.TEST_EXPIRY, TEST_AMOUNT_TO_TOKENIZE, deployer
  );

  // =============================================================================
  console.log("----- Creating Test Benchmark market");

  await deployments.execute(
    "BenchmarkMarketFactory",
    { from: deployer },
    "createMarket",
    constants.misc.FORGE_AAVE, xytAddress, constants.tokens.USDT.address, constants.misc.TEST_EXPIRY,
  );
  const benchmarkMarketAddress = await deployments.read(
    "BenchmarkData",
    { from: deployer },
    "getMarket",
    constants.misc.FORGE_AAVE, xytAddress, constants.tokens.USDT.address
  );
  console.log(`\tDeployed a XYT/USDT market at ${benchmarkMarketAddress}`);

  await xytContract.approve(benchmarkMarketAddress, constants.misc.MAX_ALLOWANCE);
  await usdtContract.approve(benchmarkMarketAddress, constants.misc.MAX_ALLOWANCE);
  console.log(`\tApproved benchmarkMarket to spend xyt and usdt`);

  const benchmarkMarketContract = new hre.ethers.Contract(benchmarkMarketAddress, BenchmarkMarketArtifact.abi, signer);
  await benchmarkMarketContract.bootstrap(TEST_AMOUNT_TO_BOOTSTRAP, TEST_AMOUNT_TO_BOOTSTRAP);
  console.log(`\tBootstrapped Market`);

  await benchmarkMarketContract.swapAmountOut(
    constants.tokens.USDT.address,
    constants.misc.MAX_ALLOWANCE,
    xytAddress,
    TEST_AMOUNT_TO_BOOTSTRAP/10,
    constants.misc.MAX_ALLOWANCE,
    { gasLimit: 8000000 }
  );
  console.log(`\tDid a test trade`);
};
export default func;
func.tags = ['Benchmark'];
