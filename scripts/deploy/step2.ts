import { Deployment, validAddress, deployWithName } from '../helpers/deployHelpers';

export async function step2(deployer: any, hre: any, deployment: Deployment, consts: any) {
  const governanceMultisig = deployment.variables.GOVERNANCE_MULTISIG;
  const forgeEmergencyHandler = deployment.variables.FORGE_EMERGENCY_HANDLER;
  const marketEmergencyHandler = deployment.variables.MARKET_EMERGENCY_HANDLER;
  const liqMiningEmergencyHandler = deployment.variables.LIQ_MINING_EMERGENCY_HANDLER;

  console.log(`\t deployer (temporary governance) = ${deployer.address}`);
  console.log(`\t governanceMultisig = ${governanceMultisig}`);
  console.log(`\t forgeEmergencyHandler = ${forgeEmergencyHandler}`);
  console.log(`\t marketEmergencyHandler = ${marketEmergencyHandler}`);
  console.log(`\t liqMiningEmergencyHandler = ${liqMiningEmergencyHandler}`);

  const governanceManagerMain = await deployWithName(
    hre,
    deployment,
    'PendleGovernanceManager',
    'PendleGovernanceManagerMain',
    [deployer.address]
  );

  const governanceManagerLiqMining = await deployWithName(
    hre,
    deployment,
    'PendleGovernanceManager',
    'PendleGovernanceManagerLiqMining',
    [deployer.address]
  );

  const pausingManagerMain = await deployWithName(hre, deployment, 'PendlePausingManager', 'PendlePausingManagerMain', [
    governanceManagerMain.address,
    forgeEmergencyHandler,
    marketEmergencyHandler,
    liqMiningEmergencyHandler,
  ]);

  const pausingManagerLiqMining = await deployWithName(
    hre,
    deployment,
    'PendlePausingManager',
    'PendlePausingManagerLiqMining',
    [governanceManagerLiqMining.address, forgeEmergencyHandler, marketEmergencyHandler, liqMiningEmergencyHandler]
  );
}
