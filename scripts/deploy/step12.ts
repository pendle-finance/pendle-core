import {
  Deployment,
  validAddress,
  deploy,
  getContractFromDeployment,
  sendAndWaitForTransaction,
} from '../helpers/deployHelpers';

export async function step12(deployer: any, hre: any, deployment: Deployment, consts: any) {
  const governanceMultisig = deployment.variables.GOVERNANCE_MULTISIG;

  if (!validAddress('governanceMultisig', governanceMultisig)) process.exit(1);
  console.log(`\t  !! governanceMultisig !! = ${governanceMultisig}`);

  const governanceManagerMain = await hre.ethers.getContractAt(
    'PendleGovernanceManager',
    deployment.contracts.PendleGovernanceManagerMain.address
  );
  const governanceManagerLiqMining = await hre.ethers.getContractAt(
    'PendleGovernanceManager',
    deployment.contracts.PendleGovernanceManagerLiqMining.address
  );
  console.log(`\t governanceManagerMain.address = ${governanceManagerMain.address}`);
  console.log(`\t governanceManagerLiqMining.address = ${governanceManagerLiqMining.address}`);

  await sendAndWaitForTransaction(
    hre,
    governanceManagerMain.transferGovernance,
    'transferGovernance for GovManagerMain',
    [governanceMultisig]
  );
  await sendAndWaitForTransaction(
    hre,
    governanceManagerLiqMining.transferGovernance,
    'transferGovernance for GovManagerLiqMining',
    [governanceMultisig]
  );

  console.log(
    `\t governance multisig needs to call claimGovernance() to ${governanceManagerMain.address} and ${governanceManagerLiqMining.address} now `
  );
}
