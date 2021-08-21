const hre = require('hardhat');
import path from 'path';

import { devConstants, kovanConstants, mainnetConstants, goerliConstants } from '../../helpers/constants';

import { getDeployment, deploy } from '../../helpers/deployHelpers';

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = hre.network.name;
  const filePath = path.resolve(__dirname, `../../../deployments/${network}.json`);
  let consts: any;

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

  const pendleRouterAddress = deployment.contracts.PendleRouter.address;

  const contractFactory = await hre.ethers.getContractFactory('PendleRedeemProxy');
  const contractObject = await contractFactory.deploy(pendleRouterAddress);
  await contractObject.deployed();

  console.log(
    `\t[DEPLOYED] PendleRedeemProxy deployed to ${contractObject.address}, tx=${contractObject.deployTransaction.hash}`
  );
  // await deploy(hre, deployment, 'PendleRedeemProxy', [pendleRouterAddress]);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
