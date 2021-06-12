import { Deployment, validAddress, deploy } from '../helpers/deployHelpers';

export async function step4(deployer: any, hre: any, deployment: Deployment, consts: any) {
  const pendleDataAddress = deployment.contracts.PendleData.address;
  if (!validAddress('PendleData address', pendleDataAddress)) process.exit(1);
  console.log(`\t pendleDataAddress = ${pendleDataAddress}`);

  await deploy(hre, deployment, 'PendleMarketReader', [pendleDataAddress]);
}
