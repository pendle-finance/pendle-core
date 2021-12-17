import {
  Deployment,
  validAddress,
  deploy,
  deployWithName,
  sendAndWaitForTransaction,
  getContractFromDeployment,
} from '../helpers/deployHelpers';

export async function step16(deployer: any, hre: any, deployment: Deployment, consts: any) {
  const pendleRouterAddress = deployment.contracts.PendleRouter.address;
  if (!validAddress('PendleRouter address', pendleRouterAddress)) process.exit(1);
  console.log(`\t PendleRouter address used = ${pendleRouterAddress}`);

  const pendleGenericMarketFactory = await deploy(hre, deployment, 'PendleGenericMarketFactory', [
    pendleRouterAddress,
    consts.common.MARKET_FACTORY_GENERIC,
  ]);

  const pendleData = await getContractFromDeployment(hre, deployment, 'PendleData');
  await sendAndWaitForTransaction(hre, pendleData.addMarketFactory, 'Add market factory Generic', [
    consts.common.MARKET_FACTORY_GENERIC,
    pendleGenericMarketFactory.address,
  ]);
  console.log(`\t Done step 16`);
}
