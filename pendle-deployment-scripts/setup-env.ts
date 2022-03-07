import { AvaxConsts, EthConsts } from '@pendle/constants';
import hre from 'hardhat';
import { readFlattenedEnv, readSavedData } from '.';
import { Network, PendleEnv } from './type';

export async function setUpEnv(env: PendleEnv, network: Network) {
  env.network = network;
  [env.deployer] = await hre.ethers.getSigners();
  setUpConstants(env);
  readSavedData(env);
  readFlattenedEnv(env);
}

export function setUpConstants(env: PendleEnv) {
  switch (env.network) {
    case Network.AVAX:
      env.consts = AvaxConsts;
      env.tokens = env.consts.tokens;
      break;
    case Network.ETH:
      env.consts = EthConsts;
      env.tokens = env.consts.tokens;
      break;
    default:
      console.log('Skip setting up for Local Env');
  }
}
