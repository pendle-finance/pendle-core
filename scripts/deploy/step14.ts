import { Deployment, validAddress, deploy, deployWithName, sendAndWaitForTransaction } from '../helpers/deployHelpers';

export async function step14(deployer: any, hre: any, deployment: Deployment, consts: any) {
  const governanceManagerMain = deployment.contracts.PendleGovernanceManagerMain.address;
  const pendleRouterAddress = deployment.contracts.PendleRouter.address;

  if (!validAddress('Governance manager', governanceManagerMain)) process.exit(1);
  if (!validAddress('PendleRouter address', pendleRouterAddress)) process.exit(1);

  console.log(`\t Governance manager used = ${governanceManagerMain}`);
  console.log(`\t Forge Id used = ${consts.common.FORGE_SUSHISWAP_COMPLEX}`);
  console.log(`\t PendleRouter address used = ${pendleRouterAddress}`);
  console.log(`\t SUSHI_ADDRESS used = ${consts.misc.SUSHI_ADDRESS}`);

  const sushiComplexRewardManager = await deployWithName(
    hre,
    deployment,
    'PendleRewardManager',
    'PendleRewardManagerSushiswapComplex',
    [governanceManagerMain, consts.common.FORGE_SUSHISWAP_COMPLEX]
  );

  const sushiComplexYieldContractDeployer = await deploy(
    hre,
    deployment,
    'PendleSushiswapComplexYieldContractDeployer',
    [governanceManagerMain, consts.common.FORGE_SUSHISWAP_COMPLEX, consts.misc.MASTER_CHEF]
  );

  const pendleSushiswapComplexForge = await deploy(hre, deployment, 'PendleSushiswapComplexForge', [
    governanceManagerMain,
    pendleRouterAddress,
    consts.common.FORGE_SUSHISWAP_COMPLEX,
    consts.misc.SUSHI_ADDRESS,
    sushiComplexRewardManager.address,
    sushiComplexYieldContractDeployer.address,
    consts.common.CODE_HASH_SUSHISWAP,
    consts.misc.SUSHISWAP_PAIR_FACTORY,
    consts.misc.MASTER_CHEF,
  ]);

  await sendAndWaitForTransaction(
    hre,
    sushiComplexRewardManager.initialize,
    'initialise sushiswapSimpleRewardManager',
    [pendleSushiswapComplexForge.address]
  );

  await sendAndWaitForTransaction(
    hre,
    sushiComplexYieldContractDeployer.initialize,
    'initialize sushiswapSimpleYieldContractDeployer',
    [pendleSushiswapComplexForge.address]
  );
  console.log(`\t Done step 14`);
}
