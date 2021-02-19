import { Contract, providers, Wallet } from 'ethers';
import ExpiryUtils from '../../../build/artifacts/contracts/mock/MockPendleLibrary.sol/MockPendleLibrary.json';

const { waffle } = require("hardhat");
const { deployContract } = waffle;

interface ExpiryUtilsFixture {
  expiryUtils: Contract
}

export async function expiryUtilsFixture(
  [alice]: Wallet[],
  provider: providers.Web3Provider
): Promise<ExpiryUtilsFixture> {
  const expiryUtils = await deployContract(alice, ExpiryUtils, [])

  return { expiryUtils }
}