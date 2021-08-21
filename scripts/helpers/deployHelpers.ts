import { BigNumber as BN, utils } from 'ethers';
import fs from 'fs';

import { common as commonConsts } from './constants';

export interface DeployedContract {
  address: string;
  tx: string;
}

export interface Deployment {
  step: number;
  contracts: Record<string, DeployedContract>;
  variables: Record<string, any>;
  yieldContracts: Record<string, any>;
  liquidityMiningV2Contracts: Record<string, any>[];
  directories: Record<string, any>;
}

export function validAddress(variableName: string, address?: string): boolean {
  if (address == null || address == undefined) {
    console.log(`\t\t[ERROR] ${variableName} is empty !`);
    return false;
  }

  if (address.length != 42) {
    console.log(`\t\t[ERROR] ${variableName} is an invalid address = ${address}`);
    return false;
  }

  return true;
}

export async function deploy(hre: any, deployment: Deployment, contractName: string, args: any[]): Promise<any> {
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

export async function deployWithName(
  hre: any,
  deployment: Deployment,
  contractType: string,
  contractName: string,
  args: any[]
): Promise<any> {
  const contractFactory = await hre.ethers.getContractFactory(contractType);
  const contractObject = await contractFactory.deploy(...args);
  await contractObject.deployed();
  if (contractName != '') {
    deployment.contracts[contractName] = {
      address: contractObject.address,
      tx: contractObject.deployTransaction.hash,
    };
  }
  console.log(
    `\t[DEPLOYED] ${contractName} deployed to ${contractObject.address}, tx=${contractObject.deployTransaction.hash}`
  );
  return contractObject;
}

export async function getContractFromDeployment(hre: any, deployment: Deployment, contractName: string): Promise<any> {
  const contractFactory = await hre.ethers.getContractFactory(contractName);
  const contractAddress = deployment.contracts[contractName].address;
  if (!validAddress(contractName, contractAddress)) {
    console.log(`[Error] invalid contract address for ${contractName}`);
    process.exit(1);
  }
  return await contractFactory.attach(contractAddress);
}

export async function createNewYieldContract(
  hre: any,
  deployment: Deployment,
  forgeId: string,
  underlyingAssetContract: any,
  expiry: number
) {
  const pendleRouter = await getContractFromDeployment(hre, deployment, 'PendleRouter');
  const pendleData = await getContractFromDeployment(hre, deployment, 'PendleData');

  const underlyingAssetSymbol = await underlyingAssetContract.symbol();
  const underlyingAssetName = await underlyingAssetContract.name();
  const forgeIdString = utils.parseBytes32String(forgeId);

  console.log(
    `\tCreating new yield contract for ${forgeIdString}, underlyingAsset-${underlyingAssetSymbol}, expiry=${expiry}`
  );

  console.log(`\t underlyingAssetContract = ${underlyingAssetContract.address}`);
  await sendAndWaitForTransaction(hre, pendleRouter.newYieldContracts, 'newYieldContract', [
    forgeId,
    underlyingAssetContract.address,
    expiry,
  ]);
  const xytAddress = await pendleData.xytTokens(forgeId, underlyingAssetContract.address, expiry);
  const otAddress = await pendleData.otTokens(forgeId, underlyingAssetContract.address, expiry);
  console.log(`\t\t xyt address = ${xytAddress}, otAddress = ${otAddress}`);

  if (deployment.yieldContracts[forgeIdString] == null) {
    deployment.yieldContracts[forgeIdString] = {};
  }

  if (deployment.yieldContracts[forgeIdString][underlyingAssetContract.address] == null) {
    deployment.yieldContracts[forgeIdString][underlyingAssetContract.address] = {
      symbol: underlyingAssetSymbol,
      name: underlyingAssetName,
      expiries: {},
      PendleLiquidityMining: {},
    };
  }

  if (deployment.yieldContracts[forgeIdString][underlyingAssetContract.address].expiries[expiry] == null) {
    deployment.yieldContracts[forgeIdString][underlyingAssetContract.address].expiries[expiry] = {
      XYT: xytAddress,
      OT: otAddress,
      markets: {},
    };
  }
}

export async function createNewMarket(
  hre: any,
  deployment: Deployment,
  forgeId: string,
  marketFactoryId: string,
  underlyingAssetContract: any,
  expiry: number,
  baseTokenContract: any
) {
  const pendleRouter = await getContractFromDeployment(hre, deployment, 'PendleRouter');
  const pendleData = await getContractFromDeployment(hre, deployment, 'PendleData');
  const underlyingAssetSymbol = await underlyingAssetContract.symbol();
  const baseTokenSymbol = await baseTokenContract.symbol();
  const forgeIdString = utils.parseBytes32String(forgeId);

  const xytAddress = deployment.yieldContracts[forgeIdString][underlyingAssetContract.address].expiries[expiry].XYT;

  console.log(
    `\tCreating new market for XYT (${forgeIdString} ${underlyingAssetSymbol} ${expiry}), baseToken-${baseTokenSymbol}`
  );

  console.log(`\tunderlyingAssetContract = ${underlyingAssetContract.address}`);

  await sendAndWaitForTransaction(hre, pendleRouter.createMarket, 'createMarket', [
    marketFactoryId,
    xytAddress,
    baseTokenContract.address,
  ]);
  const marketAddress = await pendleData.getMarket(marketFactoryId, xytAddress, baseTokenContract.address);
  console.log(`\t Market created at ${marketAddress}`);

  deployment.yieldContracts[forgeIdString][underlyingAssetContract.address].expiries[expiry].markets[baseTokenSymbol] =
    marketAddress;
}

export async function mintXytAndBootstrapMarket(
  hre: any,
  deployment: Deployment,
  forgeId: string,
  marketFactoryId: string,
  underlyingAssetContract: any,
  expiry: number,
  baseTokenContract: any,
  underlyingYieldTokenAmount: BN,
  baseTokenAmount: BN
) {
  const [deployer] = await hre.ethers.getSigners();
  const pendleRouter = await getContractFromDeployment(hre, deployment, 'PendleRouter');
  const pendleData = await getContractFromDeployment(hre, deployment, 'PendleData');

  const underlyingAssetSymbol = await underlyingAssetContract.symbol();
  const baseTokenSymbol = await baseTokenContract.symbol();
  const forgeIdString = utils.parseBytes32String(forgeId);

  console.log(
    `\tMinting xyt and bootstrapping market for ${forgeIdString}, underlyingAsset-${underlyingAssetSymbol}, expiry=${expiry}, baseToken-${baseTokenSymbol}, a/cToken amount=${underlyingYieldTokenAmount}, baseTokenAmount=${baseTokenAmount}`
  );
  const xytAddress = await pendleData.xytTokens(forgeId, underlyingAssetContract.address, expiry);
  const otAddress = await pendleData.otTokens(forgeId, underlyingAssetContract.address, expiry);
  const marketAddress = await pendleData.getMarket(marketFactoryId, xytAddress, baseTokenContract.address);
  console.log(`\txytAddress = ${xytAddress}, otAddress = ${otAddress}, marketAddress = ${marketAddress}`);

  const xytContract = await (await hre.ethers.getContractFactory('PendleFutureYieldToken')).attach(xytAddress);

  const underlyingYieldTokenAddress = await xytContract.underlyingYieldToken();
  console.log(`\tunderlyingYieldTokenAddress = ${underlyingYieldTokenAddress}`);
  console.log(`\tunderlyingAssetAddress = ${underlyingAssetContract.address}`);
  console.log(`\tbaseTokenContract.address = ${baseTokenContract.address}`);
  const underlyingYieldTokenContract = await (
    await hre.ethers.getContractFactory('TestToken')
  ).attach(underlyingYieldTokenAddress);

  console.log(`\ta/cToken balance = ${await underlyingYieldTokenContract.balanceOf(deployer.address)}`);
  console.log(`\tbaseToken balance = ${await baseTokenContract.balanceOf(deployer.address)}`);

  const initialXytBalance = await xytContract.balanceOf(deployer.address);
  await sendAndWaitForTransaction(hre, underlyingYieldTokenContract.approve, 'approve Router for a/cToken', [
    pendleRouter.address,
    commonConsts.MAX_ALLOWANCE,
  ]);

  await sendAndWaitForTransaction(hre, pendleRouter.tokenizeYield, 'tokenizeYield', [
    forgeId,
    underlyingAssetContract.address,
    expiry,
    underlyingYieldTokenAmount,
    deployer.address,
  ]);
  console.log(`\t initialXytBalance = ${initialXytBalance}`);
  let xytMinted: BN;
  while (true) {
    xytMinted = (await xytContract.balanceOf(deployer.address)).sub(initialXytBalance);
    if (xytMinted.eq(BN.from(0))) {
      console.log(`\t not minted anything yet`);
    } else {
      break;
    }
  }

  console.log(`\t\tMinted ${xytMinted} XYTs`);
  await sendAndWaitForTransaction(hre, xytContract.approve, 'approve Router for xyt', [
    pendleRouter.address,
    commonConsts.MAX_ALLOWANCE,
  ]);
  const baseTokenAllowance = await baseTokenContract.allowance(deployer.address, pendleRouter.address);
  if (baseTokenAllowance.lt(baseTokenAmount)) {
    await sendAndWaitForTransaction(hre, baseTokenContract.approve, 'approve Router for baseToken', [
      pendleRouter.address,
      commonConsts.MAX_ALLOWANCE,
    ]);
  }

  await sendAndWaitForTransaction(hre, pendleRouter.bootstrapMarket, 'bootstrap Market', [
    marketFactoryId,
    xytAddress,
    baseTokenContract.address,
    xytMinted,
    baseTokenAmount,
  ]);
  console.log(`\t\tBootstrapped market with ${xytMinted}xyts and ${baseTokenAmount} ${baseTokenSymbol}`);
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
  const pendleRouter = await getContractFromDeployment(hre, deployment, 'PendleRouter');
  const governanceManagerLiqMining = await hre.ethers.getContractAt(
    'PendleGovernanceManager',
    deployment.contracts.PendleGovernanceManagerLiqMining.address
  );
  const pausingManagerLiqMining = await hre.ethers.getContractAt(
    'PendlePausingManager',
    deployment.contracts.PendlePausingManagerLiqMining.address
  );
  const whitelist = await getContractFromDeployment(hre, deployment, 'PendleWhitelist');
  console.log('269');
  const underlyingAssetSymbol = await underlyingAssetContract.symbol();
  const baseTokenSymbol = await baseTokenContract.symbol();
  const forgeIdString = utils.parseBytes32String(forgeId);

  console.log(
    `\tSetting up liquidity mining for ${forgeIdString}, underlyingAsset-${baseTokenSymbol}, baseToken-${baseTokenSymbol}`
  );
  const pendle = await getContractFromDeployment(hre, deployment, 'PENDLE');
  console.log(`\t !! PendleAddress !! = ${pendle.address}`);

  const liqMiningContract = await deploy(hre, deployment, liqMiningContractName, [
    governanceManagerLiqMining.address,
    pausingManagerLiqMining.address,
    whitelist.address,
    pendle.address,
    pendleRouter.address,
    marketFactoryId,
    forgeId,
    underlyingAssetContract.address,
    baseTokenContract.address,
    liqParams.START_TIME,
    liqParams.EPOCH_DURATION,
    liqParams.VESTING_EPOCHS,
  ]);

  deployment.yieldContracts[forgeIdString][underlyingAssetContract.address].PendleLiquidityMining[baseTokenSymbol] =
    liqMiningContract.address;
  await sendAndWaitForTransaction(hre, pendle.approve, 'approve liq-mining for PENDLE', [
    liqMiningContract.address,
    consts.common.MAX_ALLOWANCE,
  ]);
  await sendAndWaitForTransaction(hre, liqMiningContract.setAllocationSetting, 'set allocation settings', [
    liqParams.EXPIRIES,
    liqParams.ALLOCATIONS,
  ]);
}

export function saveDeployment(filePath: string, deployment: Deployment) {
  fs.writeFileSync(filePath, JSON.stringify(deployment, null, '  '), 'utf8');
}

export function getDeployment(filePath: string): Deployment {
  const existingDeploymentJson = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return existingDeploymentJson as Deployment;
}

export async function sendAndWaitForTransaction(
  hre: any,
  transaction: any,
  transactionDescription: string,
  args: any[]
) {
  const tx = await transaction(...args);
  console.log(`\t\t\t[Broadcasted] transaction: ${transactionDescription}: ${tx.hash}, nonce:${tx.nonce}`);
  await hre.ethers.provider.waitForTransaction(tx.hash);
  console.log(`\t\t\t[Confirmed] transaction: ${transactionDescription}`);
}
