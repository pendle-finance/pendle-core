import { Network, PendleEnv } from '.';

export function isLocalEnv(env: PendleEnv) {
  return env.network == Network.LOCAL_AVAX || env.network == Network.LOCAL_ETH;
}

export function isAvax(env: PendleEnv) {
  return env.network == Network.AVAX || env.network == Network.LOCAL_AVAX;
}

export function isEth(env: PendleEnv) {
  return env.network == Network.ETH || env.network == Network.LOCAL_ETH;
}
