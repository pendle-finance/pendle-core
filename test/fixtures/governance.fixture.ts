import { Contract, providers, Wallet } from 'ethers';
import PendleGovernance from '../../build/artifacts/contracts/governance/PendleGovernance.sol/PendleGovernance.json';
import Timelock from '../../build/artifacts/contracts/periphery/Timelock.sol/Timelock.json';
import PENDLE from '../../build/artifacts/contracts/tokens/PENDLE.sol/PENDLE.json';

const { waffle } = require('hardhat');
const { deployContract } = waffle;

export interface GovernanceFixture {
  pendle: Contract;
  timelock: Contract;
  governor: Contract;
}

export async function governanceFixture(_: Wallet[], provider: providers.Web3Provider): Promise<GovernanceFixture> {
  const wallets = waffle.provider.getWallets();
  const [alice] = wallets;
  // deploy PDL, sending the total supply to the deployer.
  const pendle = await deployContract(alice, PENDLE, [
    alice.address,
    alice.address,
    alice.address,
    alice.address,
    alice.address,
  ]);

  // deploy timelock, controlled by what will be the governor
  const timelock = await deployContract(alice, Timelock, []);

  // deploy governor
  const governor = await deployContract(alice, PendleGovernance, [pendle.address, timelock.address, alice.address]);

  return { pendle, timelock, governor };
}
