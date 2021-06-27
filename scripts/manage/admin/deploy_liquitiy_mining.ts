const hre = require('hardhat');
import path from 'path';
import { BigNumber as BN, utils } from 'ethers';
import * as readline from 'readline';

import { devConstants, kovanConstants, mainnetConstants, goerliConstants } from '../../helpers/constants';

import { getDeployment, saveDeployment, setupLiquidityMining } from '../../helpers/deployHelpers';

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = hre.network.name;
  const filePath = path.resolve(__dirname, `../../../deployments/${network}.json`);
  let consts: any;

  //check and load arguments
  if (process.argv.length != 9) {
    //forgeId, marketFactoryId, liqMiningContractName, underlying asset, base token, expiry
    console.error(
      'Expected 7 arguments ! forgeId, marketFactoryId, liqMiningContractName, underlying asset, base token, expiry, start time'
    );
    process.exit(1);
  }
  const forgeId = utils.formatBytes32String(process.argv[2]);
  const marketFactoryId = utils.formatBytes32String(process.argv[3]);
  const liqMiningContractName = process.argv[4];
  const underlyingAssetAddress = process.argv[5];
  const baseTokenAddress = process.argv[6];
  const expiry = BN.from(process.argv[7]);
  const startTime = BN.from(process.argv[8]);

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
  const deployment = getDeployment(filePath);

  const liqParams = consts.common.liqParams;
  liqParams.EXPIRIES = [expiry];
  liqParams.START_TIME = startTime;

  console.log(`\t epoch duration = ${liqParams.EPOCH_DURATION}`);
  console.log(`\t vesting epoches = ${liqParams.VESTING_EPOCHS}`);
  console.log(`\t expiries = ${liqParams.EXPIRIES}`);
  console.log(`\t allocations = ${liqParams.ALLOCATIONS}`);
  console.log(`\t start time = ${liqParams.START_TIME}`);

  const underlyingAssetContract = await (
    await hre.ethers.getContractFactory('TestToken')
  ).attach(underlyingAssetAddress);

  const baseTokenContract = await (await hre.ethers.getContractFactory('TestToken')).attach(baseTokenAddress);

  await setupLiquidityMining(
    hre,
    deployment,
    consts,
    forgeId, //To check
    marketFactoryId, //To check
    liqMiningContractName, //To check
    underlyingAssetContract,
    baseTokenContract,
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
