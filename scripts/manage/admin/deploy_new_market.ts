const hre = require('hardhat');
import path from 'path';
import { utils } from 'ethers';

import { saveDeployment, getDeployment, createNewMarket } from '../../helpers/deployHelpers';
async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = hre.network.name;
  const filePath = path.resolve(__dirname, `../../../deployments/${network}.json`);

  //check and load arguments
  if (process.argv.length != 7) {
    // forgeId, marketFactoryId, underlyingAsset, expiry, baseToken
    console.error('Expected 5 arguments! forgeId, marketFactoryId, underlyingAsset, expiry, baseToken ');
    process.exit(1);
  }
  const forgeId = utils.formatBytes32String(process.argv[2]);
  const marketFactoryId = utils.formatBytes32String(process.argv[3]);
  const underlyingAssetAddress = process.argv[4];
  const expiry = parseInt(process.argv[5]);
  const baseTokenAddress = process.argv[6];

  console.log(`\n\tNetwork = ${network}, deployer = ${deployer.address}`);
  console.log(`\tDeployment's filePath = ${filePath}`);

  //load depolyment and deployed contracts
  const deployment = getDeployment(filePath);
  const underlyingAsset = await hre.ethers.getContractAt('TestToken', underlyingAssetAddress);
  const baseToken = await hre.ethers.getContractAt('TestToken', baseTokenAddress);
  await createNewMarket(hre, deployment, forgeId, marketFactoryId, underlyingAsset, expiry, baseToken);

  saveDeployment(filePath, deployment);
  //TODO: create a script for bootstrapping
  //bootstrap the market
  // await xytContract.approve(pendleRouter.address, xytAmount);
  // await baseTokenContract.approve(pendleRouter.address, baseTokenAmount);
  // await pendleRouter.bootstrapMarket(
  //   marketFactoryId,
  //   xytAddress,
  //   baseTokenAddress,
  //   xytAmount,
  //   baseTokenAmount,
  // );
  // console.log(`\t\tBootstrapped market with ${xytAmount}xyts and ${baseTokenAmount} ${baseTokenSymbol}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
