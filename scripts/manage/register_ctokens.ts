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
  if (process.argv.length != 6) { //forge, underlying asset address, ctoken address, expiry
    console.error('Expected three argument!');
    process.exit(1);
  }
  const forgeId = process.argv[2];
  const underlyingAssetContractAddress = process.argv[3];
  const ctokenContractAddress = process.argv[4];
  const expiry = process.argv[5];
  
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


  const pendleCompoundForge = await getContractFromDeployment(hre, deployment, 'PendleCompoundForge');
  const registered = await pendleCompoundForge.underlyingToCToken(underlyingAssetContractAddress);
  console.log(
    `cToken registered = ${registered}, is zero address ? ${registered === consts.misc.ZERO_ADDRESS}`
  );
  
  if (registered === consts.misc.ZERO_ADDRESS) {
    // create new yield contracts
    if (!['kovan', 'mainnet'].includes(hre.network.name)) {
      await pendleCompoundForge.registerCTokens([underlyingAssetContractAddress], [ctokenContractAddress]);
    } else {
      console.log('[NOTICE - TODO] We will need to use the governance multisig to register Ctoken');
      const txDetails = await pendleRouter.populateTransaction.registerCTokens(
        [underlyingAssetContractAddress],
        [ctokenContractAddress]
      );
      console.log(`[NOTICE - TODO] Transaction details: \n${JSON.stringify(txDetails, null, '  ')}`);
    }
  }

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
