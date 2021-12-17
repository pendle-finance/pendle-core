import { DeployOrFetch } from '..';
import { deployOrFetchContract } from '../helpers/contract-helpers';
import { PendleEnv } from '../type/pendle-env';
import { sendAndWaitForTransaction } from '../helpers';

export async function deployGenericMarketFactory(env: PendleEnv, runMode: DeployOrFetch) {
  env.pendleGenericMarketFactory = await deployOrFetchContract(
    env,
    runMode,
    'PendleGenericMarketFactory',
    'PendleGenericMarketFactory',
    [env.pendleRouter.address, env.consts.common.GENERIC_MARKET_FACTORY_ID]
  );
}

export async function addGenericMarketFactoryToPendleData(env: PendleEnv) {
  await sendAndWaitForTransaction(env.pendleData.addMarketFactory, 'Add market factory Generic', [
    env.consts.common.GENERIC_MARKET_FACTORY_ID,
    env.pendleGenericMarketFactory.address,
  ]);
}
