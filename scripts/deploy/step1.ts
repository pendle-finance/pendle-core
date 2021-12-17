import { deploy, Deployment, isNotAvax } from '../helpers/deployHelpers';

export async function step1(deployer: any, hre: any, deployment: Deployment, consts: any) {
  await deploy(hre, deployment, 'PENDLE', [
    deployment.variables.GOVERNANCE_MULTISIG,
    isNotAvax(hre) ? deployment.contracts.PendleTeamTokens.address : deployer.address,
    isNotAvax(hre) ? deployment.contracts.PendleEcosystemFund.address : deployer.address,
    deployment.variables.SALES_MULTISIG,
    deployment.variables.LIQUIDITY_INCENTIVES_MULTISIG,
  ]);
}
