import { DeployOrFetch } from '..';
import { deployOrFetchContract } from '../helpers/contract-helpers';
import { PendleEnv } from '../type/pendle-env';
import { sendAndWaitForTransaction } from '../helpers';

export async function deployGovernanceAndPausingManagers(env: PendleEnv, runMode: DeployOrFetch) {
  const forgeEmergencyHandler = env.consts.common.FORGE_EMERGENCY_HANDLER;
  const marketEmergencyHandler = env.consts.common.MARKET_EMERGENCY_HANDLER;
  const liqMiningEmergencyHandler = env.consts.common.LIQ_MINING_EMERGENCY_HANDLER;

  env.governanceManagerMain = await deployOrFetchContract(
    env,
    runMode,
    'PendleGovernanceManagerMain',
    'PendleGovernanceManager',
    [env.deployer.address]
  );

  env.governanceManagerLiqMining = await deployOrFetchContract(
    env,
    runMode,
    'PendleGovernanceManagerLiqMining',
    'PendleGovernanceManager',
    [env.deployer.address]
  );

  env.pausingManagerMain = await deployOrFetchContract(
    env,
    runMode,
    'PendlePausingManagerMain',
    'PendlePausingManager',
    [env.governanceManagerMain.address, forgeEmergencyHandler, marketEmergencyHandler, liqMiningEmergencyHandler]
  );

  env.pausingManagerLiqMining = await deployOrFetchContract(
    env,
    runMode,
    'PendlePausingManagerLiqMining',
    'PendlePausingManager',
    [env.governanceManagerLiqMining.address, forgeEmergencyHandler, marketEmergencyHandler, liqMiningEmergencyHandler]
  );

  env.pausingManagerLiqMiningV2 = await deployOrFetchContract(
    env,
    runMode,
    'PendlePausingManagerLiqMiningV2',
    'PendlePausingManager',
    [env.governanceManagerLiqMining.address, forgeEmergencyHandler, marketEmergencyHandler, liqMiningEmergencyHandler]
  );
}

export async function transferGovernance(env: PendleEnv) {
  await sendAndWaitForTransaction(
    env.governanceManagerMain.transferGovernance,
    'transferGovernance for GovManagerMain',
    [env.consts.common.GOVERNANCE_MULTISIG]
  );
  await sendAndWaitForTransaction(
    env.governanceManagerLiqMining.transferGovernance,
    'transferGovernance for GovManagerLiqMining',
    [env.consts.common.GOVERNANCE_MULTISIG]
  );
}
