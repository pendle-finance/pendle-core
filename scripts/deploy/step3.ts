import { Deployment, validAddress, deploy } from '../helpers/deployHelpers';

export async function step3(deployer: any, hre: any, deployment: Deployment, consts: any) {
  // We will use the governance multisig as the treasury address as well.
  const treasuryAddress = deployment.variables.TREASURY_MULTISIG;
  const governanceManagerMainAddress = deployment.contracts.PendleGovernanceManagerMain.address;
  const pausingManagerMainAddress = deployment.contracts.PendlePausingManagerMain.address;

  if (!validAddress('treasuryAddress', treasuryAddress)) process.exit(1);
  if (!validAddress('governanceManagerMainAddress', governanceManagerMainAddress)) process.exit(1);
  if (!validAddress('pausingManagerMainAddress', pausingManagerMainAddress)) process.exit(1);

  console.log(`\t\tTreasury address = ${treasuryAddress}`);
  console.log(`\t governanceManagerMainAddress = ${governanceManagerMainAddress}`);
  console.log(`\t pausingManagerMainAddress = ${pausingManagerMainAddress}`);

  const pendleData = await deploy(hre, deployment, 'PendleData', [
    governanceManagerMainAddress,
    treasuryAddress,
    pausingManagerMainAddress,
  ]);
}
