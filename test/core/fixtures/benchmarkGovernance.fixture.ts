import { Contract, Wallet, providers } from 'ethers'
import Bmk from '../../../artifacts/contracts/core/Benchmark.sol/Benchmark.json'
import Timelock from '../../../artifacts/contracts/periphery/Timelock.sol/Timelock.json'
import BenchmarkGovernance from '../../../artifacts/contracts/core/BenchmarkGovernance.sol/BenchmarkGovernance.json'
import {tokens} from "../../helpers/Constants"

const { waffle } = require("hardhat");
const { deployContract } = waffle;

interface GovernanceFixture {
  bmk: Contract
  timelock: Contract
  bmkGovernor: Contract
}

export async function governanceFixture(
  [wallet]: Wallet[],
  provider: providers.Web3Provider
): Promise<GovernanceFixture> {
  // deploy BMK, sending the total supply to the deployer.
  const bmk = await deployContract(wallet, Bmk, [wallet.address, tokens.WETH.address])

  // deploy timelock, controlled by what will be the governor
  const timelock = await deployContract(wallet, Timelock, [])

  // deploy bmkGovernor
  const bmkGovernor = await deployContract(wallet, BenchmarkGovernance, [bmk.address, timelock.address, wallet.address])

  return { bmk, timelock, bmkGovernor }
}