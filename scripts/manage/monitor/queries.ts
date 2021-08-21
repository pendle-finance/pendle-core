const hre = require('hardhat');
import fs from 'fs';
import path from 'path';
import { utils, BigNumber as BN } from 'ethers';
import { mintAaveToken, mintCompoundToken, mint } from '../../test/helpers';
import PendleRouter from '../../build/artifacts/contracts/core/PendleRouter.sol/PendleRouter.json';
import PendleRedeemProxy from '../../build/artifacts/contracts/proxies/PendleRedeemProxy.sol/PendleRedeemProxy.json';
const { execSync } = require('child_process');

const UNDERLYING_YIELD_TOKEN_TO_SEED = BN.from(1000000);
const BASE_TOKEN_TO_SEED = BN.from(1000000);

import {
  devConstants,
  kovanConstants,
  Deployment,
  DeployedContract,
  saveDeployment,
  getContractFromDeployment,
  createNewYieldContractAndMarket,
  mintXytAndBootstrapMarket,
  setupLiquidityMining,
} from '../helpers/deployHelpers';
async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = hre.network.name;
  const filePath = path.resolve(__dirname, `../../deployments/${network}.json`);
  let consts: any;
  if (network == 'kovan' || network == 'kovantest') {
    consts = kovanConstants;
  } else {
    consts = devConstants;
  }

  console.log(`\n\tNetwork = ${network}, deployer = ${deployer.address}`);
  console.log(`\tDeployment's filePath = ${filePath}`);

  if (network !== 'kovan' && network !== 'kovantest' && network !== 'development') {
    console.log('[ERROR] Must be for kovan or kovantest network or development');
    process.exit(1);
  }

  const existingDeploymentJson = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const deployment = existingDeploymentJson as Deployment;

  const pendleRouter = await getContractFromDeployment(hre, deployment, 'PendleRouter');
  const routerWeb3 = new hre.web3.eth.Contract(PendleRouter.abi, pendleRouter.address);

  const usdtCompoundContract = await (
    await hre.ethers.getContractFactory('TestToken')
  ).attach(consts.tokens.USDT_COMPOUND.address);
  const usdtAaveContract = await (
    await hre.ethers.getContractFactory('TestToken')
  ).attach(consts.tokens.USDT_AAVE.address);

  // const xytAddress = "0xc2D5FfFeDf7C08C67B4EE3d8f93e3DB6e088d3b5";
  const xytAddress = '0xc2d5fffedf7c08c67b4ee3d8f93e3db6e088d3b5';
  // const user = "0xE8A4095437dd20a01e66115dE33164eBCEA9B09a";
  const user = '0xB2d532986437bC93C7d2915b9F60E62cbd7F824A';
  const marketAddress = '0x4262cf1ab540324e9f90a90369912077920de4f2';
  const liqMiningAddress = '0xD6c834095C165f91b9c3156950f45733AdC95275';
  const EXPIRY = BN.from(1627430400);
  // const liqMining = ""

  const redeemProxy = await getContractFromDeployment(hre, deployment, 'PendleRedeemProxy');
  const data = await getContractFromDeployment(hre, deployment, 'PendleData');
  // await data.setInterestUpdateRateDeltaForMarket(1099511);
  // console.log(`\tSet interestUpdateRateDeltaForMarket = 0`);
  console.log(`interestUpdateRateDeltaForMarket = ${await data.interestUpdateRateDeltaForMarket()}`);

  console.log(`\tredeemProxy = ${redeemProxy.address}`);

  const xyt = await (await hre.ethers.getContractFactory('PendleFutureYieldToken')).attach(xytAddress);
  const market = await (await hre.ethers.getContractFactory('PendleAaveMarket')).attach(marketAddress);
  const liqMining = await (await hre.ethers.getContractFactory('PendleAaveLiquidityMining')).attach(liqMiningAddress);

  const xytBalance = await xyt.balanceOf(user);
  console.log(`PendleRouter = ${pendleRouter.address}`);
  const xytInterests = await pendleRouter.callStatic.redeemDueInterests(
    consts.misc.FORGE_AAVE,
    usdtAaveContract.address,
    EXPIRY,
    user
  );
  const lpInterests = await pendleRouter.callStatic.redeemLpInterests(marketAddress, user);
  const lpAmount = await market.balanceOf(user);
  const lpStaked = await liqMining.balances(EXPIRY, user);
  const rewardsPending = await liqMining.callStatic.redeemRewards(EXPIRY, user);
  const stakedLpInterests = await liqMining.callStatic.redeemLpInterests(EXPIRY, user);

  const redeemResults = await redeemProxy.callStatic.redeem(
    [xytAddress],
    [marketAddress],
    [liqMiningAddress],
    [EXPIRY],
    0
  );

  console.log(`user xyt balance = ${xytBalance}`);
  console.log(`xytInterests (from Router) = ${xytInterests}`);
  console.log(`lpInterests (from Router) = ${lpInterests}`);
  console.log(`interests from redeemProxy = ${JSON.stringify(redeemResults)}`);
  console.log(`lp amount of user = ${lpAmount}`);
  console.log(`lp staked of user = ${lpStaked}`);
  console.log(`rewards pending of user = ${rewardsPending}`);
  console.log(`staked lp interests of user = ${stakedLpInterests}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
