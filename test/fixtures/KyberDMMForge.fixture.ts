import { TestEnv } from '.';
import { deployContract, setTimeNextBlock, teConsts } from '../helpers';
import { getContract } from '../../pendle-deployment-scripts';

export async function deployKyberDMMForge(env: TestEnv) {
  env.kyberRewardManager = await deployContract('MockPendleRewardManager', [
    env.govManager.address,
    env.pconsts.kyber!.FORGE_ID,
  ]);

  const kyberYieldContractDeployer = await deployContract('PendleYieldContractDeployerBaseV2', [
    env.govManager.address,
    env.pconsts.kyber!.FORGE_ID,
  ]);

  env.kyberForge = await deployContract('PendleKyberDMMForge', [
    env.govManager.address,
    env.router.address,
    env.pconsts.kyber!.FORGE_ID,
    env.ptokens.USDT!.address,
    env.kyberRewardManager.address,
    kyberYieldContractDeployer.address,
    env.pconsts.kyber!.PAIR_FACTORY,
  ]);

  await env.kyberRewardManager.setSkippingRewards(true, teConsts.HG);
  await env.kyberRewardManager.initialize(env.kyberForge.address);
  await kyberYieldContractDeployer.initialize(env.kyberForge.address);
  await env.data.addForge(env.pconsts.kyber!.FORGE_ID, env.kyberForge.address, teConsts.HG);

  await env.kyberForge.registerTokens(
    [env.ptokens.KYBER_USDT_WETH_LP!.address],
    [[env.ptokens.KYBER_USDT_WETH_LP!.address]],
    teConsts.HG
  );
  await setTimeNextBlock(teConsts.T0_K);

  let params = [
    env.pconsts.kyber!.FORGE_ID,
    env.ptokens.KYBER_USDT_WETH_LP!.address,
    teConsts.T0_K.add(env.pconsts.misc.SIX_MONTH),
    teConsts.HG,
  ];
  await env.router.newYieldContracts(...params);
  const otTokenAddress = await env.data.otTokens(...params);
  const xytTokenAddress = await env.data.xytTokens(...params);

  env.kyberOwnershipToken = await getContract('MockPendleOwnershipToken', otTokenAddress);
  env.kyberFutureYieldToken = await getContract('PendleFutureYieldToken', xytTokenAddress);
}
