const Web3 = require("web3");

const { IAaveLendingPoolCoreArtifact, IAaveLendingPoolArtifact, IATokenArtifact, IUSDTArtifact } = require("../deploy_helpers/exports")

const constants = {
  USDT_ADDRESS: '0xdac17f958d2ee523a2206206994597c13d831ec7',
  AUSDT_ADDRESS: '0x71fc860F7D3A592A4a98740e39dB31d25db65ae8',
  USDT_OWNER_ADDRESS: '0xC6CDE7C39eB2f0F0095F41570af89eFC2C1Ea828',
  AUSDT_OWNER_ADDRESS: '0x21e12F11702B65EF0F6666114a2155B838bCD952',
  WETH_ADDRESS: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
  AAVE_LENDING_POOL_CORE_ADDRESS: '0x3dfd23A6c5E8BbcFc9581d2E864a68feb6a076d3',
  AAVE_LENDING_POOL_ADDRESS: '0x398ec7346dcd622edc5ae82352f02be94c62d119',
}

const AMOUNT_TO_MINT = 10000000000;

// this script will mint USDT and aUSDT to account[0]
async function main() {
  const web3 = new Web3('http://localhost:8545');
  const accounts = await web3.eth.getAccounts();
  console.log(accounts);

  const accountToMint = process.env.ACCOUNT ? process.env.ACCOUNT : accounts[0];
  console.log(`Minting to ${accountToMint}`);
  const aUSDTToken = new web3.eth.Contract(IATokenArtifact.abi, constants.AUSDT_ADDRESS);
  const USDTToken = new web3.eth.Contract(IUSDTArtifact.abi, constants.USDT_ADDRESS);

  await USDTToken.methods.transfer(accounts[0], AMOUNT_TO_MINT).send({ from: constants.USDT_OWNER_ADDRESS });

  await aUSDTToken.methods.transfer(accounts[0], AMOUNT_TO_MINT/2).send({ from: constants.AUSDT_OWNER_ADDRESS, gas: 900000 })
  console.log(`aUSDT balance of account =${await aUSDTToken.methods.balanceOf(accounts[0]).call()}`);
  console.log(`USDT balance of account =${await USDTToken.methods.balanceOf(accounts[0]).call()}`);
}

main();
