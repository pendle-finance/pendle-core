import { Contract, Wallet, providers } from 'ethers'
import DateUtils from '../../../artifacts/contracts/libraries/BenchmarkLibrary.sol/DateUtils.json'

const { waffle } = require("hardhat");
const { deployContract } = waffle;

interface DateFixture {
  date: Contract
}

export async function dateFixture(
  [wallet]: Wallet[],
  provider: providers.Web3Provider
): Promise<DateFixture> {
  const date = await deployContract(wallet, DateUtils, [])

  return { date }
}