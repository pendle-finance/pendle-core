import { Deployment, validAddress, deploy } from '../helpers/deployHelpers';

export async function step1(deployer: any, hre: any, deployment: Deployment, consts: any) {
  await deploy(hre, deployment, 'PENDLE', [
    deployment.variables.GOVERNANCE_MULTISIG,
    deployment.contracts.PendleTeamTokens.address,
    deployment.contracts.PendleEcosystemFund.address,
    deployment.variables.SALES_MULTISIG,
    deployment.variables.LIQUIDITY_INCENTIVES_MULTISIG,
  ]);
}
