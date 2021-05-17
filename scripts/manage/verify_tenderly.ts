const hre = require('hardhat');
import fs from 'fs';
import path from 'path';
const { execSync } = require('child_process');

import { Deployment, DeployedContract } from '../helpers/deployHelpers';
async function main() {
  const network = hre.network.name;
  const filePath = path.resolve(__dirname, `../../deployments/${network}.json`);

  const tenderlyNetwork = network == 'kovantest' ? 'kovan' : network;

  console.log(`\n\tNetwork = ${network}, tenderly network = ${tenderlyNetwork}`);
  console.log(`\tDeployment's filePath = ${filePath}`);

  const existingDeploymentJson = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const deployment = existingDeploymentJson as Deployment;

  for (let contractName in deployment.contracts) {
    verifyContract(tenderlyNetwork, contractName, deployment.contracts[contractName].address);
  }

  // deployment.yieldContracts.forEach((forgeId, forgeData) => {
  //   const forgeType = forgeId == "AaveV2" ? "Aave" : forgeId;
  //   forgeData.forEach((underlyingAsset, underlyingAssetData) => {
  //     underlyingAssetData.expiries.forEach((expiry, expiryData) => {
  //       verifyContract(tenderlyNetwork, "PendleFutureYieldToken", enpiryData.XYT);
  //       verifyContract(tenderlyNetwork, "PendleOwnershipToken", enpiryData.OT);
  //       expiryData.markets.forEach((baseToken, marketAddress) => {
  //         verifyContract(tenderlyNetwork, `Pendle${forgeType}Market`, marketAddress);
  //       })
  //     });
  //     underlyingAssetData.PendleLiquidityMining.forEach((baseToken, liqMiningContractAddress) => {
  //       verifyContract(tenderlyNetwork, `Pendle${forgeType}LiquidityMining`, liqMiningContractName);
  //     });
  //
  //   })
  // });
}

function verifyContract(tenderlyNetwork: string, contractName: string, contractAddress: string) {
  // console.log("===== Verifying ", contractName);
  // const stdout = execSync(
  //   `yarn hardhat --network ${tenderlyNetwork} tenderly:verify ${contractName}=${contractAddress}`
  // );
  // console.log(`${stdout}`);
  const stdout2 = execSync(
    `yarn hardhat --network ${tenderlyNetwork} tenderly:push ${contractName}=${contractAddress}`
  );
  console.log(`${stdout2}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
