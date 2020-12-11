import chai, { expect } from 'chai'
import { Contract, Wallet, providers } from 'ethers'
import { solidity, deployContract } from 'ethereum-waffle'

import Bmk from '../../../build/Benchmark.json'
import Timelock from '../../../build/Timelock.json'
import BenchmarkGovernance from '../../../build/BenchmarkGovernance.json'
import Weth9 from '../../../build/Weth9.json';

const DELAY = 60 * 60 * 24 * 2;

chai.use(solidity)

interface GovernanceFixture {
  bmk: Contract
  timelock: Contract
  bmkGovernor: Contract
}

export async function governanceFixture(
  [wallet]: Wallet[],
  provider: providers.Web3Provider
): Promise<GovernanceFixture> {
  const weth = await deployContract(wallet, Weth9, []);
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