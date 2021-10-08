import { Deployment, validAddress, deploy } from '../helpers/deployHelpers';

export async function step1(deployer: any, hre: any, deployment: Deployment, consts: any) {
  await deploy(hre, deployment, 'PENDLE', [
    deployment.variables.GOVERNANCE_MULTISIG,
    hre.network.name != 'polygon' && !process.env.ISPOLYGON
      ? deployment.contracts.PendleTeamTokens.address
      : deployer.address,
    hre.network.name != 'polygon' && !process.env.ISPOLYGON
      ? deployment.contracts.PendleEcosystemFund.address
      : deployer.address,
    deployment.variables.SALES_MULTISIG,
    deployment.variables.LIQUIDITY_INCENTIVES_MULTISIG,
  ]);
}
