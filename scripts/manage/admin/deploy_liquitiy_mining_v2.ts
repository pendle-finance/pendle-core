const hre = require('hardhat');
import path from 'path';
import { BigNumber as BN, ethers } from 'ethers';
import * as readline from 'readline';

import { devConstants, kovanConstants, mainnetConstants, goerliConstants } from '../../helpers/constants';

import { getDeployment, deploy, saveDeployment, sendAndWaitForTransaction } from '../../helpers/deployHelpers';

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = hre.network.name;
  const filePath = path.resolve(__dirname, `../../../deployments/${network}.json`);
  let consts: any;

  console.log('process.argv.length', process.argv.length);

  //check and load arguments
  if (process.argv.length != 9) {
    //forgeId, marketFactoryId, liqMiningContractName, underlying asset, base token, expiry, fund
    console.error('Expected 3 arguments ! stakeToken, yieldToken, start time, epoch1Funding');
    process.exit(1);
  }
  const stakeToken = process.argv[2];
  const yieldToken = process.argv[3];
  const startTime = BN.from(process.argv[4]);
  const epoch1Funding = BN.from(process.argv[5]);
  const forgeId = process.argv[6];
  const underlyingAssetAddress = process.argv[7].toLowerCase();
  const expiry = process.argv[8];

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

  const governanceManagerLiqMiningAddress = deployment.contracts.PendleGovernanceManagerLiqMining.address;
  const pausingManagerLiqMiningV2Address = deployment.contracts.PendlePausingManagerLiqMiningV2.address;
  const whitelistAddress = deployment.contracts.PendleWhitelist.address;
  const pendleAddress = deployment.contracts.PENDLE.address;

  const liqParams = consts.common.liqParams;
  liqParams.START_TIME = BN.from(startTime);

  console.log(`\t epoch duration = ${liqParams.EPOCH_DURATION}`);
  console.log(`\t vesting epoches = ${liqParams.VESTING_EPOCHS}`);
  console.log(`\t start time = ${liqParams.START_TIME}`);
  console.log(`\t funding = ${epoch1Funding}`);
  console.log(`\t stakeToken = ${stakeToken}`);
  console.log(`\t yieldToken = ${yieldToken}`);
  console.log(`\t startTime = ${liqParams.START_TIME}`);
  console.log(`\t forgeId = ${forgeId}`);
  console.log(`\t underlyingAssetAddress = ${underlyingAssetAddress}`);

  if (!deployment.directories) {
    deployment.directories = {};
  }

  if (!deployment.directories.liqMiningV2) {
    const liqMiningV2Contract = await deploy(hre, deployment, 'Directory', []);
    deployment.directories.liqMiningV2 = liqMiningV2Contract.address;
    saveDeployment(filePath, deployment);
  }

  const lmV2 = await deploy(hre, deployment, 'PendleLiquidityMiningBaseV2', [
    governanceManagerLiqMiningAddress,
    pausingManagerLiqMiningV2Address,
    whitelistAddress,
    pendleAddress,
    stakeToken,
    yieldToken,
    liqParams.START_TIME,
    liqParams.EPOCH_DURATION,
    liqParams.VESTING_EPOCHS,
  ]);

  deployment.yieldContracts[forgeId][underlyingAssetAddress].expiries[expiry].OTSLPLiquidityMiningContract =
    lmV2.address;
  if (deployment.liquidityMiningV2Contracts == null) {
    deployment.liquidityMiningV2Contracts = [];
  }
  deployment.liquidityMiningV2Contracts.push({
    address: lmV2.address,
    stakeToken,
    yieldToken,
    type: 'OTSLPLiquidityMiningContract',
    forgeId,
    underlyingAssetAddress,
    expiry,
  });

  saveDeployment(filePath, deployment);

  const liqMiningV2Bytes = ethers.utils.formatBytes32String('LiqMiningV2');

  const liqMiningV2Directory = await hre.ethers.getContractAt('Directory', deployment.directories.liqMiningV2);
  await sendAndWaitForTransaction(hre, liqMiningV2Directory.addAddress, 'Adding new liqMiningV2 address to directory', [
    liqMiningV2Bytes,
    [lmV2.address],
  ]);

  const pendle = await hre.ethers.getContractAt('IERC20', pendleAddress);
  await sendAndWaitForTransaction(hre, pendle.approve, 'approve liq-mining for PENDLE', [
    lmV2.address,
    consts.common.MAX_ALLOWANCE,
  ]);

  await sendAndWaitForTransaction(hre, lmV2.fund, 'fund epoch 1', [
    [epoch1Funding, epoch1Funding, epoch1Funding, epoch1Funding],
  ]);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
