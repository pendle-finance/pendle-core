import { TestEnv } from '.';
import { deployContract, setTimeNextBlock, teConsts } from '../helpers';
import { getContract } from '../../pendle-deployment-scripts';

export async function uniswapV2ForgeFixture(env: TestEnv) {
  let tokens = env.ptokens;
  let consts = env.pconsts;
  env.uniRewardManager = await deployContract('MockPendleRewardManager', [
    env.govManager.address,
    consts.uni!.FORGE_ID,
  ]);

  const uniYieldContractDeployer = await deployContract('PendleYieldContractDeployerBaseV2', [
    env.govManager.address,
    consts.uni!.FORGE_ID,
  ]);

  env.uniForge = await deployContract('PendleUniswapV2Forge', [
    env.govManager.address,
    env.router.address,
    consts.uni!.FORGE_ID,
    tokens.USDT!.address,
    env.uniRewardManager.address,
    uniYieldContractDeployer.address,
    consts.uni!.CODE_HASH,
    consts.uni!.PAIR_FACTORY,
  ]);

  await env.uniRewardManager.setSkippingRewards(true, teConsts.HG);

  await env.uniRewardManager.initialize(env.uniForge.address);
  await uniYieldContractDeployer.initialize(env.uniForge.address);
  await env.data.addForge(consts.uni!.FORGE_ID, env.uniForge.address, teConsts.HG);

  await env.uniForge.registerTokens(
    [tokens.UNI_USDT_WETH_LP!.address],
    [[tokens.UNI_USDT_WETH_LP!.address]],
    teConsts.HG
  );
  await setTimeNextBlock(teConsts.T0_UNI);

  let params = [
    consts.uni!.FORGE_ID,
    tokens.UNI_USDT_WETH_LP!.address,
    teConsts.T0_UNI.add(consts.misc.SIX_MONTH),
    teConsts.HG,
  ];

  await env.router.newYieldContracts(...params);

  const otTokenAddress = await env.data.otTokens(...params);

  const xytTokenAddress = await env.data.xytTokens(...params);

  env.uniOwnershipToken = await getContract('MockPendleOwnershipToken', otTokenAddress);
  env.uniFutureYieldToken = await getContract('PendleFutureYieldToken', xytTokenAddress);
}
