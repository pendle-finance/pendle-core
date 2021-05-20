import { Deployment, validAddress, deploy } from '../helpers/deployHelpers';

export async function step4(deployer: any, hre: any, deployment: Deployment, consts: any) {
  const wethAddress = consts.tokens.WETH.address;
  const pendleDataAddress = deployment.contracts.PendleData.address;
  const governanceManager = deployment.contracts.PendleGovernanceManager.address;

  if (!validAddress('governanceManager', governanceManager)) process.exit(1);
  if (!validAddress('WETH address', wethAddress)) process.exit(1);

  console.log(`\t\tgovernanceManager used = ${governanceManager}`);
  console.log(`\t\tWETH used = ${consts.tokens.WETH.address}`);

  await deploy(hre, deployment, 'PendleRouter', [governanceManager, wethAddress, pendleDataAddress]);
}
