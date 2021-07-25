const hre = require('hardhat');
import fs from 'fs';
import path from 'path';
import { BigNumber as BN } from 'ethers';

import {
  devConstants,
  kovanConstants,
  mainnetConstants,
  goerliConstants,
  Deployment,
  getContractFromDeployment,
} from '../helpers/deployHelpers';
async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = hre.network.name;
  const filePath = path.resolve(__dirname, `../../deployments/${network}.json`);
  let consts: any;

  //check and load arguments
  if (process.argv.length != 4) {
    //liquidity mining contract address, liquidity mining contract name
    console.error('Expected three argument!');
    process.exit(1);
  }
  const liqMiningAddress = process.argv[2];
  const liqMiningContractName = process.argv[3];
  const liqMining = await (await hre.ethers.getContractFactory(liqMiningContractName)).attach(liqMiningAddress);

  //check network and load constant
  if (network == 'kovan' || network == 'kovantest') {
    consts = kovanConstants;
  } else if (network == 'goerli') {
    consts = goerliConstants;
  } else if (network == 'mainnet') {
    consts = mainnetConstants;
  } else {
    consts = devConstants;
  }

  console.log(`\n\tNetwork = ${network}, deployer = ${deployer.address}`);
  console.log(`\tDeployment's filePath = ${filePath}`);

  //load depolyment and deployed contracts
  const existingDeploymentJson = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const deployment = existingDeploymentJson as Deployment;

  const pendle = await getContractFromDeployment(hre, deployment, 'PENDLE');

  //query amount details

  var allExpiries: Uint32Array;
  allExpiries = await liqMining.allExpiries();
  var lpStakedTotal: any; //to print
  allExpiries.forEach((expiry) => async () => {
    lpStakedTotal += await liqMining.totalStakeLP(expiry);
  });

  const rewardsLeft = await pendle.balanceOf(liqMiningAddress);
  const epochsLeft = await liqMining.balanceOf(liqMiningAddress);

  const startTime = await liqMining.startTime();
  const epochDuration = await liqMining.epochDuration();
  const numberOfEpochs = await liqMining.numberOfEpochs();

  const currentEpoch = (Math.floor(Date.now() / 1000) - startTime) / epochDuration + 1; //to print
  const epochLeft = numberOfEpochs - currentEpoch; //-1? //to print

  const [, settingId] = await liqMining.readEpochData(currentEpoch);
  //var allocationSettings: [Uint32Array[1], Uint32Array[1]]; //[expiry, allocationSetting]
  var allocationSettings: [Uint32Array[1], Uint32Array[1]]; //[expiry, allocationSetting]
  var allocationSetting: Uint32Array[1]; //to print
  allExpiries.forEach((expiry) => async () => {
    allocationSetting = await liqMining.allocationSettings(expiry);
    allocationSettings.push(expiry, allocationSetting);
  });

  const yieldTokenContract = await (
    await hre.ethers.getContractFactory('PendleFutureYieldToken')
  ).attach(await liqMining.underlyingYieldToken());
  var yieldTokenBalances: [Uint32Array[1], Uint32Array[1]]; //[expiry, yield token balance]
  var yieldTokenBalance: Uint32Array[1]; //to print
  allExpiries.forEach((expiry) => async () => {
    yieldTokenBalance = await yieldTokenContract.balanceOf(await liqMining.lpHolderForExpiry(expiry));
    yieldTokenBalances.push(expiry, yieldTokenBalance);
  });

  console.log(`Total amount of LPs locked = ${lpStakedTotal}`);
  console.log(`Total amount of PENDLE rewards left = ${rewardsLeft}`);
  console.log(`Total amount of epochs left = ${epochLeft}`);
  console.log(`Current epoch = ${currentEpoch}`);
  console.log(`Current allocation settings = ${allocationSettings!}`);
  console.log(`Total amount of yield tokens in the LP holders of the expiries = ${yieldTokenBalances!}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
