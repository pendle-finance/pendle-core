const Web3 = require("web3");

const { IAaveLendingPoolCoreArtifact, IAaveLendingPoolArtifact, IATokenArtifact, IUSDTArtifact } = require("../deploy_helpers/exports")
const BenchmarkDataArtifact = require("../deployments/kovan/BenchmarkData.json");

const constants = {
  FORGE_AAVE: Web3.utils.asciiToHex("Aave"),
  USDT_ADDRESS: '0x13512979ade267ab5100878e2e0f485b568328a4',
  AUSDT_ADDRESS: '0xA01bA9fB493b851F4Ac5093A324CB081A909C34B',
  WETH_ADDRESS: '0xa1c74a9a3e59ffe9bee7b85cd6e91c0751289ebd',
  AAVE_LENDING_POOL_CORE_ADDRESS: '0x95D1189Ed88B380E319dF73fF00E479fcc4CFa45',
  AAVE_LENDING_POOL_ADDRESS: '0x580D4Fdc4BF8f9b5ae2fb9225D584fED4AD5375c',
  TEST_EXPIRY: 1624462704
}

// this script will mint USDT and aUSDT to account[0]
async function main() {
  // const web3 = new Web3('http://localhost:8545');
  const web3 = new Web3(`https://kovan.infura.io/v3/${process.env.INFURA_KEY}`);
  const accounts = await web3.eth.getAccounts();
  console.log(accounts);
  console.log(BenchmarkDataArtifact);

  const aUSDTToken = new web3.eth.Contract(IATokenArtifact.abi, constants.AUSDT_ADDRESS);
  const USDTToken = new web3.eth.Contract(IUSDTArtifact.abi, constants.USDT_ADDRESS);
  const benchmarkData = new web3.eth.Contract(BenchmarkDataArtifact.abi, BenchmarkDataArtifact.address);
  const {ot, xyt} = await benchmarkData.methods.getBenchmarkYieldTokens(constants.FORGE_AAVE, constants.USDT_ADDRESS, constants.TEST_EXPIRY ).call();
  console.log(`results = ${ot} ${xyt}`);
}

main();
