import { Deployment, validAddress, deploy, getContractFromDeployment } from '../helpers/deployHelpers';

export async function step8(deployer: any, hre: any, deployment: Deployment, consts: any) {
  const governanceManager = deployment.contracts.PendleGovernanceManager.address;
  const pendleRouterAddress = deployment.contracts.PendleRouter.address;

  if (!validAddress('Governance manager', governanceManager)) process.exit(1);
  if (!validAddress('PendleRouter address', pendleRouterAddress)) process.exit(1);

  console.log(`\tPendleRouter address used = ${pendleRouterAddress}`);
  console.log(`\tGovernance manager used = ${governanceManager}`);
  console.log(`\tCOMPOUND_COMPTROLLER_ADDRESS used = ${consts.misc.COMPOUND_COMPTROLLER_ADDRESS}`);
  console.log(`\tForge Id used = ${consts.misc.FORGE_COMPOUND}`);

  const cRewardManager = await deploy(hre, deployment, 'PendleRewardManager', [
    governanceManager,
    consts.misc.FORGE_COMPOUND,
  ]);

  //TODO: change it to a Compound one
  const cYieldContractDeployer = await deploy(hre, deployment, 'PendleCompoundYieldContractDeployer', [
    governanceManager,
    consts.misc.FORGE_COMPOUND,
  ]);

  const pendleCompoundForge = await deploy(hre, deployment, 'PendleCompoundForge', [
    governanceManager,
    pendleRouterAddress,
    consts.misc.COMPOUND_COMPTROLLER_ADDRESS,
    consts.misc.FORGE_COMPOUND,
    consts.misc.COMP_ADDRESS,
    cRewardManager.address,
    cYieldContractDeployer.address,
    consts.tokens.WETH.compound,
  ]);

  await cRewardManager.initialize(pendleCompoundForge.address);
  await cYieldContractDeployer.initialize(pendleCompoundForge.address);

  const pendleCompoundMarketFactory = await deploy(hre, deployment, 'PendleCompoundMarketFactory', [
    pendleRouterAddress,
    consts.misc.FORGE_COMPOUND,
  ]);

  const pendleData = await getContractFromDeployment(hre, deployment, 'PendleData');
  const pendleRouter = await getContractFromDeployment(hre, deployment, 'PendleRouter');
  await pendleData.addMarketFactory(consts.misc.MARKET_FACTORY_COMPOUND, pendleCompoundMarketFactory.address);
  await pendleData.addForge(consts.misc.FORGE_COMPOUND, pendleCompoundForge.address);

  if (!['mainnet'].includes(hre.network.name)) {
    await pendleData.setForgeFactoryValidity(consts.misc.FORGE_COMPOUND, consts.misc.MARKET_FACTORY_COMPOUND, true);
  } else {
    console.log('[NOTICE - TODO] We will need to use the governance multisig to setForgeFactoryValidity for Compound');
    const txDetails = await pendleData.populateTransaction.setForgeFactoryValidity(
      consts.misc.FORGE_COMPOUND,
      consts.misc.MARKET_FACTORY_COMPOUND,
      true
    );
    console.log(`[NOTICE - TODO] Transaction details: \n${JSON.stringify(txDetails, null, '  ')}`);
  }
}
