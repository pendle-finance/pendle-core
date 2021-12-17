import { Network } from '.';

export function isLocalEnv(network: Network) {
  return network == Network.LOCAL_AVAX || network == Network.LOCAL_ETH;
}

export function isAvax(network: Network) {
  return network == Network.AVAX || network == Network.LOCAL_AVAX;
}

export function isEth(network: Network) {
  return network == Network.ETH || network == Network.LOCAL_ETH;
}
