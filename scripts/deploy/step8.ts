import { Deployment, validAddress, deploy, deployWithName, sendAndWaitForTransaction } from '../helpers/deployHelpers';

export async function step8(deployer: any, hre: any, deployment: Deployment, consts: any) {
  const governanceManagerMain = deployment.contracts.PendleGovernanceManagerMain.address;
  const pendleRouterAddress = deployment.contracts.PendleRouter.address;

  if (!validAddress('Governance manager', governanceManagerMain)) process.exit(1);
  if (!validAddress('PendleRouter address', pendleRouterAddress)) process.exit(1);

  console.log(`\t Governance manager used = ${governanceManagerMain}`);
  console.log(`\t Forge Id used = ${consts.common.FORGE_COMPOUND}`);
  console.log(`\t PendleRouter address used = ${pendleRouterAddress}`);
  console.log(`\t COMPOUND_COMPTROLLER_ADDRESS used = ${consts.misc.COMPOUND_COMPTROLLER_ADDRESS}`);
  console.log(`\t COMP_ADDRESS used = ${consts.misc.COMP_ADDRESS}`);
  console.log(`\t cEther used = ${consts.tokens.WETH.compound}`);

  const cRewardManager = await deployWithName(hre, deployment, 'PendleRewardManager', 'PendleRewardManagerCompound', [
    governanceManagerMain,
    consts.common.FORGE_COMPOUND,
  ]);

  const cYieldContractDeployer = await deploy(hre, deployment, 'PendleCompoundYieldContractDeployer', [
    governanceManagerMain,
    consts.common.FORGE_COMPOUND,
  ]);

  const pendleCompoundForge = await deploy(hre, deployment, 'PendleCompoundForge', [
    governanceManagerMain,
    pendleRouterAddress,
    consts.misc.COMPOUND_COMPTROLLER_ADDRESS,
    consts.common.FORGE_COMPOUND,
    consts.misc.COMP_ADDRESS,
    cRewardManager.address,
    cYieldContractDeployer.address,
    consts.tokens.WETH.compound,
  ]);

  await sendAndWaitForTransaction(hre, cRewardManager.initialize, 'initialise cRewardManager', [
    pendleCompoundForge.address,
  ]);

  await sendAndWaitForTransaction(hre, cYieldContractDeployer.initialize, 'initialize cYieldContractDeployer', [
    pendleCompoundForge.address,
  ]);

  const pendleCompoundMarketFactory = await deploy(hre, deployment, 'PendleCompoundMarketFactory', [
    pendleRouterAddress,
    consts.common.MARKET_FACTORY_COMPOUND,
  ]);
  console.log(`\t Done step 8, pendleCompoundMarketFactory = ${pendleCompoundMarketFactory.address}`);
}
