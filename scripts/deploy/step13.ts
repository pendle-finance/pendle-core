import { Deployment, validAddress, deploy, deployWithName, sendAndWaitForTransaction } from '../helpers/deployHelpers';

export async function step13(deployer: any, hre: any, deployment: Deployment, consts: any) {
  const governanceManagerMain = deployment.contracts.PendleGovernanceManagerMain.address;
  const pendleRouterAddress = deployment.contracts.PendleRouter.address;

  if (!validAddress('Governance manager', governanceManagerMain)) process.exit(1);
  if (!validAddress('PendleRouter address', pendleRouterAddress)) process.exit(1);

  console.log(`\t Governance manager used = ${governanceManagerMain}`);
  console.log(`\t Forge Id used = ${consts.common.FORGE_SUSHISWAP_SIMPLE}`);
  console.log(`\t PendleRouter address used = ${pendleRouterAddress}`);
  console.log(`\t SUSHI_ADDRESS used = ${consts.misc.SUSHI_ADDRESS}`);

  const sushiSimpleRewardManager = await deployWithName(
    hre,
    deployment,
    'PendleRewardManager',
    'PendleRewardManagerSushiswapSimple',
    [governanceManagerMain, consts.common.FORGE_SUSHISWAP_SIMPLE]
  );

  const sushiSimpleYieldContractDeployer = await deployWithName(
    hre,
    deployment,
    'PendleYieldContractDeployerBaseV2',
    'PendleSushiswapSimpleYieldContractDeployer',
    [governanceManagerMain, consts.common.FORGE_SUSHISWAP_SIMPLE]
  );

  const pendleSushiswapSimpleForge = await deploy(hre, deployment, 'PendleSushiswapSimpleForge', [
    governanceManagerMain,
    pendleRouterAddress,
    consts.common.FORGE_SUSHISWAP_SIMPLE,
    consts.misc.SUSHI_ADDRESS,
    sushiSimpleRewardManager.address,
    sushiSimpleYieldContractDeployer.address,
    consts.common.CODE_HASH_SUSHISWAP,
    consts.misc.SUSHISWAP_PAIR_FACTORY,
  ]);

  await sendAndWaitForTransaction(hre, sushiSimpleRewardManager.initialize, 'initialise sushiswapSimpleRewardManager', [
    pendleSushiswapSimpleForge.address,
  ]);

  await sendAndWaitForTransaction(
    hre,
    sushiSimpleYieldContractDeployer.initialize,
    'initialize sushiswapSimpleYieldContractDeployer',
    [pendleSushiswapSimpleForge.address]
  );
  console.log(`\t Done step 13`);
}
