import { expect } from 'chai'
import { Contract, Wallet, providers } from 'ethers'
import Bmk from '../../../artifacts/contracts/core/Benchmark.sol/Benchmark.json'
import Timelock from '../../../artifacts/contracts/periphery/Timelock.sol/Timelock.json'
import BenchmarkGovernance from '../../../artifacts/contracts/core/BenchmarkGovernance.sol/BenchmarkGovernance.json'
import WETH9 from '../../../artifacts/contracts/tokens/WETH9.sol/WETH9.json';

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
  const weth = await deployContract(wallet, WETH9, []);
  // deploy BMK, sending the total supply to the deployer.
  const timelockAddress = Contract.getContractAddress({ from: wallet.address, nonce: 2 })
  const bmk = await deployContract(wallet, Bmk, [wallet.address, weth.address])

  // deploy timelock, controlled by what will be the governor
  const bmkGovernorAddress = Contract.getContractAddress({ from: wallet.address, nonce: 3 })
  const timelock = await deployContract(wallet, Timelock, [])
  expect(timelock.address).to.be.eq(timelockAddress)

  // deploy bmkGovernor
  const bmkGovernor = await deployContract(wallet, BenchmarkGovernance, [bmk.address, timelock.address, wallet.address])
  expect(bmkGovernor.address).to.be.eq(bmkGovernorAddress)

  return { bmk, timelock, bmkGovernor }
}