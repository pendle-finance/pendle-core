import { TestEnv } from '.';
import { deployContract, setTimeNextBlock, teConsts } from '../helpers';
import { getContract } from '../../pendle-deployment-scripts';

export async function deploySushiswapComplexForge(env: TestEnv) {
  let consts = env.pconsts;
  let tokens = env.ptokens;

  env.scRewardManager = await deployContract('MockPendleRewardManager', [
    env.govManager.address,
    consts.sushi!.FORGE_ID_COMPLEX,
  ]);

  const scYieldContractDeployer = await deployContract('PendleSushiswapComplexYieldContractDeployer', [
    env.govManager.address,
    consts.sushi!.FORGE_ID_COMPLEX,
    consts.sushi!.MASTERCHEF_V1,
  ]);

  env.scForge = await deployContract('PendleSushiswapComplexForge', [
    env.govManager.address,
    env.router.address,
    consts.sushi!.FORGE_ID_COMPLEX,
    tokens.SUSHI!.address,
    env.scRewardManager.address,
    scYieldContractDeployer.address,
    consts.sushi!.CODE_HASH,
    consts.sushi!.PAIR_FACTORY,
    consts.sushi!.MASTERCHEF_V1,
  ]);

  await env.scRewardManager.initialize(env.scForge.address);

  await scYieldContractDeployer.initialize(env.scForge.address);

  await env.data.addForge(consts.sushi!.FORGE_ID_COMPLEX, env.scForge.address);

  await env.scForge.registerTokens(
    [tokens.SUSHI_USDT_WETH_LP!.address],
    [[tokens.SUSHI_USDT_WETH_LP!.pid]],
    teConsts.HG
  );

  await setTimeNextBlock(teConsts.T0_SC);

  let scForgeArguments = [
    consts.sushi!.FORGE_ID_COMPLEX,
    tokens.SUSHI_USDT_WETH_LP!.address,
    teConsts.T0_SC.add(env.pconsts.misc.SIX_MONTH),
  ];

  await env.router.newYieldContracts(...scForgeArguments);
  const otTokenAddress = await env.data.otTokens(...scForgeArguments);
  const xytTokenAddress = await env.data.xytTokens(...scForgeArguments);

  env.scOwnershipToken = await getContract('MockPendleOwnershipToken', otTokenAddress);
  env.scFutureYieldToken = await getContract('PendleFutureYieldToken', xytTokenAddress);
}
