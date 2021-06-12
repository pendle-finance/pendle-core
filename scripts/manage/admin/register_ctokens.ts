const hre = require('hardhat');
import path from 'path';

import { getDeployment, getContractFromDeployment, sendAndWaitForTransaction } from '../../helpers/deployHelpers';
async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = hre.network.name;
  const filePath = path.resolve(__dirname, `../../../deployments/${network}.json`);

  //check and load arguments
  if (process.argv.length != 4) {
    // underlying asset address, ctoken address
    console.error('Expected three argument!');
    process.exit(1);
  }
  const underlyingAssetContractAddress = process.argv[2];
  const ctokenContractAddress = process.argv[3];

  console.log(`\n\tNetwork = ${network}, deployer = ${deployer.address}`);
  console.log(`\tDeployment's filePath = ${filePath}`);

  //load depolyment and deployed contracts
  const deployment = getDeployment(filePath);

  const pendleCompoundForge = await getContractFromDeployment(hre, deployment, 'PendleCompoundForge');
  const registered = await pendleCompoundForge.underlyingToCToken(underlyingAssetContractAddress);
  console.log(
    `cToken registered = ${registered}, is zero address ? ${
      registered === '0x0000000000000000000000000000000000000000'
    }`
  );
  await sendAndWaitForTransaction(hre, pendleCompoundForge.registerCTokens, 'registerCTokens', [
    [underlyingAssetContractAddress],
    [ctokenContractAddress],
  ]);
  // TODO: print txDetails when using multisig
  // console.log('[NOTICE - TODO] We will need to use the governance multisig to register Ctoken');
  // const txDetails = await pendleRouter.populateTransaction.registerCTokens(
  //   [underlyingAssetContractAddress],
  //   [ctokenContractAddress]
  // );
  // console.log(`[NOTICE - TODO] Transaction details: \n${JSON.stringify(txDetails, null, '  ')}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
