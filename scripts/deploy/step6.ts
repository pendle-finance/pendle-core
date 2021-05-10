import { Deployment, validAddress, deploy, getContractFromDeployment } from '../helpers/deployHelpers';

export async function step6(deployer: any, hre: any, deployment: Deployment, consts: any) {
  const pendleRouterAddress = deployment.contracts.PendleRouter.address;
  const pendleDataAddress = deployment.contracts.PendleData.address;

  // if (!validAddress("PendleRouter address", pendleRouterAddress))
  //   process.exit(1);
  // if (!validAddress("PendleData address", pendleDataAddress)) process.exit(1);
  //
  // const pendleRouter = await getContractFromDeployment(
  //   hre,
  //   deployment,
  //   "PendleRouter"
  // );
  // await pendleRouter.initialize(pendleDataAddress);
  // console.log(`\tPendleRouter address used = ${pendleRouterAddress}`);
  // console.log(`\tPendleData address used = ${pendleDataAddress}`);
}
