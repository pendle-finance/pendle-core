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
  //liquidity mining contract address, liquidity mining contract name, rewards

  const liqMiningAddress = process.argv[2];
  const liqMiningContractName = process.argv[3];
  const rewards = process.argv.slice(4);;

  const liqMiningContract = await (await hre.ethers.getContractFactory(liqMiningContractName)).attach(liqMiningAddress);

  
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
    REWARDS_PER_EPOCH: rewards.map((a) => consts.misc.ONE_E_18.mul(a)), // = [10000000000, 20000000000, ..]
  };

  console.log(`\t rewards = ${liqParams.REWARDS_PER_EPOCH}`);

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

  await liqMiningContract.fund([liqParams.REWARDS_PER_EPOCH]);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
