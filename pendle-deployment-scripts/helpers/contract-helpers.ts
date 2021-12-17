import { Erc20Token, LpToken } from '@pendle/constants';
import { Contract } from 'ethers';
import { DeployOrFetch, getInfoYO, isOToffchain, PendleEnv, saveContract } from '..';

const hre = require('hardhat');

export async function getContract(abiType: string, address: string | Erc20Token | LpToken): Promise<Contract> {
  if (typeof address != 'string') {
    address = address.address;
  }
  return await hre.ethers.getContractAt(abiType, address);
}

export async function deployOrFetchContract(
  env: PendleEnv,
  runMode: DeployOrFetch,
  contractName: string,
  contractAbiType: string,
  args: any[],
  verify: boolean = false
): Promise<Contract> {
  if (runMode == DeployOrFetch.FETCH) {
    if (!(contractName in env.contractMap)) throw new Error('Action is FETCH but the contract does not exist');
    return getContract(contractAbiType, env.contractMap[contractName].address);
  }
  if (contractName in env.contractMap) throw new Error('Action is DEPLOY but the contract has existed');
  const contractFactory = await hre.ethers.getContractFactory(contractAbiType);
  const contractObject = await contractFactory.deploy(...args);
  await contractObject.deployed();
  console.log(
    `\t[DEPLOYED] ${contractName} deployed to ${contractObject.address}, tx=${contractObject.deployTransaction.hash}`
  );
  await saveContract(env, contractName, {
    address: contractObject.address,
    tx: contractObject.deployTransaction.hash,
    abiType: contractAbiType,
  });
  if (verify) {
    await hre.run('verify:verify', {
      address: contractObject.address,
      // contract: 'contracts/core/SushiswapComplex/PendleSLPLiquidityMining.sol:PendleSLPLiquidityMining',
      constructorArguments: args,
    });
  }
  return contractObject;
}

export async function getOTAddrFromJoePool(env: PendleEnv, pool: string): Promise<string> {
  let poolContract = await getContract('IUniswapV2Pair', pool);
  let token0 = await poolContract.callStatic.token0();
  let token1 = await poolContract.callStatic.token1();
  if (isOToffchain(env, token0)) return token0;
  if (isOToffchain(env, token1)) return token1;
  throw new Error('Not an OT pool');
}
