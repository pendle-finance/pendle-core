import { DeployOrFetch, isEth, PendleEnv } from '../type';
import { deployOrFetchContract } from '../helpers';
import { ProxyAdmin } from '../../typechain-types';

export async function deployPendleProxyAdmin(env: PendleEnv, runMode: DeployOrFetch) {
  env.proxyAdmin = (await deployOrFetchContract(env, runMode, 'PendleProxyAdmin', 'ProxyAdmin', [])) as ProxyAdmin;
}
