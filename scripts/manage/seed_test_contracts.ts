const hre = require("hardhat");
import fs from "fs";
import path from "path";
import { utils, BigNumber as BN } from "ethers";
import { mintAaveToken, mintCompoundToken, mint } from "../../test/helpers";
const { execSync } = require("child_process");

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
} from "../helpers/deployHelpers";
async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = hre.network.name;
  const filePath = path.resolve(__dirname, `../../deployments/${network}.json`);
  let consts: any;
  if (network == "kovan" || network == "kovantest") {
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
  console.log(
    `===== [NOTICE] =======     deployer account must have at least ${UNDERLYING_YIELD_TOKEN_TO_SEED} cUSDT`
  );
  console.log(
    `===== [NOTICE] =======     deployer account must have at least ${BASE_TOKEN_TO_SEED.mul(
      2
    )} USDT`
  );

  let expiry = consts.misc.TEST_EXPIRY_3;
  if (process.env.EXPIRY != null) {
    expiry = BN.from(process.env.EXPIRY);
    console.log(
      `==== [NOTICE] =======  We are taking the expiry set by ENV, ${expiry}`
    );
  } else {
    console.log(
      `==== [NOTICE] =======  We are taking the default expiry = ${expiry}`
    );
  }

  console.log(`\n\tNetwork = ${network}, deployer = ${deployer.address}`);
  console.log(`\tDeployment's filePath = ${filePath}`);

  if (
    network !== "kovan" &&
    network !== "kovantest" &&
    network !== "development"
  ) {
    console.log(
      "[ERROR] Must be for kovan or kovantest network or development"
    );
    process.exit(1);
  }
  if (network == "development" || network == "hardhat") {
    // seed USDTs, aUSDTs, cUSDTs
    await mintAaveToken(
      hre.ethers,
      consts.tokens.USDT_AAVE,
      deployer,
      UNDERLYING_YIELD_TOKEN_TO_SEED.div(10 ** 6),
      true
    );
    await mintAaveToken(
      hre.ethers,
      consts.tokens.USDT_AAVE,
      deployer,
      UNDERLYING_YIELD_TOKEN_TO_SEED.div(10 ** 6),
      false
    );
    await mintCompoundToken(
      hre.ethers,
      consts.tokens.USDT_COMPOUND,
      deployer,
      UNDERLYING_YIELD_TOKEN_TO_SEED.div(10 ** 6)
    );
    await mint(
      hre.ethers,
      consts.tokens.USDT_COMPOUND,
      deployer,
      BASE_TOKEN_TO_SEED.mul(2).div(10 ** 6)
    );
  }

  const existingDeploymentJson = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const deployment = existingDeploymentJson as Deployment;

  const pendleRouter = await getContractFromDeployment(
    hre,
    deployment,
    "PendleRouter"
  );

  const usdtCompoundContract = await (
    await hre.ethers.getContractFactory("TestToken")
  ).attach(consts.tokens.USDT_COMPOUND.address);
  const usdtAaveContract = await (
    await hre.ethers.getContractFactory("TestToken")
  ).attach(consts.tokens.USDT_AAVE.address);

  //Seed contracts for TEST_EXPIRY_3
  await createNewYieldContractAndMarket(
    hre,
    deployment,
    consts.misc.FORGE_AAVE,
    consts.misc.MARKET_FACTORY_AAVE,
    usdtAaveContract,
    expiry,
    usdtAaveContract
  );
  saveDeployment(filePath, deployment);

  // await createNewYieldContractAndMarket(hre, deployment, consts.misc.FORGE_AAVE_V2, consts.misc.MARKET_FACTORY_AAVE, usdtAaveContract, expiry, usdtAaveContract);
  const pendleCompoundForge = await getContractFromDeployment(
    hre,
    deployment,
    "PendleCompoundForge"
  );
  const registered = await pendleCompoundForge.underlyingToCToken(
    usdtCompoundContract.address
  );
  console.log(
    `cToken registered for USDT = ${registered}, is zero address ? ${
      registered === consts.misc.ZERO_ADDRESS
    }`
  );
  if (registered === consts.misc.ZERO_ADDRESS) {
    await pendleCompoundForge.registerCTokens(
      [usdtCompoundContract.address],
      [consts.tokens.USDT_COMPOUND.compound]
    );
  }
  await createNewYieldContractAndMarket(
    hre,
    deployment,
    consts.misc.FORGE_COMPOUND,
    consts.misc.MARKET_FACTORY_COMPOUND,
    usdtCompoundContract,
    expiry,
    usdtCompoundContract
  );
  saveDeployment(filePath, deployment);

  await mintXytAndBootstrapMarket(
    hre,
    deployment,
    consts,
    consts.misc.FORGE_AAVE,
    consts.misc.MARKET_FACTORY_AAVE,
    usdtAaveContract,
    expiry,
    usdtAaveContract,
    UNDERLYING_YIELD_TOKEN_TO_SEED,
    BASE_TOKEN_TO_SEED
  );
  // await mintXytAndBootstrapMarket(hre, deployment, consts, consts.misc.FORGE_AAVE_V2, consts.misc.MARKET_FACTORY_AAVE, usdtAaveContract, expiry, usdtAaveContract, UNDERLYING_YIELD_TOKEN_TO_SEED, BASE_TOKEN_TO_SEED);
  saveDeployment(filePath, deployment);
  await mintXytAndBootstrapMarket(
    hre,
    deployment,
    consts,
    consts.misc.FORGE_COMPOUND,
    consts.misc.MARKET_FACTORY_COMPOUND,
    usdtCompoundContract,
    expiry,
    usdtCompoundContract,
    UNDERLYING_YIELD_TOKEN_TO_SEED,
    BASE_TOKEN_TO_SEED
  );
  saveDeployment(filePath, deployment);
  // Setup liquidity mining contracts
  const liqParams = {
    EPOCH_DURATION: consts.misc.ONE_DAY.mul(10),
    VESTING_EPOCHS: 4,
    EXPIRIES: [expiry],
    ALLOCATIONS: [consts.misc.LIQ_MINING_ALLOCATION_DENOMINATOR],
    REWARDS_PER_EPOCH: [
      100000,
      100000,
      100000,
      100000,
      100000,
      100000,
      100000,
    ].map((a) => consts.misc.ONE_E_18.mul(a)), // = [10000000000, 20000000000, ..]
  };
  await setupLiquidityMining(
    hre,
    deployment,
    consts,
    consts.misc.FORGE_AAVE,
    consts.misc.MARKET_FACTORY_AAVE,
    "PendleAaveLiquidityMining",
    usdtAaveContract,
    usdtAaveContract,
    liqParams
  );
  saveDeployment(filePath, deployment);
  // await setupLiquidityMining(hre, deployment, consts, consts.misc.FORGE_AAVE_V2, consts.misc.MARKET_FACTORY_AAVE, "PendleAaveLiquidityMining",usdtAaveContract, usdtAaveContract, liqParams);
  await setupLiquidityMining(
    hre,
    deployment,
    consts,
    consts.misc.FORGE_COMPOUND,
    consts.misc.MARKET_FACTORY_COMPOUND,
    "PendleCompoundLiquidityMining",
    usdtCompoundContract,
    usdtCompoundContract,
    liqParams
  );
  saveDeployment(filePath, deployment);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
