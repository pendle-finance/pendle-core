import { Deployment, validAddress, deploy, getContractFromDeployment, sendAndWaitForTransaction } from '../helpers/deployHelpers';

export async function step12(deployer: any, hre: any, deployment: Deployment, consts: any) {
  const governanceMultisig = deployment.variables.GOVERNANCE_MULTISIG;

  if (!validAddress('governanceMultisig', governanceMultisig)) process.exit(1);
  console.log(`\t  !! governanceMultisig !! = ${governanceMultisig}`);

  const governanceManagerMain = await hre.ethers.getContractAt('PendleGovernanceManager', deployment.contracts.PendleGovernanceManagerMain.address);
  console.log(`\t governanceManagerMain.address = ${governanceManagerMain.address}`);

  await sendAndWaitForTransaction(hre, governanceManagerMain.transferGovernance, 'transferGovernance', [
    governanceMultisig
  ]);

  console.log(`\t governance multisig needs to call claimGovernance() to ${governanceManagerMain.address} now `);
}
