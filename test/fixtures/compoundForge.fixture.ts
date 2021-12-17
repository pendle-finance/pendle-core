import { TestEnv } from '.';
import { deployContract, setTimeNextBlock, teConsts } from '../helpers';
import { getContract } from '../../pendle-deployment-scripts';
export async function compoundForgeFixture(env: TestEnv) {
  let consts = env.pconsts;
  let tokens = env.ptokens;

  env.cRewardManager = await deployContract('MockPendleRewardManager', [
    env.govManager.address,
    consts.compound!.FORGE_ID_V1,
  ]);

  const cYieldContractDeployer = await deployContract('PendleCompoundYieldContractDeployer', [
    env.govManager.address,
    consts.compound!.FORGE_ID_V1,
  ]);

  env.cForge = await deployContract('PendleCompoundForge', [
    env.govManager.address,
    env.router.address,
    consts.compound!.COMPTROLLER,
    consts.compound!.FORGE_ID_V1,
    tokens.COMP!.address,
    env.cRewardManager.address,
    cYieldContractDeployer.address,
    tokens.NATIVE.compound!,
  ]);
  await env.cRewardManager.initialize(env.cForge.address);

  await cYieldContractDeployer.initialize(env.cForge.address);

  await env.data.addForge(consts.compound!.FORGE_ID_V1, env.cForge.address);

  await env.cForge.registerCTokens([tokens.USDT!.address], [tokens.USDT!.compound]);

  await setTimeNextBlock(teConsts.T0_C);
  await env.router.newYieldContracts(
    consts.compound!.FORGE_ID_V1,
    tokens.USDT!.address,
    teConsts.T0_C.add(env.pconsts.misc.SIX_MONTH)
  );

  const otTokenAddress = await env.data.otTokens(
    consts.compound!.FORGE_ID_V1,
    tokens.USDT!.address,
    teConsts.T0_C.add(env.pconsts.misc.SIX_MONTH)
  );

  const xytTokenAddress = await env.data.xytTokens(
    consts.compound!.FORGE_ID_V1,
    tokens.USDT!.address,
    teConsts.T0_C.add(env.pconsts.misc.SIX_MONTH)
  );

  env.cOwnershipToken = await getContract('MockPendleOwnershipToken', otTokenAddress);
  env.cFutureYieldToken = await getContract('PendleFutureYieldToken', xytTokenAddress);

  // ETH
  await env.router.newYieldContracts(
    consts.compound!.FORGE_ID_V1,
    tokens.WNATIVE.address,
    teConsts.T0_C.add(env.pconsts.misc.SIX_MONTH)
  );
  const otTokenAddress8 = await env.data.otTokens(
    consts.compound!.FORGE_ID_V1,
    tokens.WNATIVE.address,
    teConsts.T0_C.add(env.pconsts.misc.SIX_MONTH)
  );

  const xytTokenAddress8 = await env.data.xytTokens(
    consts.compound!.FORGE_ID_V1,
    tokens.WNATIVE.address,
    teConsts.T0_C.add(env.pconsts.misc.SIX_MONTH)
  );

  env.cOwnershipToken8 = await getContract('MockPendleOwnershipToken', otTokenAddress8);
  env.cFutureYieldToken8 = await getContract('PendleFutureYieldToken', xytTokenAddress8);
}
