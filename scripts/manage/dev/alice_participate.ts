import hre from 'hardhat';
// import fs from 'fs';
import path from 'path';
import { BigNumber as BN } from 'ethers';
import { devConstants } from '../../helpers/constants';
import { getDeployment, getContractFromDeployment } from '../../helpers/deployHelpers';

async function main() {
  const [alice] = await hre.ethers.getSigners();
  const network = hre.network.name;
  const filePath = path.resolve(__dirname, `../../../deployments/mainnet.json`);
  if (network != 'development') {
    console.log(`\tThis script is for funding accounts in development !`);
    process.exit(1);
  }
  let consts = devConstants;

  const deployment = getDeployment(filePath);
  // const ONE_E_18 = BN.from(10).pow(18);
  const INITIAL_USDC_AMOUNT = BN.from(3000000e6).div(3);
  // const INITIAL_AUSDC_AMOUNT = BN.from(3000000e6).div(3);
  const INITIAL_CDAI_AMOUNT = BN.from(30000000e8).div(3);
  const EXPIRY = BN.from(1672272000);

  const router = await getContractFromDeployment(hre, deployment, 'PendleRouter');
  // tokenize yield
  const aUSDC = await hre.ethers.getContractAt('IERC20', consts.tokens.AUSDC.address);
  const cDAI = await hre.ethers.getContractAt('IERC20', consts.tokens.CDAI.address);
  const USDC = await hre.ethers.getContractAt('IERC20', consts.tokens.USDC.address);
  await aUSDC.approve(router.address, consts.common.MAX_ALLOWANCE);
  await cDAI.approve(router.address, consts.common.MAX_ALLOWANCE);
  await USDC.approve(router.address, consts.common.MAX_ALLOWANCE);
  // console.log(`\t aUSDC balance of alice = ${aUSDC.balanceOf()}`)
  await router.tokenizeYield(
    consts.common.FORGE_AAVE_V2,
    consts.tokens.USDC.address,
    EXPIRY,
    INITIAL_USDC_AMOUNT.div(2),
    alice.address
  );
  console.log(`\t tokenized aUSDC`);

  await router.tokenizeYield(
    consts.common.FORGE_COMPOUND,
    consts.tokens.DAI.address,
    EXPIRY,
    INITIAL_CDAI_AMOUNT.div(2),
    alice.address
  );
  console.log(`\t tokenized cDAI`);

  const ytDai = await hre.ethers.getContractAt(
    'IERC20',
    deployment.yieldContracts.CompoundV2.DAI.expiries[EXPIRY.toString()].XYT
  );
  const ytDaiBalance = await ytDai.balanceOf(alice.address);
  console.log(`\t YT-cDAI balance of alice = ${ytDaiBalance}`);

  // add market liquidity dual
  await router.addMarketLiquidityDual(
    consts.common.MARKET_FACTORY_AAVE,
    deployment.yieldContracts.AaveV2.USDC.expiries[EXPIRY.toString()].XYT,
    consts.tokens.USDC.address,
    INITIAL_USDC_AMOUNT.div(4),
    INITIAL_USDC_AMOUNT.div(10),
    0,
    0
  );

  await router.addMarketLiquidityDual(
    consts.common.MARKET_FACTORY_COMPOUND,
    ytDai.address,
    consts.tokens.USDC.address,
    ytDaiBalance.div(2),
    INITIAL_USDC_AMOUNT.div(10),
    0,
    0
  );

  console.log(`\t added market liquidity`);
  const aMarket = await hre.ethers.getContractAt(
    'IPendleMarket',
    deployment.yieldContracts.AaveV2.USDC.expiries[EXPIRY.toString()].markets.USDC
  );
  const cMarket = await hre.ethers.getContractAt(
    'IPendleMarket',
    deployment.yieldContracts.CompoundV2.DAI.expiries[EXPIRY.toString()].markets.USDC
  );
  const aLpBalance = await aMarket.balanceOf(alice.address);
  const cLpBalance = await cMarket.balanceOf(alice.address);
  console.log(`\taLpBalance = ${aLpBalance}`);
  console.log(`\tcLpBalance = ${cLpBalance}`);

  // stake
  const aLM = await hre.ethers.getContractAt(
    'IPendleLiquidityMining',
    deployment.yieldContracts.AaveV2.USDC.PendleLiquidityMining.USDC
  );
  const cLM = await hre.ethers.getContractAt(
    'IPendleLiquidityMining',
    deployment.yieldContracts.CompoundV2.DAI.PendleLiquidityMining.USDC
  );
  await aMarket.approve(aLM.address, consts.common.MAX_ALLOWANCE);
  await cMarket.approve(cLM.address, consts.common.MAX_ALLOWANCE);

  await aLM.stake(EXPIRY, aLpBalance.div(2));
  await cLM.stake(EXPIRY, cLpBalance.div(2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
