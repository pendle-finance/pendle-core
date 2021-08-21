const hre = require('hardhat');
import fs from 'fs';
import path from 'path';
import { utils, BigNumber as BN } from 'ethers';
import { mintAaveV2Token, mintCompoundToken, mint, tokens } from '../../test/helpers';
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
  console.log(
    `===== [NOTICE] =======     deployer account must have at least ${UNDERLYING_YIELD_TOKEN_TO_SEED} aUSDT v1`
  );
  console.log(
    `===== [NOTICE] =======     deployer account must have at least ${UNDERLYING_YIELD_TOKEN_TO_SEED} aUSDT v2`
  );
  console.log(`===== [NOTICE] =======     deployer account must have at least ${UNDERLYING_YIELD_TOKEN_TO_SEED} cUSDT`);
  console.log(`===== [NOTICE] =======     deployer account must have at least ${BASE_TOKEN_TO_SEED.mul(2)} USDT`);

  let expiry = consts.common.TEST_EXPIRY;
  if (process.env.EXPIRY != null) {
    expiry = BN.from(process.env.EXPIRY);
    console.log(`==== [NOTICE] =======  We are taking the expiry set by ENV, ${expiry}`);
  } else {
    console.log(`==== [NOTICE] =======  We are taking the default expiry = ${expiry}`);
  }

  console.log(`\n\tNetwork = ${network}, deployer = ${deployer.address}`);
  console.log(`\tDeployment's filePath = ${filePath}`);

  if (network !== 'kovan' && network !== 'kovantest' && network !== 'development') {
    console.log('[ERROR] Must be for kovan or kovantest network or development');
    process.exit(1);
  }
  if (network == 'development' || network == 'hardhat') {
    // seed USDTs, aUSDTs, cUSDTs
    await mintAaveV2Token(tokens.USDT, deployer, UNDERLYING_YIELD_TOKEN_TO_SEED.div(10 ** 6));
    await mintCompoundToken(tokens.USDT, deployer, UNDERLYING_YIELD_TOKEN_TO_SEED.div(10 ** 6));
    await mint(tokens.USDT, deployer, BASE_TOKEN_TO_SEED.mul(2).div(10 ** 6));
  }

  const existingDeploymentJson = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const deployment = existingDeploymentJson as Deployment;
  // const pendleRouter = await getContractFromDeployment(hre, deployment, 'PendleRouter');

  const usdtCompoundContract = await (
    await hre.ethers.getContractFactory('TestToken')
  ).attach(consts.tokens.USDT_COMPOUND.address);
  const usdcCompoundContract = await (
    await hre.ethers.getContractFactory('TestToken')
  ).attach(consts.tokens.USDC.address);
  const usdtAaveContract = await (
    await hre.ethers.getContractFactory('TestToken')
  ).attach(consts.tokens.USDT_AAVE.address);

  const a2Forge = await hre.ethers.getContractAt('PendleAaveV2Forge', '0xc3352545F91B313A9C102ed8cB0299e61fc17829');
  const a2RewardManager = await hre.ethers.getContractAt('PendleRewardManager', await a2Forge.rewardManager());
  await a2RewardManager.setSkippingRewards(true);
  console.log(`\tSkipped rewards`);

  //Seed contracts for TEST_EXPIRY_3
  // await createNewYieldContractAndMarket(
  //   hre,
  //   deployment,
  //   consts.common.FORGE_AAVE_V2,
  //   consts.common.MARKET_FACTORY_AAVE,
  //   usdtAaveContract,
  //   expiry,
  //   usdtAaveContract
  // );
  // saveDeployment(filePath, deployment);

  // await createNewYieldContractAndMarket(hre, deployment, consts.common.FORGE_AAVE_V2, consts.common.MARKET_FACTORY_AAVE, usdtAaveContract, expiry, usdtAaveContract);
  const pendleCompoundForge = await getContractFromDeployment(hre, deployment, 'PendleCompoundForge');
  const registered = await pendleCompoundForge.underlyingToCToken(usdcCompoundContract.address);
  console.log(
    `cToken registered for USDT = ${registered}, is zero address ? ${registered === consts.common.ZERO_ADDRESS}`
  );
  if (registered === consts.common.ZERO_ADDRESS) {
    await pendleCompoundForge.registerCTokens([usdcCompoundContract.address], [consts.tokens.USDC.compound]);
  }
  // await createNewYieldContractAndMarket(
  //   hre,
  //   deployment,
  //   consts.common.FORGE_COMPOUND,
  //   consts.common.MARKET_FACTORY_COMPOUND,
  //   usdcCompoundContract,
  //   expiry,
  //   usdtCompoundContract // baseToken
  // );
  // saveDeployment(filePath, deployment);

  await mintXytAndBootstrapMarket(
    hre,
    deployment,
    consts,
    consts.common.FORGE_AAVE_V2,
    consts.common.MARKET_FACTORY_AAVE,
    usdtAaveContract,
    expiry,
    usdtAaveContract,
    UNDERLYING_YIELD_TOKEN_TO_SEED,
    BASE_TOKEN_TO_SEED
  );
  // await mintXytAndBootstrapMarket(hre, deployment, consts, consts.common.FORGE_AAVE_V2, consts.common.MARKET_FACTORY_AAVE, usdtAaveContract, expiry, usdtAaveContract, UNDERLYING_YIELD_TOKEN_TO_SEED, BASE_TOKEN_TO_SEED);
  saveDeployment(filePath, deployment);
  // await mintXytAndBootstrapMarket(
  //   hre,
  //   deployment,
  //   consts,
  //   consts.common.FORGE_COMPOUND,
  //   consts.common.MARKET_FACTORY_COMPOUND,
  //   usdcCompoundContract,
  //   expiry,
  //   usdtCompoundContract, // baseToken
  //   UNDERLYING_YIELD_TOKEN_TO_SEED,
  //   BASE_TOKEN_TO_SEED
  // );
  // saveDeployment(filePath, deployment);
  // Setup liquidity mining contracts
  const liqParams = {
    EPOCH_DURATION: consts.common.ONE_DAY.mul(10),
    VESTING_EPOCHS: 4,
    EXPIRIES: [expiry],
    ALLOCATIONS: [consts.common.LIQ_MINING_ALLOCATION_DENOMINATOR],
    REWARDS_PER_EPOCH: [100000, 100000, 100000, 100000, 100000, 100000, 100000].map((a) => consts.misc.ONE_E_18.mul(a)), // = [10000000000, 20000000000, ..]
  };
  await setupLiquidityMining(
    hre,
    deployment,
    consts,
    consts.common.FORGE_AAVE_V2,
    consts.common.MARKET_FACTORY_AAVE,
    'PendleAaveLiquidityMining',
    usdtAaveContract,
    usdtAaveContract,
    liqParams
  );
  saveDeployment(filePath, deployment);
  // await setupLiquidityMining(hre, deployment, consts, consts.common.FORGE_AAVE_V2, consts.common.MARKET_FACTORY_AAVE, "PendleAaveLiquidityMining",usdtAaveContract, usdtAaveContract, liqParams);
  // await setupLiquidityMining(
  //   hre,
  //   deployment,
  //   consts,
  //   consts.common.FORGE_COMPOUND,
  //   consts.common.MARKET_FACTORY_COMPOUND,
  //   'PendleCompoundLiquidityMining',
  //   usdcCompoundContract,
  //   usdtCompoundContract, // baseToken
  //   liqParams
  // );
  // saveDeployment(filePath, deployment);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
