const hre = require('hardhat');
import { BigNumber as bigNumber } from 'bignumber.js';

const bN = (s: string): bigNumber => {
  return new bigNumber(s);
};

import { devConstants, kovanConstants } from '../../helpers/constants';
async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = hre.network.name;
  let consts: any;
  if (network == 'kovan' || network == 'kovantest') {
    consts = kovanConstants;
  } else {
    consts = devConstants;
  }

  console.log(`\n\tNetwork = ${network}, deployer = ${deployer.address}`);

  const usdtCompoundContract = await hre.ethers.getContractAt('TestToken', consts.tokens.USDT_COMPOUND.address);
  // const usdtAaveContract = await hre.ethers.getContractAt('IERC20', consts.tokens.USDT_AAVE.address);

  // const xytAddress = '0x1C5F59Efb97bd1cF55853745507EF7093d6d64d4'; //XYT Compound USDT 28JUL2021
  // const xytAddress = '0x1C5F59Efb97bd1cF55853745507EF7093d6d64d4'; //XYT ETHUSDC-SLP 2022
  const xytAddress = '0xa1F84fd89C96E2FCC783f641Ea07C661d3E53E55'; //XYT ETHUSDC-SLP 2022

  // const marketAddress = '0xD992e0F45BE5C403bc0FDF7EFBA29C9014fF3807'; // XYT-cUSDT-28JUL2021 vs USDT market
  // const marketAddress = '0x68Fc791aBD6339C064146ddC9506774aA142EfBe'; // XYT ETHUSDC-SLP 2022 vs USDC market
  const marketAddress = '0x4835F1F01102eA3C033aE193ec6Ec63961863335'; // XYT ETHUSDC-SLP 2022 vs USDC market
  const EXPIRY = 1672272000; // 28JUL2021

  // const data = await getContractFromDeployment(hre, deployment, 'PendleData');
  const xyt = await hre.ethers.getContractAt('PendleFutureYieldToken', xytAddress);
  const market = await hre.ethers.getContractAt('PendleAaveMarket', marketAddress);
  const forgeAddress = await xyt.forge();
  // const forge = await hre.ethers.getContractAt('PendleCompoundForge', forgeAddress);
  const forge = await hre.ethers.getContractAt('PendleSushiswapSimpleForge', forgeAddress);
  const xytTokenDecimal = await xyt.decimals(); // should be 8 for xyt-cUSDT
  const baseTokenDecimal = 18; // should be 6 for USDT
  const underlyingAssetDecimal = 18; // should be 6 for USDT. Note that this just happens to be the same as the baseToken

  // Step 1:
  // if for Aave, it will always be 1e18
  // since this is Compound, its the initialRate()
  // const principalPerXYTRawScaled1e18 = await forge.initialRate(usdtCompoundContract.address);
  // const principalPerXYTRawScaled1e18 = await forge.initialRate(usdtCompoundContract.address);
  // console.log(`Step 1: principalPerXYTRawScaled1e18 = ${principalPerXYTRawScaled1e18}`);

  // Step 2:
  // const principalPerXYT = bN(principalPerXYTRawScaled1e18.toString())
  //   .times(bN('10').pow(xytTokenDecimal - underlyingAssetDecimal))
  //   .div(bN('10').pow(18));
  const principalPerXYT = bN('1');
  console.log(`Step 2: principalPerXYT = ${principalPerXYT}`);

  // Step 3:
  // const underlyingPrice = 160e6; // USDT price is $1
  const underlyingPrice = 77; // USDT price is $1
  const baseTokenPrice = 0.44; // USDT price is $1. This just happens to be the same as the underlyingPrice
  const reserveData = await market.getReserves();
  const xytBalance = bN(reserveData.xytBalance.toString());
  const xytWeight = bN(reserveData.xytWeight.toString());
  const tokenBalance = bN(reserveData.tokenBalance.toString());
  const tokenWeight = bN(reserveData.tokenWeight.toString());
  const xytPriceInBaseToken = tokenBalance
    .times(xytWeight)
    .div(xytBalance.times(tokenWeight))
    .times(bN('10').pow(xytTokenDecimal - baseTokenDecimal));
  const xytPrice = xytPriceInBaseToken.times(baseTokenPrice);
  console.log(
    `Step 3: underlyingPrice=${underlyingPrice} xytPriceInBaseToken = ${xytPriceInBaseToken} xytPrice=${xytPrice}`
  );

  // Step 3.1:
  const p = xytPrice.div(principalPerXYT.times(underlyingPrice));
  console.log(`Step 3.1: p = ${p}`);

  // Step 4:
  const daysLeft = (EXPIRY - new Date().getTime() / 1000) / (24 * 3600);
  console.log(`Step 4: daysLeft = ${daysLeft}`);

  // Step 5:
  const yAnnum = (p.toNumber() / (1 - p.toNumber()) + 1) ** (365 / daysLeft) - 1;
  const yAnnumPercentage = yAnnum * 100;
  console.log(`Step 5: yAnnum = ${yAnnum} = ${yAnnumPercentage} %`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
