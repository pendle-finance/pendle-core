import { Deployment, validAddress, deploy, deployWithName, sendAndWaitForTransaction } from '../helpers/deployHelpers';

export async function step9(deployer: any, hre: any, deployment: Deployment, consts: any) {
  const governanceManagerMain = deployment.contracts.PendleGovernanceManagerMain.address;
  const pendleRouterAddress = deployment.contracts.PendleRouter.address;

  if (!validAddress('Governance Manager', governanceManagerMain)) process.exit(1);
  if (!validAddress('PendleRouter address', pendleRouterAddress)) process.exit(1);

  console.log(`\t Governance manager used = ${governanceManagerMain}`);
  console.log(`\t Forge Id used = ${consts.common.FORGE_AAVE_V2}`);
  console.log(`\t PendleRouter address used = ${pendleRouterAddress}`);

  console.log(`\t AAVE_V2_LENDING_POOL_ADDRESS used = ${consts.misc.AAVE_V2_LENDING_POOL_ADDRESS}`);
  console.log(`\t STKAAVE_ADDRESS used = ${consts.misc.STKAAVE_ADDRESS}`);
  console.log(`\t AAVE_INCENTIVES_CONTROLLER used = ${consts.misc.AAVE_INCENTIVES_CONTROLLER}`);

  const a2RewardManager = await deployWithName(hre, deployment, 'PendleRewardManager', 'PendleRewardManagerAaveV2', [
    governanceManagerMain,
    consts.common.FORGE_AAVE_V2,
  ]);

  const a2YieldContractDeployer = await deploy(hre, deployment, 'PendleAaveV2YieldContractDeployer', [
    governanceManagerMain,
    consts.common.FORGE_AAVE_V2,
  ]);

  const pendleAaveV2Forge = await deploy(hre, deployment, 'PendleAaveV2Forge', [
    governanceManagerMain,
    pendleRouterAddress,
    consts.misc.AAVE_V2_LENDING_POOL_ADDRESS,
    consts.common.FORGE_AAVE_V2,
    consts.misc.STKAAVE_ADDRESS,
    a2RewardManager.address,
    a2YieldContractDeployer.address,
    consts.misc.AAVE_INCENTIVES_CONTROLLER,
  ]);

  await sendAndWaitForTransaction(hre, a2RewardManager.initialize, 'initialize a2RewardManager', [
    pendleAaveV2Forge.address,
  ]);

  await sendAndWaitForTransaction(hre, a2YieldContractDeployer.initialize, 'initialize a2YieldContractDeployer', [
    pendleAaveV2Forge.address,
  ]);

  const pendleAaveMarketFactory = await deploy(hre, deployment, 'PendleAaveMarketFactory', [
    pendleRouterAddress,
    consts.common.MARKET_FACTORY_AAVE,
  ]);

  console.log(`\t Done step 9, pendleAaveMarketFactory = ${pendleAaveMarketFactory.address}`);
}
