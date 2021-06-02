const hre = require("hardhat");
import fs from "fs";
import path from "path";
import { BigNumber as BN, utils } from "ethers";

import {
  devConstants,
  kovanConstants,
  mainnetConstants,
  goerliConstants,
  Deployment,
  saveDeployment,
  getContractFromDeployment,
} from "../helpers/deployHelpers";
async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = hre.network.name;
  const filePath = path.resolve(__dirname, `../../deployments/${network}.json`);
  let consts: any;

  //check and load arguments
  if (process.argv.length != 5) { //forge, underlying asset, expiry
    console.error('Expected three argument!');
    process.exit(1);
  }
  const forgeId = process.argv[2];
  const underlyingAssetContractAddress = process.argv[3];
  const expiry = process.argv[4];
  
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

  // create new yield contracts
  if (!['kovan', 'mainnet'].includes(hre.network.name)) {
    await pendleRouter.newYieldContracts(forgeId, underlyingAssetContractAddress, expiry);
  } else {
    console.log('[NOTICE - TODO] We will need to use the governance multisig to setForgeFactoryValidity for Aave');
    const txDetails = await pendleRouter.populateTransaction.newYieldContracts(
      forgeId,
      underlyingAssetContractAddress,
      expiry
    );
    console.log(`[NOTICE - TODO] Transaction details: \n${JSON.stringify(txDetails, null, '  ')}`);
  }

  //save deployment
  const underlyingAssetContract = await (await hre.ethers.getContractFactory('TestToken')).attach(
    underlyingAssetContractAddress
  );
  const xytAddress = await pendleData.xytTokens(forgeId, underlyingAssetContractAddress, expiry);
  const otAddress = await pendleData.otTokens(forgeId, underlyingAssetContractAddress, expiry);
  const underlyingAssetSymbol = await underlyingAssetContract.symbol();
  const forgeIdString = utils.parseBytes32String(forgeId);

  if (deployment.yieldContracts[forgeIdString] == null) {
    deployment.yieldContracts[forgeIdString] = {};
  }

  if (deployment.yieldContracts[forgeIdString][underlyingAssetSymbol] == null) {
    deployment.yieldContracts[forgeIdString][underlyingAssetSymbol] = {
      expiries: {},
      PendleLiquidityMining: {},
    };
  }

  if (deployment.yieldContracts[forgeIdString][underlyingAssetSymbol].expiries[expiry] == null) {
    deployment.yieldContracts[forgeIdString][underlyingAssetSymbol].expiries[expiry] = {
      XYT: xytAddress,
      OT: otAddress,
      markets: {},
    };
  }

  saveDeployment(filePath, deployment);

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
