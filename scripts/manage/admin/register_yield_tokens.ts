const hre = require('hardhat');
import { BigNumber as BN } from 'ethers';
import path from 'path';

import { getDeployment, getContractFromDeployment, sendAndWaitForTransaction } from '../../helpers/deployHelpers';
async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = hre.network.name;
  const filePath = path.resolve(__dirname, `../../../deployments/${network}.json`);

  //check and load arguments
  if (process.argv.length != 5) {
    // underlying asset address, tokenInfo, forgeContractName
    console.error('Expected 3 argument!');
    process.exit(1);
  }
  const underlyingAssetContractAddress = process.argv[2];
  const tokenInfoDetails = process.argv[3];
  console.log(`tokenInfoDetails = ${tokenInfoDetails}`);
  const forgeContractName = process.argv[4];

  let tokenInfo = [];
  if (tokenInfoDetails !== 'NONE') {
    tokenInfo.push(BN.from(tokenInfoDetails));
  }

  console.log(`\n\tNetwork = ${network}, deployer = ${deployer.address}`);
  console.log(`\tDeployment's filePath = ${filePath}`);

  //load depolyment and deployed contracts
  const deployment = getDeployment(filePath);

  const forge = await getContractFromDeployment(hre, deployment, forgeContractName);
  const registered = await forge.tokenInfo(underlyingAssetContractAddress);
  console.log(
    `registered = ${registered.registered}, tokenInfo = ${JSON.stringify(
      tokenInfo
    )}, underlyingAsset = ${underlyingAssetContractAddress}`
  );
  await sendAndWaitForTransaction(hre, forge.registerTokens, 'registerTokens', [
    [underlyingAssetContractAddress],
    [tokenInfo],
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
