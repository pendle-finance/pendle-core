import { TestEnv } from '.';
import {
  addAaveForgeAndFactoryToPendleData,
  deployAaveForgeAndMarketFactory,
  DeployOrFetch,
  getContract,
  initAaveForge,
} from '../../pendle-deployment-scripts';
import { setTimeNextBlock, teConsts } from '../helpers';

export async function deployAaveV2Forge(env: TestEnv) {
  let consts = env.pconsts;
  let tokens = env.ptokens;

  await deployAaveForgeAndMarketFactory(env.penv, DeployOrFetch.DEPLOY);
  await initAaveForge(env.penv);
  await addAaveForgeAndFactoryToPendleData(env.penv);

  env.a2RewardManager = env.penv.a2RewardManager;
  env.a2Forge = env.penv.pendleAaveV2Forge;

  await setTimeNextBlock(teConsts.T0_A2);
  // USDT
  await env.router.newYieldContracts(
    consts.aave!.FORGE_ID,
    tokens.USDT!.address,
    teConsts.T0_A2.add(consts.misc.SIX_MONTH)
  );
  const otTokenAddress = await env.data.otTokens(
    consts.aave!.FORGE_ID,
    tokens.USDT!.address,
    teConsts.T0_A2.add(consts.misc.SIX_MONTH)
  );

  const xytTokenAddress = await env.data.xytTokens(
    consts.aave!.FORGE_ID,
    tokens.USDT!.address,
    teConsts.T0_A2.add(consts.misc.SIX_MONTH)
  );

  env.a2OwnershipToken = await getContract('MockPendleOwnershipToken', otTokenAddress);
  env.a2FutureYieldToken = await getContract('PendleFutureYieldToken', xytTokenAddress);

  // DAI
  await env.router.newYieldContracts(
    consts.aave!.FORGE_ID,
    tokens.DAI!.address,
    teConsts.T0_A2.add(consts.misc.SIX_MONTH)
  );
  const otTokenAddress18 = await env.data.otTokens(
    consts.aave!.FORGE_ID,
    tokens.DAI!.address,
    teConsts.T0_A2.add(consts.misc.SIX_MONTH)
  );

  const xytTokenAddress18 = await env.data.xytTokens(
    consts.aave!.FORGE_ID,
    tokens.DAI!.address,
    teConsts.T0_A2.add(consts.misc.SIX_MONTH)
  );

  env.a2OwnershipToken18 = await getContract('MockPendleOwnershipToken', otTokenAddress18);
  env.a2FutureYieldToken18 = await getContract('PendleFutureYieldToken', xytTokenAddress18);

  env.aaveLendingPool = await getContract('IAaveV2LendingPool', consts.aave!.LENDING_POOL);
}
