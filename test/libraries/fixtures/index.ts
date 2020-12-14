import { Contract, Wallet, providers } from 'ethers'
import Date from '../../../artifacts/contracts/libraries/Date.sol/Date.json'

const { waffle } = require("hardhat");
const { deployContract } = waffle;

interface DateFixture {
  date: Contract
}

export async function dateFixture(
  [wallet]: Wallet[],
  provider: providers.Web3Provider
): Promise<DateFixture> {
  const date = await deployContract(wallet, Date, [])

  return { date }
}