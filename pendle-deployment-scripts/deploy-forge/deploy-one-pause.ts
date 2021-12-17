import { DeployOrFetch, PendleEnv } from '../type';
import { deployOrFetchContract } from '../helpers';

export async function deployOnePause(env: PendleEnv, runMode: DeployOrFetch) {
  env.pendleOnePause = await deployOrFetchContract(
    env,
    runMode,
    'PendleOnePause',
    'PendleOnePause',
    [env.pausingManagerMain.address],
    false
  );
}
