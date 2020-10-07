const bre = require("@nomiclabs/buidler");
const LendingPool = artifacts.require("LendingPool");
const LendingPoolAddressesProvider = artifacts.require("LendingPoolAddressesProvider");
const CoreLibrary = artifacts.require("CoreLibrary");

const DUMMY_ADDRESS="0x7c2C195CD6D34B8F845992d380aADB2730bB9C6F";

async function main() {
  const coreLibrary = await CoreLibrary.new();
  console.log(`Deployed CoreLibrary at ${coreLibrary.address}`);

  const lendingPool = await LendingPool.new();
  console.log(`Deployed LendingPool at ${lendingPool.address}`);
  // const testReserveDataa = await lendingPool.getReserveConfigurationData(DUMMY_ADDRESS);
  // console.log(`testReserveDataa = ${testReserveDataa}`);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
