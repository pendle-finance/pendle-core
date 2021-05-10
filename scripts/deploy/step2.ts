import { Deployment, validAddress, deploy } from '../helpers/deployHelpers';

export async function step2(deployer: any, hre: any, deployment: Deployment, consts: any) {
  // We will use the governance multisig as the treasury address as well.
  const treasuryAddress = deployment.variables.GOVERNANCE_MULTISIG;

  if (!validAddress('GOVERNANCE_MULTISIG', treasuryAddress)) process.exit(1);

  console.log(
    `\t\tTreasury address = ${treasuryAddress} (same as GOVERNANCE_MULTISIG)`
  );
  const governanceMultisig = deployment.variables.GOVERNANCE_MULTISIG;
  const forgeEmergencyHandler = deployment.variables.FORGE_EMERGENCY_HANDLER;
  const marketEmergencyHandler = deployment.variables.MARKET_EMERGENCY_HANDLER;
  const pausingManager = await deploy(hre, deployment, "PendlePausingManager", [
    governanceMultisig,
    forgeEmergencyHandler,
    marketEmergencyHandler,
  ]);

  const data = await deploy(hre, deployment, "PendleData", [
    deployment.variables.GOVERNANCE_MULTISIG,
    treasuryAddress,
    pausingManager.address,
  ]);
}
