import { Contract, providers, Wallet } from 'ethers';
import DateUtils from '../../../build/artifacts/contracts/libraries/PendleLibrary.sol/DateUtils.json';

const { waffle } = require("hardhat");
const { deployContract } = waffle;

interface DateFixture {
  date: Contract
}

export async function dateFixture(
  [alice]: Wallet[],
  provider: providers.Web3Provider
): Promise<DateFixture> {
  const date = await deployContract(alice, DateUtils, [])

  return { date }
}