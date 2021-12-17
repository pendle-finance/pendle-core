import { TestEnv } from '.';
import {
  addBenQiForgeToPendleData,
  deployBenQiForge,
  DeployOrFetch,
  getContract,
  initBenQiForge,
} from '../../pendle-deployment-scripts';
import { newYieldContracts, registerNewBenQiTokens } from '../../pendle-deployment-scripts';
import { setTimeNextBlock, teConsts } from '../helpers';

export async function deployBenQiForgeFixture(env: TestEnv) {
  await deployBenQiForge(env.penv, DeployOrFetch.DEPLOY);
  await initBenQiForge(env.penv);
  await addBenQiForgeToPendleData(env.penv);

  env.benQiForge = env.penv.pendleBenQiForge;
  env.benQiRewardManager = env.penv.benQiRewardManager;

  await registerNewBenQiTokens(env.penv, env.ptokens.DAI!);

  await setTimeNextBlock(teConsts.T0_B);

  let { OTAddr: OTAddrDAI, YTAddr: YTAddrDAI } = await newYieldContracts(
    env.penv,
    env.pconsts.benqi!.FORGE_ID,
    env.ptokens.DAI!.address,
    teConsts.T0_B.add(env.pconsts.misc.SIX_MONTH)
  );

  let { OTAddr: OTAddrAvax, YTAddr: YTAddrAvax } = await newYieldContracts(
    env.penv,
    env.pconsts.benqi!.FORGE_ID,
    env.ptokens.WNATIVE!.address,
    teConsts.T0_B.add(env.pconsts.misc.SIX_MONTH)
  );

  env.benQiOtDAI = await getContract('MockPendleOwnershipToken', OTAddrDAI);
  env.benQiYtDAI = await getContract('PendleFutureYieldToken', YTAddrDAI);
  env.benQiOtAvax = await getContract('MockPendleOwnershipToken', OTAddrAvax);
  env.benQiYtAvax = await getContract('PendleFutureYieldToken', YTAddrAvax);
}
