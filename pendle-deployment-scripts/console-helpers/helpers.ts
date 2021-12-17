import { getContract } from '../helpers';

const hre = require('hardhat');

export async function getRewardManagerMultiContract(addr: string) {
  return getContract('PendleRewardManagerMulti', addr);
}
