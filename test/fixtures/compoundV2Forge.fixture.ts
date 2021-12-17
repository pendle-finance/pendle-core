import { TestEnv } from '.';
import { deployContract, setTimeNextBlock, teConsts } from '../helpers';
import { getContract } from '../../pendle-deployment-scripts';

export async function compoundV2ForgeFixture(env: TestEnv) {
  let consts = env.pconsts;
  let tokens = env.ptokens;
  env.c2RewardManager = await deployContract('MockPendleRewardManager', [
    env.govManager.address,
    consts.compound!.FORGE_ID_V2,
  ]);

  const c2YieldContractDeployer = await deployContract('PendleCompoundV2YieldContractDeployer', [
    env.govManager.address,
    consts.compound!.FORGE_ID_V2,
  ]);

  env.c2Forge = await deployContract('PendleCompoundV2Forge', [
    env.govManager.address,
    env.router.address,
    consts.compound!.COMPTROLLER,
    consts.compound!.FORGE_ID_V2,
    consts.tokens.COMP!,
    env.c2RewardManager.address,
    c2YieldContractDeployer.address,
    tokens.NATIVE.compound!,
  ]);

  await env.c2RewardManager.initialize(env.c2Forge.address);

  await c2YieldContractDeployer.initialize(env.c2Forge.address);

  await env.data.addForge(consts.compound!.FORGE_ID_V2, env.c2Forge.address, teConsts.HG);

  await env.c2Forge.registerTokens([tokens.USDT!.address], [[tokens.USDT!.compound]]);

  await setTimeNextBlock(teConsts.T0_C2);

  await env.router.newYieldContracts(
    consts.compound!.FORGE_ID_V2,
    tokens.USDT!.address,
    teConsts.T0_C2.add(env.pconsts.misc.SIX_MONTH)
  );

  const otTokenAddress = await env.data.otTokens(
    consts.compound!.FORGE_ID_V2,
    tokens.USDT!.address,
    teConsts.T0_C2.add(env.pconsts.misc.SIX_MONTH)
  );

  const xytTokenAddress = await env.data.xytTokens(
    consts.compound!.FORGE_ID_V2,
    tokens.USDT!.address,
    teConsts.T0_C2.add(env.pconsts.misc.SIX_MONTH)
  );

  env.c2OwnershipToken = await getContract('MockPendleOwnershipToken', otTokenAddress);
  env.c2FutureYieldToken = await getContract('PendleFutureYieldToken', xytTokenAddress);

  // ETH
  await env.router.newYieldContracts(
    consts.compound!.FORGE_ID_V2,
    tokens.WNATIVE!.address,
    teConsts.T0_C2.add(env.pconsts.misc.SIX_MONTH)
  );
  const otTokenAddress8 = await env.data.otTokens(
    consts.compound!.FORGE_ID_V2,
    tokens.WNATIVE!.address,
    teConsts.T0_C2.add(env.pconsts.misc.SIX_MONTH)
  );

  const xytTokenAddress8 = await env.data.xytTokens(
    consts.compound!.FORGE_ID_V2,
    tokens.WNATIVE!.address,
    teConsts.T0_C2.add(env.pconsts.misc.SIX_MONTH)
  );

  env.c2OwnershipToken8 = await getContract('MockPendleOwnershipToken', otTokenAddress8);
  env.c2FutureYieldToken8 = await getContract('PendleFutureYieldToken', xytTokenAddress8);
}
