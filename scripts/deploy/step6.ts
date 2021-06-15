import {
  Deployment,
  validAddress,
  sendAndWaitForTransaction,
  getContractFromDeployment,
} from '../helpers/deployHelpers';

export async function step6(_: any, hre: any, deployment: Deployment, consts: any) {
  const pendleRouterAddress = deployment.contracts.PendleRouter.address;

  if (!validAddress('PendleRouter address', pendleRouterAddress)) process.exit(1);
  console.log(`\t\tpendleRouterAddress used = ${pendleRouterAddress}`);

  const pendleData = await getContractFromDeployment(hre, deployment, 'PendleData');
  console.log(`\t\tPendleData address = ${pendleData.address}`);
  await sendAndWaitForTransaction(hre, pendleData.initialize, 'initialize PendleData', [pendleRouterAddress]);
}
