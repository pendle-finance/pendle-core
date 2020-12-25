const {
  deployContracts,
  deployCoreContracts,
  deployTestBenchmarkTokens,
  constants
} = require('../test/helpers/Helpers');
const web3 = require("@nomiclabs/hardhat-web3");
// const hre = require("hardhat");

async function main() {
  await web3.eth.getAccounts(async function (e, accounts) {
    console.log(`accounts = ${accounts}`);
    const contracts = await deployCoreContracts(accounts[0], constants.kovan);
    console.log('\tDone deploying core contracts');

    await deployTestBenchmarkTokens(contracts, constants);
    console.log('\tDone deploying Test XYT and OT contracts');
  });
}

main();
