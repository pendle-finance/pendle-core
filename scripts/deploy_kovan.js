const { deployContracts, deployCoreContracts, deployTestPendleTokens, consts } = require('../test/helpers/Helpers');

// const hre = require("hardhat");

async function main() {
  await web3.eth.getAccounts(async function (e, accounts) {
    console.log(`accounts = ${accounts}`);
    const contracts = await deployCoreContracts(accounts[0], consts.kovan);
    console.log('\tDone deploying core contracts');

    await deployTestPendleTokens(contracts, consts.kovan);
    console.log('\tDone deploying Test XYT and OT contracts');
  });
}

main();
