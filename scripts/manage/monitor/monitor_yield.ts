const hre = require('hardhat');
import fs from 'fs';
import path from 'path';
import { utils, BigNumber as BN } from 'ethers';

import {
  devConstants,
  kovanConstants,
  mainnetConstants,
  goerliConstants,
  Deployment,
  getContractFromDeployment,
} from '../helpers/deployHelpers';
async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = hre.network.name;
  const filePath = path.resolve(__dirname, `../../deployments/${network}.json`);
  let consts: any;

  //check and load arguments
  if (process.argv.length != 5) {
    // forge, underlyingAsset, expiry
    console.error('Expected three argument!');
    process.exit(1);
  }
  const forgeId = utils.formatBytes32String(process.argv[2]);
  const underlyingAssetContractAddress = process.argv[3];
  const expiry = process.argv[4];

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
  const existingDeploymentJson = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const deployment = existingDeploymentJson as Deployment;

  const pendleRouter = await getContractFromDeployment(hre, deployment, 'PendleRouter');
  const pendleData = await getContractFromDeployment(hre, deployment, 'PendleData');

  const xytAddress = await pendleData.xytTokens(forgeId, underlyingAssetContractAddress, expiry);
  const otAddress = await pendleData.otTokens(forgeId, underlyingAssetContractAddress, expiry);

  const xyt = await (await hre.ethers.getContractFactory('PendleFutureYieldToken')).attach(xytAddress);
  const ot = await (await hre.ethers.getContractFactory('PendleOwnershipToken')).attach(otAddress);

  //query amount details
  const xytTotal = await xyt.totalSupply(); //to print
  const otTotal = await ot.totalSupply(); // to print

  const forgeAddress = await pendleData.getForgeAddress(forgeId);
  const forge = await hre.ethers.getContractAt('IPendleForge', forgeAddress);
  const yieldTokenHolder = forge.yieldTokenHolders(underlyingAssetContractAddress, expiry);
  //const ATokenAddress = await forgeAddress.reserveATokenAddress(underlyingAssetContractAddress);  //TODO: not sure how to determine it's a aave forge or compound forge
  //const CTokenAddress = await forgeAddress.underlyingToCToken(underlyingAssetContractAddress);  //TODO: not sure how to determine it's a aave forge or compound forge
  const bearingTokenAddress = await forge.callStatic.getYieldBearingToken(underlyingAssetContractAddress);
  const bearToken = await hre.ethers.getContractAt('TestToken', bearingTokenAddress);

  //const aYieldBalance = ATokenAddress.balanceOf(yieldTokenHolder);  //to print
  //const cYieldBalance = CTokenAddress.balanceOf(yieldTokenHolder);  //to print

  const yieldBalance = await bearToken.balanceOf(yieldTokenHolder);

  const rewardTokenAddress = await forge.rewardToken();
  const rewardToken = await hre.ethers.getContractAt('TestToken', rewardTokenAddress);
  const rewardTokenBalance = await rewardToken.balanceOf(yieldTokenHolder); //to print

  //const forgeFee = forge.totalFee(underlyingAssetContractAddress, expiry); //to print //@@XM TODO: totalFee no view function

  console.log(`total amount of OTs/XYTs = ${otTotal} , ${xytTotal}`);
  console.log(`total amount of yield tokens in the yieldTokenHolder = ${yieldBalance}`);
  console.log(`total amount of reward token (stkAAVE/COMP) in the yieldTokenHolder = ${rewardTokenBalance}`);
  //console.log(`forge fees earned so far = ${JSON.stringify(forgeFee)}`); //@@XM TODO: totalFee no view function
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
