import { Deployment, validAddress, deploy } from '../helpers/deployHelpers';

export async function step5(deployer: any, hre: any, deployment: Deployment, consts: any) {
  const wethAddress = consts.tokens.WETH.address;
  const pendleDataAddress = deployment.contracts.PendleData.address;
  const governanceManagerMain = deployment.contracts.PendleGovernanceManagerMain.address;

  if (!validAddress('pendleDataAddress', pendleDataAddress)) process.exit(1);
  if (!validAddress('governanceManagerMain', governanceManagerMain)) process.exit(1);
  if (!validAddress('WETH address', wethAddress)) process.exit(1);

  console.log(`\t\tpendleDataAddress used = ${pendleDataAddress}`);
  console.log(`\t\tgovernanceManagerMain used = ${governanceManagerMain}`);
  console.log(`\t\tWETH used = ${wethAddress}`);

  await deploy(hre, deployment, 'PendleRouter', [governanceManagerMain, wethAddress, pendleDataAddress]);
}
