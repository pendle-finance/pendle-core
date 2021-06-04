import { Deployment, validAddress, deploy, getContractFromDeployment } from '../helpers/deployHelpers';

export async function step7(deployer: any, hre: any, deployment: Deployment, consts: any) {
  // const governanceManager = deployment.contracts.PendleGovernanceManager.address;
  // const pendleRouterAddress = deployment.contracts.PendleRouter.address;
  //
  // if (!validAddress('GovernanceManager', governanceManager)) process.exit(1);
  // if (!validAddress('PendleRouter address', pendleRouterAddress)) process.exit(1);
  //
  // console.log(`\tPendleRouter address used = ${pendleRouterAddress}`);
  // console.log(`\tGovernanceManager used = ${governanceManager}`);
  // console.log(`\tAAVE_LENDING_POOL_CORE_ADDRESS used = ${consts.misc.AAVE_LENDING_POOL_CORE_ADDRESS}`);
  // console.log(`\tForge Id used = ${consts.misc.FORGE_AAVE}`);
  //
  // const aRewardManager = await deploy(hre, deployment, 'PendleRewardManager', [
  //   governanceManager,
  //   consts.misc.FORGE_AAVE,
  // ]);
  //
  // const aYieldContractDeployer = await deploy(hre, deployment, 'PendleAaveYieldContractDeployer', [
  //   governanceManager,
  //   consts.misc.FORGE_AAVE,
  // ]);
  //
  // const pendleAaveForge = await deploy(hre, deployment, 'PendleAaveV2Forge', [
  //   governanceManager,
  //   pendleRouterAddress,
  //   consts.misc.AAVE_LENDING_POOL_CORE_ADDRESS,
  //   consts.misc.FORGE_AAVE,
  //   consts.misc.STKAAVE_ADDRESS,
  //   aRewardManager.address,
  //   aYieldContractDeployer.address,
  // ]);
  //
  // await aRewardManager.initialize(pendleAaveForge.address);
  // await aYieldContractDeployer.initialize(pendleAaveForge.address);
  // const pendleAaveMarketFactory = await deploy(hre, deployment, 'PendleAaveMarketFactory', [
  //   pendleRouterAddress,
  //   consts.misc.MARKET_FACTORY_AAVE,
  // ]);
  //
  // const pendleData = await getContractFromDeployment(hre, deployment, 'PendleData');
  // const pendleRouter = await getContractFromDeployment(hre, deployment, 'PendleRouter');
  //
  // await pendleData.addMarketFactory(consts.misc.MARKET_FACTORY_AAVE, pendleAaveMarketFactory.address);
  // await pendleData.addForge(consts.misc.FORGE_AAVE, pendleAaveForge.address);
  //
  // if (!['kovan', 'mainnet'].includes(hre.network.name)) {
  //   await pendleData.setForgeFactoryValidity(consts.misc.FORGE_AAVE, consts.misc.MARKET_FACTORY_AAVE, true);
  // } else {
  //   console.log('[NOTICE - TODO] We will need to use the governance multisig to setForgeFactoryValidity for Aave');
  //   const txDetails = await pendleData.populateTransaction.setForgeFactoryValidity(
  //     consts.misc.FORGE_AAVE,
  //     consts.misc.MARKET_FACTORY_AAVE,
  //     true
  //   );
  //   console.log(`[NOTICE - TODO] Transaction details: \n${JSON.stringify(txDetails, null, '  ')}`);
  // }
}
