import { Deployment, validAddress, deploy, deployWithName, sendAndWaitForTransaction } from '../helpers/deployHelpers';

export async function step15(deployer: any, hre: any, deployment: Deployment, consts: any) {
  const governanceManagerMain = deployment.contracts.PendleGovernanceManagerMain.address;
  const pendleRouterAddress = deployment.contracts.PendleRouter.address;

  if (!validAddress('Governance manager', governanceManagerMain)) process.exit(1);
  if (!validAddress('PendleRouter address', pendleRouterAddress)) process.exit(1);

  console.log(`\t Governance manager used = ${governanceManagerMain}`);
  console.log(`\t Forge Id used = ${consts.common.FORGE_COMPOUNDV2}`);
  console.log(`\t PendleRouter address used = ${pendleRouterAddress}`);
  console.log(`\t COMP_ADDRESS used = ${consts.misc.COMP_ADDRESS}`);

  const compoundV2RewardManager = await deployWithName(
    hre,
    deployment,
    'PendleRewardManager',
    'PendleRewardManagerCompoundV2',
    [governanceManagerMain, consts.common.FORGE_COMPOUNDV2]
  );

  const compoundV2YieldContractDeployer = await deploy(hre, deployment, 'PendleCompoundV2YieldContractDeployer', [
    governanceManagerMain,
    consts.common.FORGE_COMPOUNDV2,
  ]);

  const pendleCompoundV2Forge = await deploy(hre, deployment, 'PendleCompoundV2Forge', [
    governanceManagerMain,
    pendleRouterAddress,
    consts.misc.COMPOUND_COMPTROLLER_ADDRESS,
    consts.common.FORGE_COMPOUNDV2,
    consts.misc.COMP_ADDRESS,
    compoundV2RewardManager.address,
    compoundV2YieldContractDeployer.address,
    consts.tokens.WETH.compound,
  ]);

  await sendAndWaitForTransaction(hre, compoundV2RewardManager.initialize, 'initialise sushiswapSimpleRewardManager', [
    pendleCompoundV2Forge.address,
  ]);

  await sendAndWaitForTransaction(
    hre,
    compoundV2YieldContractDeployer.initialize,
    'initialize compoundV2YieldContractDeployer',
    [pendleCompoundV2Forge.address]
  );
  console.log(`\t Done step 15`);
}
