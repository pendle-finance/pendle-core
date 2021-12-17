import { TestEnv } from '.';
import {
  DeployOrFetch,
  addWonderlandForgeToPendleData,
  deployWonderlandForge,
  initWonderlandForge,
  registerNewWonderlandToken,
  newYieldContracts,
  getContract,
} from '../../pendle-deployment-scripts';
import { setTimeNextBlock, teConsts } from '../helpers';

export async function deployWonderlandFixture(env: TestEnv) {
  await deployWonderlandForge(env.penv, DeployOrFetch.DEPLOY);
  await initWonderlandForge(env.penv);
  await addWonderlandForgeToPendleData(env.penv);

  env.wonderlandForge = env.penv.pendleWonderlandForge;
  env.wonderlandRewardManager = env.penv.wonderlandRewardManager;

  await registerNewWonderlandToken(env.penv);

  await setTimeNextBlock(teConsts.T0_WM);
  const { OTAddr, YTAddr } = await newYieldContracts(
    env.penv,
    env.pconsts.wonderland!.FORGE_ID!,
    env.ptokens.MEMO!.address,
    teConsts.T0_WM.add(env.pconsts.misc.SIX_MONTH)
  );

  env.wonderlandOwnershipToken = await getContract('MockPendleOwnershipToken', OTAddr);
  env.wonderlandFutureYieldToken = await getContract('PendleFutureYieldToken', YTAddr);
}
