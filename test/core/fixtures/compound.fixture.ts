import { Contract, Wallet } from 'ethers';
import LendingPool from "../../../build/artifacts/contracts/interfaces/ICompoundLendingPool.sol/ICompoundLendingPool.json";
import LendingPoolCore from "../../../build/artifacts/contracts/interfaces/ICompoundLendingPoolCore.sol/ICompoundLendingPoolCore.json";
import { consts } from "../../helpers";


export interface CompoundFixture {
  lendingPoolCore: Contract
  lendingPool: Contract
}

export async function compoundFixture(alice: Wallet): Promise<CompoundFixture> {
  const lendingPoolCore = new Contract(consts.Compound_LENDING_POOL_CORE_ADDRESS, LendingPoolCore.abi, alice);
  const lendingPool = new Contract(consts.Compound_LENDING_POOL_ADDRESS, LendingPool.abi, alice);
  return {
    lendingPoolCore,
    lendingPool
  };
}
