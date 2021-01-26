import { Contract, Wallet, providers } from 'ethers'
import PENDLE from '../../../build/artifacts/contracts/tokens/PENDLE.sol/PENDLE.json'
import Timelock from '../../../build/artifacts/contracts/periphery/Timelock.sol/Timelock.json'
import PendleGovernance from '../../../build/artifacts/contracts/core/PendleGovernance.sol/PendleGovernance.json'
import {tokens} from "../../helpers/Constants"

const { waffle } = require("hardhat");
const { deployContract } = waffle;

interface GovernanceFixture {
  pendle: Contract
  timelock: Contract
  pendleGovernor: Contract
}

export async function governanceFixture(
  [wallet]: Wallet[],
  provider: providers.Web3Provider
): Promise<GovernanceFixture> {
  // deploy PDL, sending the total supply to the deployer.
  const pendle = await deployContract(wallet, PENDLE, [wallet.address, tokens.WETH.address])

  // deploy timelock, controlled by what will be the governor
  const timelock = await deployContract(wallet, Timelock, [])

  // deploy pendleGovernor
  const pendleGovernor = await deployContract(wallet, PendleGovernance, [pendle.address, timelock.address, wallet.address])

  return { pendle, timelock, pendleGovernor }
}