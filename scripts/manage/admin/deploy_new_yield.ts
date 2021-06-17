const hre = require('hardhat');
import path from 'path';
import { utils } from 'ethers';

import { saveDeployment, getDeployment, createNewYieldContract } from '../../helpers/deployHelpers';

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = hre.network.name;
  const filePath = path.resolve(__dirname, `../../../deployments/${network}.json`);

  //check and load arguments
  if (process.argv.length != 5) {
    //forge, underlying asset, expiry
    console.error('Expected three argument: forgeId, underlying asset, expiry');
    process.exit(1);
  }
  const forgeId = utils.formatBytes32String(process.argv[2]);
  const underlyingAssetContractAddress = process.argv[3];
  const expiry = parseInt(process.argv[4]);
  console.log(`underlyingAssetContractAddress = ${underlyingAssetContractAddress}`);

  console.log(`\n\tNetwork = ${network}, deployer = ${deployer.address}`);
  console.log(`\tDeployment's filePath = ${filePath}`);

  //load deployment and deployed contracts
  const deployment = getDeployment(filePath);

  const underlyingAssetContract = await hre.ethers.getContractAt('TestToken', underlyingAssetContractAddress);
  console.log(`underlyingAssetContract = ${underlyingAssetContract.address}`);

  await createNewYieldContract(hre, deployment, forgeId, underlyingAssetContract, expiry);
  saveDeployment(filePath, deployment);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
