import { Deployment, validAddress, deploy } from '../helpers/deployHelpers';

export async function step7(deployer: any, hre: any, deployment: Deployment, consts: any) {
  const pendleRouterAddress = deployment.contracts.PendleRouter.address;
  const governanceManagerLiqMining = deployment.contracts.PendleGovernanceManagerLiqMining.address;

  if (!validAddress('pendleRouterAddress', pendleRouterAddress)) process.exit(1);
  if (!validAddress('governanceManagerLiqMining', governanceManagerLiqMining)) process.exit(1);

  console.log(`\t\t pendleRouterAddress used = ${pendleRouterAddress}`);
  console.log(`\t\t governanceManagerLiqMining used = ${governanceManagerLiqMining}`);
  await deploy(hre, deployment, 'PendleRedeemProxy', [pendleRouterAddress]);

  await deploy(hre, deployment, 'PendleWhitelist', [governanceManagerLiqMining]);
}
