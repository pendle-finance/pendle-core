import { Contract, Wallet, providers } from 'ethers'
import Bmk from '../../../build/artifacts/contracts/core/Pendle.sol/Pendle.json'
import Timelock from '../../../build/artifacts/contracts/periphery/Timelock.sol/Timelock.json'
import PendleGovernance from '../../../build/artifacts/contracts/core/PendleGovernance.sol/PendleGovernance.json'
import {tokens} from "../../helpers/Constants"

const { waffle } = require("hardhat");
const { deployContract } = waffle;

interface GovernanceFixture {
  pdl: Contract
  timelock: Contract
  pdlGovernor: Contract
}

export async function governanceFixture(
  [wallet]: Wallet[],
  provider: providers.Web3Provider
): Promise<GovernanceFixture> {
  // deploy PDL, sending the total supply to the deployer.
  const pdl = await deployContract(wallet, Bmk, [wallet.address, tokens.WETH.address])

  // deploy timelock, controlled by what will be the governor
  const timelock = await deployContract(wallet, Timelock, [])

  // deploy pdlGovernor
  const pdlGovernor = await deployContract(wallet, PendleGovernance, [pdl.address, timelock.address, wallet.address])

  return { pdl, timelock, pdlGovernor }
}