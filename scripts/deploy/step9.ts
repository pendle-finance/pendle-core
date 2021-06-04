import { Deployment, validAddress, deploy, getContractFromDeployment } from '../helpers/deployHelpers';

export async function step9(deployer: any, hre: any, deployment: Deployment, consts: any) {
  const governanceManager = deployment.contracts.PendleGovernanceManager.address;
  const pendleRouterAddress = deployment.contracts.PendleRouter.address;

  if (!validAddress('Governance Manager', governanceManager)) process.exit(1);
  if (!validAddress('PendleRouter address', pendleRouterAddress)) process.exit(1);

  console.log(`\tPendleRouter address used = ${pendleRouterAddress}`);
  console.log(`\tGovernance Manager used = ${governanceManager}`);
  console.log(`\tAAVE_V2_LENDING_POOL_ADDRESS used = ${consts.misc.AAVE_V2_LENDING_POOL_ADDRESS}`);
  console.log(`\tForge Id used = ${consts.misc.FORGE_AAVE_V2}`);

  const a2RewardManager = await deploy(hre, deployment, 'PendleRewardManager', [
    governanceManager,
    consts.misc.FORGE_AAVE_V2,
  ]);

  //TODO: use proper V2 reward manager
  const a2YieldContractDeployer = await deploy(hre, deployment, 'PendleAaveV2YieldContractDeployer', [
    governanceManager,
    consts.misc.FORGE_AAVE_V2,
  ]);

  const pendleAaveV2Forge = await deploy(hre, deployment, 'PendleAaveV2Forge', [
    governanceManager,
    pendleRouterAddress,
    consts.misc.AAVE_V2_LENDING_POOL_ADDRESS,
    consts.misc.FORGE_AAVE_V2,
    consts.misc.STKAAVE_ADDRESS,
    a2RewardManager.address,
    a2YieldContractDeployer.address,
    consts.misc.AAVE_INCENTIVES_CONTROLLER,
  ]);

  await a2RewardManager.initialize(pendleAaveV2Forge.address);

  await a2YieldContractDeployer.initialize(pendleAaveV2Forge.address);

  const pendleAaveMarketFactory = await deploy(hre, deployment, 'PendleAaveMarketFactory', [
    pendleRouterAddress,
    consts.misc.MARKET_FACTORY_AAVE,
  ]);

  const pendleData = await getContractFromDeployment(hre, deployment, 'PendleData');

  await pendleData.addForge(consts.misc.FORGE_AAVE_V2, pendleAaveV2Forge.address);
  await pendleData.addMarketFactory(consts.misc.MARKET_FACTORY_AAVE, pendleAaveMarketFactory.address);

  deployment.yieldContracts = {}; //reset yield contracts

  if (!['mainnet'].includes(hre.network.name)) {
    await pendleData.setForgeFactoryValidity(consts.misc.FORGE_AAVE_V2, consts.misc.MARKET_FACTORY_AAVE, true);
  } else {
    console.log('[NOTICE - TODO] We will need to use the governance multisig to setForgeFactoryValidity for AaveV2');
    const txDetails = await pendleData.populateTransaction.setForgeFactoryValidity(
      consts.misc.FORGE_AAVE_V2,
      consts.misc.MARKET_FACTORY_AAVE,
      true
    );
    console.log(`[NOTICE - TODO] Transaction details: \n${JSON.stringify(txDetails, null, '  ')}`);
  }
}
