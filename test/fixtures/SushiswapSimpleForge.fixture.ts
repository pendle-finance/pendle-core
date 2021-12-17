import { TestEnv } from '.';
import { deployContract, setTimeNextBlock, teConsts } from '../helpers';
import { getContract } from '../../pendle-deployment-scripts';

export async function deploySushiswapSimpleForge(env: TestEnv) {
  let tokens = env.ptokens;
  let consts = env.pconsts;
  env.ssRewardManager = await deployContract('MockPendleRewardManager', [
    env.govManager.address,
    consts.sushi!.FORGE_ID_SIMPLE,
  ]);

  const ssYieldContractDeployer = await deployContract('PendleYieldContractDeployerBaseV2', [
    env.govManager.address,
    consts.sushi!.FORGE_ID_SIMPLE,
  ]);

  env.ssForge = await deployContract('PendleSushiswapSimpleForge', [
    env.govManager.address,
    env.router.address,
    consts.sushi!.FORGE_ID_SIMPLE,
    tokens.USDT!.address,
    env.ssRewardManager.address,
    ssYieldContractDeployer.address,
    consts.sushi!.CODE_HASH,
    consts.sushi!.PAIR_FACTORY,
  ]);

  await env.ssRewardManager.setSkippingRewards(true, teConsts.HG);

  await env.ssRewardManager.initialize(env.ssForge.address);
  await ssYieldContractDeployer.initialize(env.ssForge.address);
  await env.data.addForge(consts.sushi!.FORGE_ID_SIMPLE, env.ssForge.address, teConsts.HG);

  await env.ssForge.registerTokens(
    [tokens.SUSHI_USDT_WETH_LP!.address],
    [[tokens.SUSHI_USDT_WETH_LP!.address]],
    teConsts.HG
  );
  await setTimeNextBlock(teConsts.T0_SS);

  let params = [
    consts.sushi!.FORGE_ID_SIMPLE,
    tokens.SUSHI_USDT_WETH_LP!.address,
    teConsts.T0_SS.add(env.pconsts.misc.SIX_MONTH),
    teConsts.HG,
  ];
  await env.router.newYieldContracts(...params);

  const otTokenAddress = await env.data.otTokens(...params);

  const xytTokenAddress = await env.data.xytTokens(...params);

  env.ssOwnershipToken = await getContract('MockPendleOwnershipToken', otTokenAddress);
  env.ssFutureYieldToken = await getContract('PendleFutureYieldToken', xytTokenAddress);
}
