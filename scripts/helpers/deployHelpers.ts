import { BigNumber as BN, utils } from "ethers";
import fs from "fs";
// export type Token = {
//   address: string;
//   decimal: number;
//   owner?: string;
// };

// type TokenMap = Record<string, Token>;

// export type Constants = {
//   tokens: TokenMap;
//   misc: Record<string, any>;
// };
const ONE_E_18 = BN.from(10).pow(18);

export const devConstants = {
  misc: {
    ONE_E_18,
    DUMMY_GOVERNANCE_ADDRESS: "0xdac17f958d2ee523a2206206994597c13d831ec7",
    AAVE_LENDING_POOL_CORE_ADDRESS:
      "0x3dfd23A6c5E8BbcFc9581d2E864a68feb6a076d3",
    AAVE_LENDING_POOL_ADDRESS: "0x398ec7346dcd622edc5ae82352f02be94c62d119",
    COMPOUND_COMPTROLLER_ADDRESS: "0x3d9819210a31b4961b30ef54be2aed79b9c9cd3b",
    AAVE_V2_LENDING_POOL_ADDRESS: "0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9",
    AAVE_DUMMY_REFERRAL_CODE: 0,
    FORGE_AAVE: utils.formatBytes32String("Aave"),
    MARKET_FACTORY_AAVE: utils.formatBytes32String("Aave"),
    FORGE_AAVE_V2: utils.formatBytes32String("AaveV2"),
    MARKET_FACTORY_AAVE_V2: utils.formatBytes32String("AaveV2"),
    FORGE_COMPOUND: utils.formatBytes32String("Compound"),
    MARKET_FACTORY_COMPOUND: utils.formatBytes32String("Compound"),
    ZERO_BYTES: utils.formatBytes32String(""),
    ZERO_ADDRESS: "0x0000000000000000000000000000000000000000",
    ETH_ADDRESS: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
    MAX_ALLOWANCE: BN.from(2).pow(BN.from(256)).sub(BN.from(1)),
    ONE_DAY: BN.from(86400),
    ONE_MONTH: BN.from(2592000),
    LOCK_NUMERATOR: BN.from(1),
    LOCK_DENOMINATOR: BN.from(180),

    TEST_EXPIRY_3: 1621087200,

    // Pendle token distribution
    INVESTOR_AMOUNT: BN.from(34102839).mul(ONE_E_18),
    ADVISOR_AMOUNT: BN.from(2500000).mul(ONE_E_18),
    TEAM_AMOUNT: BN.from(55000000).mul(ONE_E_18),
    TEAM_INVESTOR_ADVISOR_AMOUNT: BN.from(91602839).mul(ONE_E_18),
    ECOSYSTEM_FUND_TOKEN_AMOUNT: BN.from(50 * 1000000).mul(ONE_E_18),
    PUBLIC_SALES_TOKEN_AMOUNT: BN.from(15897161).mul(ONE_E_18),
    INITIAL_LIQUIDITY_EMISSION: BN.from(1200000).mul(ONE_E_18),
    CONFIG_DENOMINATOR: BN.from(72000000000),
    CONFIG_CHANGES_TIME_LOCK: BN.from(7 * 24 * 3600),
    PENDLE_START_TIME: BN.from(4000000000),
    INITIAL_WEEKLY_EMISSION: BN.from(1200000).mul(ONE_E_18),
    ONE_QUARTER: BN.from(7884000),

    LIQ_MINING_ALLOCATION_DENOMINATOR: 1000000000,
    HIGH_GAS_OVERRIDE: { gasLimit: 80000000 },
  },
  tokens: {
    USDT_AAVE: {
      address: "0xdac17f958d2ee523a2206206994597c13d831ec7",
      decimal: 6,
      owner: "0xC6CDE7C39eB2f0F0095F41570af89eFC2C1Ea828",
      compound: "0xf650c3d88d12db855b8bf7d11be6c55a4e07dcc9",
    },
    USDT_COMPOUND: {
      address: "0xdac17f958d2ee523a2206206994597c13d831ec7",
      decimal: 6,
      owner: "0xC6CDE7C39eB2f0F0095F41570af89eFC2C1Ea828",
      compound: "0xf650c3d88d12db855b8bf7d11be6c55a4e07dcc9",
    },
    WETH: {
      address: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
      decimal: 18,
      compound: "0x4ddc2d193948926d02f9b1fe9e1daa0718270ed5",
    },
    USDC: {
      address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
      decimal: 6,
      compound: "0x39aa39c021dfbae8fac545936693ac917d5e7563",
    },
    AUSDT: {
      address: "0x71fc860F7D3A592A4a98740e39dB31d25db65ae8",
      decimal: 6,
      owner: "0x4188a7dca2757ebc7d9a5bd39134a15b9f3c6402",
    },
  },
};

export const kovanConstants = {
  misc: {
    ONE_E_18,
    AAVE_LENDING_POOL_CORE_ADDRESS:
      "0x95D1189Ed88B380E319dF73fF00E479fcc4CFa45",
    AAVE_LENDING_POOL_ADDRESS: "0x580D4Fdc4BF8f9b5ae2fb9225D584fED4AD5375c",
    AAVE_V2_LENDING_POOL_ADDRESS: "0xE0fBa4Fc209b4948668006B2bE61711b7f465bAe",
    AAVE_DUMMY_REFERRAL_CODE: 0,
    COMPOUND_COMPTROLLER_ADDRESS: "0x5eae89dc1c671724a672ff0630122ee834098657",
    FORGE_AAVE: utils.formatBytes32String("Aave"),
    MARKET_FACTORY_AAVE: utils.formatBytes32String("Aave"),
    FORGE_AAVE_V2: utils.formatBytes32String("AaveV2"),
    MARKET_FACTORY_AAVE_V2: utils.formatBytes32String("AaveV2"),
    FORGE_COMPOUND: utils.formatBytes32String("Compound"),
    MARKET_FACTORY_COMPOUND: utils.formatBytes32String("Compound"),
    ZERO_ADDRESS: "0x0000000000000000000000000000000000000000",
    MAX_ALLOWANCE: BN.from(2).pow(BN.from(256)).sub(BN.from(1)),
    ONE_DAY: BN.from(86400),
    ONE_MONTH: BN.from(2592000),
    TEST_EXPIRY: 1623500719,
    TEST_EXPIRY_2: 1618230319,
    TEST_EXPIRY_3: 1621087200,
    ONE_YEAR: BN.from(31536000),
    LOCK_NUMERATOR: BN.from(1),
    LOCK_DENOMINATOR: BN.from(180),

    // Pendle token distribution
    INVESTOR_AMOUNT: BN.from(34102839).mul(ONE_E_18),
    ADVISOR_AMOUNT: BN.from(2500000).mul(ONE_E_18),
    TEAM_AMOUNT: BN.from(55000000).mul(ONE_E_18),
    TEAM_INVESTOR_ADVISOR_AMOUNT: BN.from(91602839).mul(ONE_E_18),
    ECOSYSTEM_FUND_TOKEN_AMOUNT: BN.from(50 * 1000000).mul(ONE_E_18),
    PUBLIC_SALES_TOKEN_AMOUNT: BN.from(15897161).mul(ONE_E_18),
    INITIAL_LIQUIDITY_EMISSION: BN.from(1200000).mul(ONE_E_18),
    CONFIG_DENOMINATOR: BN.from(72000000000),
    CONFIG_CHANGES_TIME_LOCK: BN.from(7 * 24 * 3600),
    PENDLE_START_TIME: BN.from(4000000000),
    INITIAL_WEEKLY_EMISSION: BN.from(1200000).mul(ONE_E_18),
    ONE_QUARTER: BN.from(7884000),

    LIQ_MINING_ALLOCATION_DENOMINATOR: 1000000000,
    HIGH_GAS_OVERRIDE: { gasLimit: 12500000 },
  },
  tokens: {
    USDT_AAVE: {
      address: "0x13512979ade267ab5100878e2e0f485b568328a4",
      decimal: 6,
      owner: "0xC6CDE7C39eB2f0F0095F41570af89eFC2C1Ea828",
      compound: "0x3f0a0ea2f86bae6362cf9799b523ba06647da018",
    },
    USDT_COMPOUND: {
      address: "0x07de306ff27a2b630b1141956844eb1552b956b5",
      decimal: 6,
      owner: "0xC6CDE7C39eB2f0F0095F41570af89eFC2C1Ea828",
      compound: "0x3f0a0ea2f86bae6362cf9799b523ba06647da018",
    },
    WETH: {
      address: "0xa1c74a9a3e59ffe9bee7b85cd6e91c0751289ebd",
      decimal: 18,
    },
    USDC: {
      address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
      decimal: 6,
      compound: "0x4a92e71227d294f041bd82dd8f78591b75140d63",
    },
    AUSDT: {
      address: "0xA01bA9fB493b851F4Ac5093A324CB081A909C34B",
      decimal: 6,
      // owner: "0x81dfbbaF5011e3b86383f72A24793EE44ea547C5"
    },
  },
};

export interface DeployedContract {
  address: string;
  tx: string;
}

export interface Deployment {
  step: number;
  contracts: Record<string, DeployedContract>;
  variables: Record<string, any>;
  yieldContracts: Record<string, any>;
}

export function validAddress(variableName: string, address?: string): boolean {
  if (address == null || address == undefined) {
    console.log(`\t\t[ERROR] ${variableName} is empty !`);
    return false;
  }

  if (address.length != 42) {
    console.log(
      `\t\t[ERROR] ${variableName} is an invalid address = ${address}`
    );
    return false;
  }

  return true;
}

export async function deploy(
  hre: any,
  deployment: Deployment,
  contractName: string,
  args: any[]
): Promise<any> {
  const contractFactory = await hre.ethers.getContractFactory(contractName);
  const contractObject = await contractFactory.deploy(...args);
  await contractObject.deployed();
  deployment.contracts[contractName] = {
    address: contractObject.address,
    tx: contractObject.deployTransaction.hash,
  };
  console.log(
    `\t[DEPLOYED] ${contractName} deployed to ${contractObject.address}, tx=${contractObject.deployTransaction.hash}`
  );
  return contractObject;
}

export async function getContractFromDeployment(
  hre: any,
  deployment: Deployment,
  contractName: string
): Promise<any> {
  const contractFactory = await hre.ethers.getContractFactory(contractName);
  const contractAddress = deployment.contracts[contractName].address;
  if (!validAddress(contractName, contractAddress)) {
    console.log(`[Error] invalid contract address for ${contractName}`);
    process.exit(1);
  }
  return await contractFactory.attach(contractAddress);
}

export async function createNewYieldContractAndMarket(
  hre: any,
  deployment: Deployment,
  forgeId: string,
  marketFactoryId: string,
  underlyingAssetContract: any,
  expiry: number,
  baseTokenContract: any
) {
  const pendleRouter = await getContractFromDeployment(
    hre,
    deployment,
    "PendleRouter"
  );
  const pendleData = await getContractFromDeployment(
    hre,
    deployment,
    "PendleData"
  );

  const underlyingAssetSymbol = await underlyingAssetContract.symbol();
  const baseTokenSymbol = await baseTokenContract.symbol();
  const forgeIdString = utils.parseBytes32String(forgeId);

  console.log(
    `\tCreating new yield contracts and market for ${forgeIdString}, underlyingAsset-${baseTokenSymbol}, expiry=${expiry}, baseToken-${baseTokenSymbol}`
  );

  await pendleRouter.newYieldContracts(
    forgeId,
    underlyingAssetContract.address,
    expiry
  );
  console.log("\t\tCreated new yield contract");
  const xytAddress = await pendleData.xytTokens(
    forgeId,
    underlyingAssetContract.address,
    expiry
  );
  const otAddress = await pendleData.otTokens(
    forgeId,
    underlyingAssetContract.address,
    expiry
  );

  await pendleRouter.createMarket(
    marketFactoryId,
    xytAddress,
    baseTokenContract.address
  );
  console.log("\t\tCreated new market");
  const marketAddress = await pendleData.getMarket(
    marketFactoryId,
    xytAddress,
    baseTokenContract.address
  );

  //TODO: remove after fixing reentrancy
  await pendleData.setReentrancyWhitelist([marketAddress], [true]);
  console.log("\t\tSet reentrancy whitelist");

  deployment.yieldContracts[forgeIdString] = {};
  deployment.yieldContracts[forgeIdString][underlyingAssetSymbol] = {
    expiries: {},
    PendleLiquidityMining: {},
  };
  deployment.yieldContracts[forgeIdString][underlyingAssetSymbol].expiries[
    expiry
  ] = {
    XYT: xytAddress,
    OT: otAddress,
    markets: {},
  };
  deployment.yieldContracts[forgeIdString][underlyingAssetSymbol].expiries[
    expiry
  ].markets[baseTokenSymbol] = marketAddress;
}

export async function mintXytAndBootstrapMarket(
  hre: any,
  deployment: Deployment,
  consts: any,
  forgeId: string,
  marketFactoryId: string,
  underlyingAssetContract: any,
  expiry: number,
  baseTokenContract: any,
  underlyingYieldTokenAmount: BN,
  baseTokenAmount: BN
) {
  const [deployer] = await hre.ethers.getSigners();
  const pendleRouter = await getContractFromDeployment(
    hre,
    deployment,
    "PendleRouter"
  );
  const pendleData = await getContractFromDeployment(
    hre,
    deployment,
    "PendleData"
  );

  const underlyingAssetSymbol = await underlyingAssetContract.symbol();
  const baseTokenSymbol = await baseTokenContract.symbol();
  const forgeIdString = utils.parseBytes32String(forgeId);

  console.log(
    `\tMinting xyt and bootstrapping market for ${forgeIdString}, underlyingAsset-${baseTokenSymbol}, expiry=${expiry}, baseToken-${baseTokenSymbol}, a/cToken amount=${underlyingYieldTokenAmount}, baseTokenAmount=${baseTokenAmount}`
  );
  const xytAddress = await pendleData.xytTokens(
    forgeId,
    underlyingAssetContract.address,
    expiry
  );
  const otAddress = await pendleData.otTokens(
    forgeId,
    underlyingAssetContract.address,
    expiry
  );
  const marketAddress = await pendleData.getMarket(
    marketFactoryId,
    xytAddress,
    baseTokenContract.address
  );

  const xytContract = await (
    await hre.ethers.getContractFactory("PendleFutureYieldToken")
  ).attach(xytAddress);

  const underlyingYieldTokenAddress = await xytContract.underlyingYieldToken();
  const underlyingYieldTokenContract = await (
    await hre.ethers.getContractFactory("TestToken")
  ).attach(underlyingYieldTokenAddress);

  console.log(
    `\ta/cToken balance = ${await underlyingYieldTokenContract.balanceOf(
      deployer.address
    )}`
  );
  console.log(
    `\tbaseToken balance = ${await baseTokenContract.balanceOf(
      deployer.address
    )}`
  );

  const initialXytBalance = await xytContract.balanceOf(deployer.address);
  let tx = await underlyingYieldTokenContract.approve(
    pendleRouter.address,
    consts.misc.MAX_ALLOWANCE
  );
  await hre.ethers.provider.waitForTransaction(tx.hash);
  console.log(`\tapproved a/cToken contract for pendleRouter`);
  await pendleRouter.tokenizeYield(
    forgeId,
    underlyingAssetContract.address,
    expiry,
    underlyingYieldTokenAmount,
    deployer.address
  );
  console.log(`\tTokenized yield`);
  const xytMinted = (await xytContract.balanceOf(deployer.address)).sub(
    initialXytBalance
  );

  console.log(`\t\tMinted ${xytMinted} XYTs`);
  await xytContract.approve(pendleRouter.address, consts.misc.MAX_ALLOWANCE);
  const baseTokenAllowance = await baseTokenContract.allowance(
    deployer.address,
    pendleRouter.address
  );
  if (baseTokenAllowance.lt(baseTokenAmount)) {
    await baseTokenContract.approve(
      pendleRouter.address,
      consts.misc.MAX_ALLOWANCE
    );
  }

  await pendleRouter.bootstrapMarket(
    marketFactoryId,
    xytAddress,
    baseTokenContract.address,
    xytMinted,
    baseTokenAmount
  );
  console.log(
    `\t\tBootstrapped market with ${xytMinted}xyts and ${baseTokenAmount} ${baseTokenSymbol}`
  );
}

export async function setupLiquidityMining(
  hre: any,
  deployment: Deployment,
  consts: any,
  forgeId: string,
  marketFactoryId: string,
  liqMiningContractName: string,
  underlyingAssetContract: any,
  baseTokenContract: any,
  liqParams: any
) {
  const [deployer] = await hre.ethers.getSigners();
  const pendleRouter = await getContractFromDeployment(
    hre,
    deployment,
    "PendleRouter"
  );
  // const pendleData = await getContractFromDeployment(hre, deployment, "PendleData");

  const underlyingAssetSymbol = await underlyingAssetContract.symbol();
  const baseTokenSymbol = await baseTokenContract.symbol();
  const forgeIdString = utils.parseBytes32String(forgeId);

  console.log(
    `\tSetting up liquidity mining for ${forgeIdString}, underlyingAsset-${baseTokenSymbol}, baseToken-${baseTokenSymbol}`
  );
  const pendle = await getContractFromDeployment(hre, deployment, "PENDLE");

  const liqMiningContract = await deploy(
    hre,
    deployment,
    liqMiningContractName,
    [
      deployer.address,
      pendle.address,
      pendleRouter.address,
      marketFactoryId,
      forgeId,
      underlyingAssetContract.address,
      baseTokenContract.address,
      new Date().getTime() + 3600, // starts in 1 hour
      liqParams.EPOCH_DURATION,
      liqParams.VESTING_EPOCHS,
    ]
  );

  deployment.yieldContracts[forgeIdString][
    underlyingAssetSymbol
  ].PendleLiquidityMining[baseTokenSymbol] = liqMiningContract.address;
  await pendle.approve(liqMiningContract.address, consts.misc.MAX_ALLOWANCE);
  await liqMiningContract.setAllocationSetting(
    liqParams.EXPIRIES,
    liqParams.ALLOCATIONS
  );
  await liqMiningContract.fund(liqParams.REWARDS_PER_EPOCH);
  console.log(`\t\tFunded liq-mining contract`);
}

export function saveDeployment(filePath: string, deployment: Deployment) {
  fs.writeFileSync(filePath, JSON.stringify(deployment, null, "  "), "utf8");
}
