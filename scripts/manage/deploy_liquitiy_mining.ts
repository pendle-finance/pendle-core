const hre = require("hardhat");
import fs from "fs";
import path from "path";
import { BigNumber as BN, utils } from "ethers";
import * as readline from 'readline';


import {
  devConstants,
  kovanConstants,
  mainnetConstants,
  goerliConstants,
  Deployment,
  saveDeployment,
  setupLiquidityMining,
  getContractFromDeployment,
} from "../helpers/deployHelpers";
async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = hre.network.name;
  const filePath = path.resolve(__dirname, `../../deployments/${network}.json`);
  let consts: any;

  //check and load arguments
  if (process.argv.length != 8) { //forgeId, marketFactoryId, liqMiningContractName, underlying asset, base token, expiry
    console.error('Expected three argument!');
    process.exit(1);
  }
  const forgeId = utils.formatBytes32String(process.argv[2]);
  const marketFactoryId = utils.formatBytes32String(process.argv[3]);
  const liqMiningContractName = process.argv[4];
  const underlyingAssetAddress = process.argv[5];
  const baseTokenAddress = process.argv[6];
  const expiry = process.argv[7];
  
  //check network and load constant
  if (network == "kovan" || network == "kovantest") {
    consts = kovanConstants;
  } else if (network == "goerli") {
    consts = goerliConstants;
  } else if (network == "mainnet") {
    consts = mainnetConstants;
  } else {
    consts = devConstants;
  }

  console.log(`\n\tNetwork = ${network}, deployer = ${deployer.address}`);
  console.log(`\tDeployment's filePath = ${filePath}`);

  //load depolyment and deployed contracts
  const existingDeploymentJson = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const deployment = existingDeploymentJson as Deployment;

  const pendleRouter = await getContractFromDeployment(hre, deployment, 'PendleRouter');
  const pendleData = await getContractFromDeployment(hre, deployment, 'PendleData');

  const liqParams = {
    EPOCH_DURATION: consts.misc.ONE_DAY.mul(10),
    VESTING_EPOCHS: 4,
    EXPIRIES: [expiry],
    ALLOCATIONS: [consts.misc.LIQ_MINING_ALLOCATION_DENOMINATOR],
    REWARDS_PER_EPOCH: [100000, 100000, 100000, 100000, 100000, 100000, 100000].map((a) => consts.misc.ONE_E_18.mul(a)), // = [10000000000, 20000000000, ..]
  };

  console.log(`\t epoch duration = ${liqParams.EPOCH_DURATION}`);
  console.log(`\t vesting epoches = ${liqParams.VESTING_EPOCHS}`);
  console.log(`\t expiries = ${liqParams.EXPIRIES}`);
  console.log(`\t allocations = ${liqParams.ALLOCATIONS}`);
  console.log(`\t rewards per epoch = ${liqParams.REWARDS_PER_EPOCH}`);

  let rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  rl.question('Is this setup ok to proceed? [y/n] ', (answer) => {
    switch(answer.toLowerCase()) {
      case 'y':
        console.log('Super!');
        break;
      case 'n':
        console.log('Sorry! :(');
        process.exit(1);
      default:
        console.log('Invalid answer!');
        process.exit(1);
    }
    rl.close();
  });


  const underlyingAssetContract = await (await hre.ethers.getContractFactory('TestToken')).attach(
    underlyingAssetAddress
  );

  const baseTokenContract = await (await hre.ethers.getContractFactory('TestToken')).attach(
    baseTokenAddress
  );

  await setupLiquidityMining(
    hre,
    deployment,
    consts,
    utils.parseBytes32String(forgeId),  //To check
    utils.parseBytes32String(marketFactoryId),  //To check
    utils.parseBytes32String(liqMiningContractName), //To check
    underlyingAssetContract,
    baseTokenAddress,
    liqParams
  );
  saveDeployment(filePath, deployment);

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
