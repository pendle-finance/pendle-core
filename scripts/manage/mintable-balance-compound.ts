const hre = require('hardhat');
import fs from 'fs';
import path from 'path';
import { utils, BigNumber as BN } from 'ethers';
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

  // const USDC = await hre.ethers.getContractAt('ICToken', consts.tokens.USDC.address);
  const cUSDC = await hre.ethers.getContractAt('ICToken', consts.tokens.USDC.compound);
  const comptroller = await hre.ethers.getContractAt('IComptroller', consts.misc.COMPOUND_COMPTROLLER_ADDRESS);

  // Joseph account which already has a borrow position of 100 USDT
  // and a collateral of 200 USDC
  const user = '0xE8A4095437dd20a01e66115dE33164eBCEA9B09a';

  console.log(`\t cUSDC address = ${cUSDC.address}`);
  console.log(`\t comptroller address = ${comptroller.address}`);
  console.log(`\t user address = ${user}`);

  const { liquidity } = await comptroller.getAccountLiquidity(user);
  const liquidityScaled1e18 = liquidity;
  console.log(`Step 1: liquidity = ${liquidityScaled1e18}`);

  const { collateralFactorMantissa } = await comptroller.markets(cUSDC.address);
  console.log(`Step 2: collateralFactorMantissa = ${collateralFactorMantissa}`);

  const exchangeRate = await cUSDC.callStatic.exchangeRateCurrent();
  console.log(`Step 3: exchangeRate = ${exchangeRate}`);

  const underlyingAssetPrice = 1;
  console.log(`Step 4: underlyingAssetPrice = ${underlyingAssetPrice}`);

  const underlyingDecimals = consts.tokens.USDC.decimal;
  console.log(`Step 4.1: underlyingDecimals = ${underlyingDecimals}`);
  const cTokenDecimals = await cUSDC.decimals();
  console.log(`Step 4.1: cTokenDecimals = ${cTokenDecimals}`);

  const transferableCollateralScaled1e18 = liquidityScaled1e18
    .mul(consts.misc.ONE_E_18)
    .div(collateralFactorMantissa)
    .div(underlyingAssetPrice);
  console.log(`Step 5: transferableCollateralScaled1e18 = ${transferableCollateralScaled1e18}`);

  const mintableUnderlyingRaw = transferableCollateralScaled1e18
    .mul(BN.from(10).pow(underlyingDecimals))
    .div(consts.misc.ONE_E_18);
  console.log(`Step 6: [calculation] mintableUnderlyingRaw = ${mintableUnderlyingRaw}`);
  const mintableCTokenRawCalculated = mintableUnderlyingRaw.mul(consts.misc.ONE_E_18).div(exchangeRate);
  console.log(`Step 6: mintable cToken (raw, scaled by 10^cTokenDecimals) Calculated = ${mintableCTokenRawCalculated}`);
  const cTokenBalance = await cUSDC.balanceOf(user);
  console.log(`\t cToken balance of user = ${cTokenBalance}`);
  const mintableBalanceRaw = bigNumber.min(bN(cTokenBalance.toString()), bN(mintableCTokenRawCalculated.toString()));
  console.log(`Step 6: mintableBalanceRaw = ${mintableBalanceRaw}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
