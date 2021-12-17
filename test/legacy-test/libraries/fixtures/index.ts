import { Contract, providers, Wallet } from 'ethers';

const { waffle } = require('hardhat');
const { deployContract } = waffle;

interface ExpiryUtilsFixture {
  expiryUtils: Contract;
}

export async function expiryUtilsFixture(
  [alice]: Wallet[],
  provider: providers.Web3Provider
): Promise<ExpiryUtilsFixture> {
  const expiryUtils = await deployContract('ExpiryUtils', []);

  return { expiryUtils };
}
