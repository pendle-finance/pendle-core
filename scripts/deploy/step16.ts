import { Deployment, validAddress, deploy, deployWithName, sendAndWaitForTransaction } from '../helpers/deployHelpers';

export async function step16(deployer: any, hre: any, deployment: Deployment, consts: any) {
  const pendleRouterAddress = deployment.contracts.PendleRouter.address;
  if (!validAddress('PendleRouter address', pendleRouterAddress)) process.exit(1);
  console.log(`\t PendleRouter address used = ${pendleRouterAddress}`);

  const pendleGenericMarketFactory = await deploy(hre, deployment, 'PendleGenericMarketFactory', [
    pendleRouterAddress,
    consts.common.MARKET_FACTORY_GENERIC,
  ]);
  console.log(`\t Done step 16`);
}
