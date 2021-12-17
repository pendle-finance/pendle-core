import { TestEnv } from '.';
import {
  addXJoeForgeToPendleData,
  DeployOrFetch,
  deployXJoeForge,
  getContract,
  initXJoeForge,
  newYieldContracts,
  registerTokenXJoe,
} from '../../pendle-deployment-scripts';
import { deployContract, setTimeNextBlock, teConsts } from '../helpers';

export async function deployxJoeForge(env: TestEnv) {
  let tokens = env.ptokens;
  let consts = env.pconsts;

  await deployXJoeForge(env.penv, DeployOrFetch.DEPLOY);
  await initXJoeForge(env.penv);
  await addXJoeForgeToPendleData(env.penv);
  await registerTokenXJoe(env.penv);

  env.xJoeRewardManager = env.penv.xJoeRewardManager;
  env.xJoeForge = env.penv.pendleXJoeForge;

  await setTimeNextBlock(teConsts.T0_XJ);

  const expiry = teConsts.T0_XJ.add(env.pconsts.misc.SIX_MONTH);

  let { OTAddr, YTAddr } = await newYieldContracts(env.penv, consts.joe!.FORGE_ID_XJOE, tokens.JOE!.address, expiry);

  env.xJoeOwnershipToken = await getContract('MockPendleOwnershipToken', OTAddr);
  env.xJoeFutureYieldToken = await getContract('PendleFutureYieldToken', YTAddr);

  const yieldTokenHolderAddr = await env.xJoeForge.yieldTokenHolders(tokens.JOE!.address, expiry);

  env.xJoeRewardRedeemer = await deployContract('MockPendleTraderJoeRewardRedeemer', [
    yieldTokenHolderAddr,
    tokens.XJOE!.address,
    consts.joe!.MASTERCHEF_V2,
    tokens.XJOE!.pid!,
    [tokens.JOE!.address, consts.misc.ZERO_ADDRESS, consts.misc.ZERO_ADDRESS],
    tokens.WNATIVE.address,
  ]);

  await env.xJoeForge.migrateMasterChef(
    tokens.JOE!.address,
    [expiry],
    env.xJoeRewardRedeemer.address,
    tokens.XJOE!.pid!,
    teConsts.HG
  );
}
