const hre = require('hardhat');
import fs from 'fs';
import path from 'path';
import { BigNumber as BN } from 'ethers';
import { BigNumber as bigNumber } from 'bignumber.js';
import PendleRouter from '../../build/artifacts/contracts/core/PendleRouter.sol/PendleRouter.json';

const bN = (s: string): bigNumber => {
  return new bigNumber(s);
};

import { devConstants, kovanConstants, Deployment, getContractFromDeployment } from '../helpers/deployHelpers';
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
  const xytAddress = '0x2618929B23d8d7316D9858BE338F59Ae283646AE';
  // const user = "0xE8A4095437dd20a01e66115dE33164eBCEA9B09a";
  const pendleAddress = '0x0fC57Dc1d42F0EA56A447904bA25104d5584a796';
  // const user = '0xE8A4095437dd20a01e66115dE33164eBCEA9B09a';
  const marketAddress = '0x6eea907c23BE91f0966E59B6E1fc26f3205ED136';

  const liqMiningAddress = '0xaB90D91086C55bdAB4D639d3EF11A3a2A855DB94';
  const EXPIRY = BN.from(1672272000);

  // const data = await getContractFromDeployment(hre, deployment, 'PendleData');

  // const xyt = await (await hre.ethers.getContractFactory('PendleFutureYieldToken')).attach(xytAddress);
  const market = await (await hre.ethers.getContractFactory('PendleAaveMarket')).attach(marketAddress);
  const liqMining = await (
    await hre.ethers.getContractFactory('PendleCompoundLiquidityMining')
  ).attach(liqMiningAddress);
  // const pendle = await (await hre.ethers.getContractFactory('PENDLE')).attach(pendleAddress);

  const epochId = 1;
  // Step 1:
  const totalRewards = await liqMining.totalRewardsForEpoch(epochId);
  console.log(`Step 1: totalRewards (raw, x 1e18 balance) = ${totalRewards}`);

  // Step 2:
  const latestSetting = await liqMining.latestSetting();
  const alloc = await liqMining.allocationSettings(latestSetting.id, EXPIRY);
  const rewardForThisLp = alloc.mul(totalRewards).div(1e9);
  console.log(`Step 2: reward for this Lp for this epoch = ${rewardForThisLp} PENDLE (raw, x 1e18 balance)`);

  // Step 3:
  const { totalStakeLP, lpHolder } = await liqMining.readExpiryData(EXPIRY);
  console.log(`Step 3: totalStakeLP (raw, x 1e18 balance)= ${totalStakeLP}`);

  console.log(`\tLP staked for this expiry (raw, x 1e18 balance) = ${await market.balanceOf(lpHolder)}`);

  // Step 4:
  const pendlePerEpochPerLP = rewardForThisLp.mul(consts.misc.ONE_E_18).div(totalStakeLP);
  console.log(`Step 4: pendlePerEpochPerLP (raw, x 1e18 balance) = ${pendlePerEpochPerLP}`);

  // Step 5:
  const { tokenBalance, tokenWeight } = await market.getReserves();
  const BASE_TOKEN_PRICE = 1; // $1
  const SCALING_FACTOR = BN.from(100000); // multiply with numbers to keep precision;
  const BASE_TOKEN_DECIMALS = 6; // USDT has 6 decimals
  const totalValueOfBaseTokenScaled = SCALING_FACTOR.mul(BASE_TOKEN_PRICE)
    .mul(tokenBalance)
    .div(BN.from(10).pow(BASE_TOKEN_DECIMALS));
  console.log(`\t totalValueOfBaseTokenScaled (scaled by 1e6) = ${totalValueOfBaseTokenScaled}`);

  const totalLpSupply = await market.totalSupply();

  const RONE = BN.from(2).pow(40);
  const totalValueOfMarketScaled = totalValueOfBaseTokenScaled.mul(RONE).div(tokenWeight);
  console.log(`\t totalValueOfmarketScaled (scaled by 1e6) = ${totalValueOfMarketScaled}`);
  const lpPriceScaled = totalValueOfMarketScaled.mul(consts.misc.ONE_E_18).div(totalLpSupply);
  console.log(`Step 5: lpPrice (scaled by 1e6) = ${lpPriceScaled}`);

  // Step 6:
  const PENDLE_PRICE = 2; // $2
  const pendlePriceScaled = BN.from(PENDLE_PRICE).mul(SCALING_FACTOR);
  const aprScaledBy1e18 = pendlePerEpochPerLP.mul(pendlePriceScaled).mul(365).div(lpPriceScaled).div(7);
  console.log(`Step 6: APR (scaled by 1e18) = ${aprScaledBy1e18}`);
  const aprInRatio = aprScaledBy1e18.div(1e10).toNumber() / 1e8;
  console.log(`\t apr in number = ${aprInRatio * 100} %`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
