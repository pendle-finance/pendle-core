import { TestEnv } from '.';
import {
  addJoeComplexForgeToPendleData,
  deployJoeComplexForge,
  DeployOrFetch,
  getContract,
  initJoeComplexForge,
  newYieldContracts,
  registerNewJoeComplexTokens,
} from '../../pendle-deployment-scripts';
import { deployContract, setTimeNextBlock, teConsts } from '../helpers';

export async function deployTraderJoeForge(env: TestEnv) {
  let tokens = env.ptokens;
  let consts = env.pconsts;
  await deployJoeComplexForge(env.penv, DeployOrFetch.DEPLOY);
  await initJoeComplexForge(env.penv);
  await addJoeComplexForgeToPendleData(env.penv);

  env.joeRewardManager = env.penv.joeComplexRewardManager;
  env.joeForge = env.penv.pendleTraderJoeComplexForge;

  await registerNewJoeComplexTokens(env.penv, {
    lpToken: env.ptokens.JOE_WAVAX_DAI_LP!,
    masterChef: env.pconsts.joe!.MASTERCHEF_V2,
    rewardToken2: env.pconsts.misc.ZERO_ADDRESS,
    rewardToken3: env.pconsts.misc.ZERO_ADDRESS,
  });

  await setTimeNextBlock(teConsts.T0_TJ);

  const expiry = teConsts.T0_TJ.add(env.pconsts.misc.SIX_MONTH);

  let { OTAddr, YTAddr } = await newYieldContracts(
    env.penv,
    consts.joe!.FORGE_ID_COMPLEX,
    tokens.JOE_WAVAX_DAI_LP!.address,
    expiry
  );

  env.joeOwnershipToken = await getContract('MockPendleOwnershipToken', OTAddr);
  env.joeFutureYieldToken = await getContract('PendleFutureYieldToken', YTAddr);

  const yieldTokenHolderAddr = await env.joeForge.yieldTokenHolders(tokens.JOE_WAVAX_DAI_LP!.address, expiry);

  env.joeRewardRedeemer = await deployContract('MockPendleTraderJoeRewardRedeemer', [
    yieldTokenHolderAddr,
    tokens.JOE_WAVAX_DAI_LP!.address,
    consts.joe!.MASTERCHEF_V2,
    tokens.JOE_WAVAX_DAI_LP!.pid!,
    [tokens.JOE!.address, consts.misc.ZERO_ADDRESS, consts.misc.ZERO_ADDRESS],
    tokens.WNATIVE.address,
  ]);

  await env.joeForge.migrateMasterChef(
    tokens.JOE_WAVAX_DAI_LP!.address,
    [expiry],
    env.joeRewardRedeemer.address,
    tokens.JOE_WAVAX_DAI_LP!.pid,
    teConsts.HG
  );
}
