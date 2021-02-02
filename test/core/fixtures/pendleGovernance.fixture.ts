import { Contract, providers, Wallet } from 'ethers';
import Bmk from '../../../build/artifacts/contracts/core/Pendle.sol/Pendle.json';
import PendleGovernance from '../../../build/artifacts/contracts/core/PendleGovernance.sol/PendleGovernance.json';
import Timelock from '../../../build/artifacts/contracts/periphery/Timelock.sol/Timelock.json';
import { tokens } from "../../helpers";
const { waffle } = require("hardhat");
const { deployContract } = waffle;

interface GovernanceFixture {
  pdl: Contract
  timelock: Contract
  pdlGovernor: Contract
}

export async function governanceFixture(
  [alice]: Wallet[],
  provider: providers.Web3Provider
): Promise<GovernanceFixture> {
  // deploy PDL, sending the total supply to the deployer.
  const pdl = await deployContract(alice, Bmk, [alice.address, tokens.WETH.address])

  // deploy timelock, controlled by what will be the governor
  const timelock = await deployContract(alice, Timelock, [])

  // deploy pdlGovernor
  const pdlGovernor = await deployContract(alice, PendleGovernance, [pdl.address, timelock.address, alice.address])

  return { pdl, timelock, pdlGovernor }
}