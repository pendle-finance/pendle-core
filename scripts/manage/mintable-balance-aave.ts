const hre = require('hardhat');
import { BigNumber as bigNumber } from 'bignumber.js';

const bN = (s: string): bigNumber => {
  return new bigNumber(s);
};

import { devConstants, kovanConstants } from '../helpers/deployHelpers';
async function main() {
  // const [deployer] = await hre.ethers.getSigners();
  const network = hre.network.name;
  // const filePath = path.resolve(__dirname, `../../deployments/${network}.json`);
  let consts: any;
  if (network == 'kovan' || network == 'kovantest') {
    consts = kovanConstants;
  } else {
    consts = devConstants;
  }

  console.log(`\n\tNetwork = ${network}`);

  // const USDT = await hre.ethers.getContractAt('ICToken', consts.tokens.USDT.address);
  // The underlying yield bearing asset for the xyt
  const aUSDT = await hre.ethers.getContractAt('IERC20', consts.tokens.AUSDT.address);
  // the underlying asset
  const USDT_ADDRESS = consts.tokens.USDT_AAVE.address;
  const lendingPool = await hre.ethers.getContractAt('IAaveV2LendingPool', consts.misc.AAVE_V2_LENDING_POOL_ADDRESS);

  // Joseph account which already has a borrow position of 100 USDT
  // and a collateral of 200 USDT
  const user = '0xE8A4095437dd20a01e66115dE33164eBCEA9B09a';

  console.log(`\t aUSDT address = ${aUSDT.address}`);
  console.log(`\t lendingPool address = ${lendingPool.address}`);
  console.log(`\t user address = ${user}`);

  const ethPrice = bN('2000'); // hardcoded
  console.log(`Step 0.9: eth price  =${ethPrice}`);

  const { availableBorrowsETH } = await lendingPool.getUserAccountData(user);
  console.log(`Step 1 - part 1: availableBorrowsETH = ${availableBorrowsETH}`);
  const liquidity = bN(availableBorrowsETH.toString()).times(ethPrice).div(bN('10').pow(18));
  console.log(`Step 1 - part 2: liquidity = ${liquidity}`);

  const { configuration } = await lendingPool.getReserveData(USDT_ADDRESS);
  const assetLtvScaled10000 = bN(configuration.data.mod(65536).toString());
  console.log(`Step 2: assetLtvScaled10000 = ${assetLtvScaled10000}`);

  const underlyingAssetPrice = bN('1.0');
  console.log(`Step 3: underlyingAssetPrice = ${underlyingAssetPrice}`);

  const underlyingDecimals = 6; // hardcoded for aUSDT
  console.log(`Step 4: underlyingDecimals = ${underlyingDecimals}`);

  const mintableBalanceCalculated = liquidity.times(10000).div(assetLtvScaled10000).div(underlyingAssetPrice);
  const mintableBalanceRawCalculated = mintableBalanceCalculated.times(bN('10').pow(underlyingDecimals));
  console.log(`Step 5: mintableBalanceCalculated = ${mintableBalanceCalculated}`);
  console.log(`Step 5: mintableBalanceRawCalculated = ${mintableBalanceRawCalculated}`);
  const aTokenBalance = await aUSDT.balanceOf(user);
  console.log(`\t aToken balance of user = ${aTokenBalance}`);
  const mintableBalanceRaw = bigNumber.min(bN(aTokenBalance.toString()), mintableBalanceRawCalculated);
  console.log(`Step 5: mintableBalanceRaw = ${mintableBalanceRaw}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
