const hre = require("hardhat");
import fs from "fs";
import path from "path";
import { BigNumber as BN } from "ethers";

import {
  devConstants,
  kovanConstants,
  mainnetConstants,
  goerliConstants,
  Deployment,
  getContractFromDeployment,
} from "../helpers/deployHelpers";
async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = hre.network.name;
  const filePath = path.resolve(__dirname, `../../deployments/${network}.json`);
  let consts: any;

  //check and load arguments
  if (process.argv.length != 5) { // forge, underlyingAsset, expiry
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

  const xyt = await pendleData.xytTokens(forgeId, underlyingAssetContractAddress, expiry);
  const ot = await pendleData.otTokens(forgeId, underlyingAssetContractAddress, expiry);

  //query amount details
  const xytTotal = await xyt.totalSupply(); //to print
  const otTotal = await ot.totalSupply(); // to print 

  const forgeAddress = await pendleData.getForgeAddress(forgeId);
  const yieldTokenHolder = forgeAddress.yieldTokenHolders(underlyingAssetContractAddress, expiry);
  const ATokenAddress = await forgeAddress.reserveATokenAddress(underlyingAssetContractAddress);  //TODO: not sure how to determine it's a aave forge or compound forge
  const CTokenAddress = await forgeAddress.underlyingToCToken(underlyingAssetContractAddress);  //TODO: not sure how to determine it's a aave forge or compound forge

  const aYieldBalance = ATokenAddress.balanceOf(yieldTokenHolder);  //to print
  const cYieldBalance = CTokenAddress.balanceOf(yieldTokenHolder);  //to print

  const rewardTokenAddress = await forgeAddress.rewardToken();
  const rewardTokenBalance = await rewardTokenAddress.balanceOf(yieldTokenHolder); //to print
  
  const forgeFee = await forgeAddress.totalFee(underlyingAssetContractAddress, expiry); //to print

  console.log(`total amount of OTs/XYTs = ${otTotal} , ${xytTotal}`);
  console.log(`total amount of yield tokens (aToken) in the yieldTokenHolder = ${aYieldBalance}`);
  console.log(`total amount of yield tokens (cToken) in the yieldTokenHolder = ${cYieldBalance}`);
  console.log(`total amount of reward token (stkAAVE/COMP) in the yieldTokenHolder = ${rewardTokenBalance}`);
  console.log(`forge fees earned so far = ${JSON.stringify(forgeFee)}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
