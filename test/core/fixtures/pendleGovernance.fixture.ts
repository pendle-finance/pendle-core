import { Contract, providers, Wallet } from 'ethers';
import PendleGovernance from '../../../build/artifacts/contracts/core/PendleGovernance.sol/PendleGovernance.json';
import Timelock from '../../../build/artifacts/contracts/periphery/Timelock.sol/Timelock.json';
import PENDLE from '../../../build/artifacts/contracts/tokens/PENDLE.sol/PENDLE.json';

const { waffle } = require("hardhat");
const { deployContract } = waffle;

export interface PendleGovernanceFixture {
  pendle: Contract
  timelock: Contract
  pendleGovernor: Contract
}

export async function pendleGovernanceFixture(
  [alice]: Wallet[],
  provider: providers.Web3Provider
): Promise<PendleGovernanceFixture> {
  // deploy PDL, sending the total supply to the deployer.
  const pendle = await deployContract(alice, PENDLE, [alice.address])

  // deploy timelock, controlled by what will be the governor
  const timelock = await deployContract(alice, Timelock, [])

  // deploy pendleGovernor
  const pendleGovernor = await deployContract(alice, PendleGovernance, [pendle.address, timelock.address, alice.address])

  return { pendle, timelock, pendleGovernor }
}
