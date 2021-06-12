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
  if (process.argv.length != 8) { //xyt, base token, xyt amount, base token amount, forgeId, market factory id, forgeid
    console.error('Expected three argument!');
    process.exit(1);
  }
  const xytAddress = process.argv[2];
  const baseTokenAddress = process.argv[3];
  const xytAmount = process.argv[4];
  const baseTokenAmount = process.argv[5];
  const marketFactoryId = utils.parseBytes32String(process.argv[6]);
  const forgeId = utils.parseBytes32String(process.argv[7]);
  
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

  // create new market
  await pendleRouter.createMarket(marketFactoryId, xytAddress, baseTokenAddress);
  const marketAddress = await pendleData.getMarket(marketFactoryId, xytAddress, baseTokenAddress);

  //save deployment
  const xytContract = await (await hre.ethers.getContractFactory("PendleFutureYieldToken")).attach(xytAddress);
  const baseTokenContract = await (await hre.ethers.getContractFactory('TestToken')).attach(baseTokenAddress);
  const expiry = await xytContract.expiry();
  const baseTokenSymbol = await baseTokenContract.symbol();
  //const forgeAddress = await xytContract.forge();
  
  const underlyingAssetAddress = await xytContract.underlyingAsset();
  const underlyingAssetContract = await (await hre.ethers.getContractFactory('TestToken')).attach(
    underlyingAssetAddress
  );
  const underlyingAssetSymbol = await underlyingAssetContract.symbol();

  deployment.yieldContracts[forgeId][underlyingAssetSymbol].expiries[expiry].markets[
    baseTokenSymbol
  ] = marketAddress;
  saveDeployment(filePath, deployment);

  //bootstrap the market
  await xytContract.approve(pendleRouter.address, xytAmount);
  await baseTokenContract.approve(pendleRouter.address, baseTokenAmount);
  await pendleRouter.bootstrapMarket(
    marketFactoryId,
    xytAddress,
    baseTokenAddress,
    xytAmount,
    baseTokenAmount,
  );
  console.log(`\t\tBootstrapped market with ${xytAmount}xyts and ${baseTokenAmount} ${baseTokenSymbol}`);

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
