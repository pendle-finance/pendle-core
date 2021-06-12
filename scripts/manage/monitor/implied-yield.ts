import hre from 'hardhat';
import { BigNumber as bigNumber } from 'bignumber.js';

const bN = (s: string): bigNumber => {
  return new bigNumber(s);
};

import { devConstants, kovanConstants } from '../helpers/deployHelpers';
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

  if (network !== 'kovan' && network !== 'kovantest' && network !== 'development') {
    console.log('[ERROR] Must be for kovan or kovantest network or development');
    process.exit(1);
  }

  const usdtCompoundContract = await hre.ethers.getContractAt('TestToken', consts.tokens.USDT_COMPOUND.address);
  // const usdtAaveContract = await hre.ethers.getContractAt('IERC20', consts.tokens.USDT_AAVE.address);

  const xytAddress = '0x55c9bcd1327477541c31d80366369505f8e24bde'; //XYT Compound USDT 28JUL2021

  const marketAddress = '0xD992e0F45BE5C403bc0FDF7EFBA29C9014fF3807'; // XYT-cUSDT-28JUL2021 vs USDT market
  const EXPIRY = 1627430400; // 28JUL2021

  // const data = await getContractFromDeployment(hre, deployment, 'PendleData');
  const xyt = await hre.ethers.getContractAt('PendleFutureYieldToken', xytAddress);
  const market = await hre.ethers.getContractAt('PendleAaveMarket', marketAddress);
  const forgeAddress = await xyt.forge();
  const compoundForge = await hre.ethers.getContractAt('PendleCompoundForge', forgeAddress);
  const xytTokenDecimal = await xyt.decimals(); // should be 8 for xyt-cUSDT
  const baseTokenDecimal = await usdtCompoundContract.decimals(); // should be 6 for USDT
  const underlyingAssetDecimal = await usdtCompoundContract.decimals(); // should be 6 for USDT. Note that this just happens to be the same as the baseToken

  // Step 1:
  // if for Aave, it will always be 1e18
  // since this is Compound, its the initialRate()
  const principalPerXYTRawScaled1e18 = await compoundForge.initialRate(usdtCompoundContract.address);
  console.log(`Step 1: principalPerXYTRawScaled1e18 = ${principalPerXYTRawScaled1e18}`);

  // Step 2:
  const principalPerXYT = bN(principalPerXYTRawScaled1e18.toString())
    .times(bN('10').pow(xytTokenDecimal - underlyingAssetDecimal))
    .div(bN('10').pow(18));
  console.log(`Step 2: principalPerXYT = ${principalPerXYT}`);

  // Step 3:
  const underlyingPrice = 1; // USDT price is $1
  const baseTokenPrice = 1; // USDT price is $1. This just happens to be the same as the underlyingPrice
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
  const yAnnum = ((p.toNumber() / (1 - p.toNumber())) * 365) / daysLeft;
  const yAnnumPercentage = yAnnum * 100;
  console.log(`Step 5: yAnnum = ${yAnnum} = ${yAnnumPercentage} %`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
