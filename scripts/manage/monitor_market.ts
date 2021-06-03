const hre = require("hardhat");
import fs from "fs";
import path from "path";
import { utils, BigNumber as BN } from "ethers";

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
  if (process.argv.length != 5) { //marketFactoryId, xyt, token
    console.error('Expected three argument!');
    process.exit(1);
  }
  const marketFactoryId = utils.formatBytes32String(process.argv[2]);
  const xytAddress = process.argv[3];
  const baseTokenAddress = process.argv[4];

  const xytContract = await (await hre.ethers.getContractFactory("PendleFutureYieldToken")).attach(xytAddress);
  
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
  const pendleMarketReader = await getContractFromDeployment(hre, deployment, 'PendleMarketReader');
  const pendlePausingManager = await getContractFromDeployment(hre, deployment, 'PendlePausingManager');
  //const market = await pendleData.getMarket(marketFactoryId, xytAddress, baseTokenAddress);
  const market = await hre.ethers.getContractAt("IPendleMarket", await pendleData.getMarket(marketFactoryId, xytAddress, baseTokenAddress));


  //const xyt = await pendleData.xytTokens(forgeId, underlyingAssetContractAddress, expiry);
  //const ot = await pendleData.otTokens(forgeId, underlyingAssetContractAddress, expiry);

  //query amount details
  const reserveBalanceResult = await pendleMarketReader.getMarketReserves(marketFactoryId, xytAddress, baseTokenAddress); //to print
  const [xytBalance, xytWeight, tokenBalance, tokenWeight] = await market.getReserves(); //to print
  const price = (xytBalance / xytWeight) / (tokenBalance / tokenWeight); // TODO: where is the spot price calculation //to print

  const lpTotal = await market.totalSupply(); //to print

  const underlyingAssetContractAddress = await xytContract.underlyingAsset();
  const forgeAddress = await xytContract.forge();
  const forge = await hre.ethers.getContractAt("IPendleForge", forgeAddress);


 // const ATokenAddress = await forgeAddress.reserveATokenAddress(underlyingAssetContractAddress);  //TODO: not sure how to determine it's a aave forge or compound forge
 // const CTokenAddress = await forgeAddress.underlyingToCToken(underlyingAssetContractAddress);  //TODO: not sure how to determine it's a aave forge or compound forge
  const bearingTokenAddress = await forge.getYieldBearingToken(underlyingAssetContractAddress);
  const bearToken = await hre.ethers.getContractAt("TestToken", bearingTokenAddress);

  
  //const aYieldBalance = ATokenAddress.balanceOf(market);  //to print
  //const cYieldBalance = CTokenAddress.balanceOf(market);  //to print
  const yieldBalance = bearToken.balanceOf(market);

  //const rewardTokenAddress = await forgeAddress.rewardToken();
  const rewardTokenAddress = await forge.rewardToken();
  const rewardTokenBalance = await rewardTokenAddress.balanceOf(market); //to print
  
  const timeTillExpiry = await xytContract.expiry() - Math.floor(Date.now() / 1000); //to print

  const [,islocked] = await pendlePausingManager.checkMarketStatus(marketFactoryId, market);  //to print

  console.log(`amount of XYTs & baseToken = ${xytBalance} , ${tokenBalance}`);
  console.log(`weight of XYTs & baseToken = ${xytWeight} , ${tokenWeight}`);
  console.log(`current price (xyt to base) = ${price}`);
  console.log(`total LPs minted = ${lpTotal}`);
  //console.log(`amount of yieldTokens (aToken/ctoken) in the market = ${aYieldBalance}, ${cYieldBalance}`);
  console.log(`amount of yieldTokens (aToken/ctoken) in the market = ${yieldBalance}`);
  console.log(`amount of reward tokens (stkAAVE/COMP) in the market = ${rewardTokenBalance}`);
  console.log(`time until expiry = ${timeTillExpiry}`);
  console.log(`is locked or not = ${islocked}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
