import { Contract, Wallet } from 'ethers';
import LendingPool from '../../build/artifacts/contracts/interfaces/IAaveV2LendingPool.sol/IAaveV2LendingPool.json';
import { consts } from '../helpers/Constants';

export interface AaveV2Fixture {
  lendingPool: Contract;
}

export async function aaveV2Fixture(alice: Wallet): Promise<AaveV2Fixture> {
  const lendingPool = new Contract(consts.AAVE_V2_LENDING_POOL_ADDRESS, LendingPool.abi, alice);
  return {
    lendingPool,
  };
}
