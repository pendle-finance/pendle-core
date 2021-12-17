import {
  Deployment,
  validAddress,
  deploy,
  deployWithName,
  sendAndWaitForTransaction,
  getContractFromDeployment,
} from '../helpers/deployHelpers';

export async function step20(deployer: any, hre: any, deployment: Deployment, consts: any) {
  const governanceManagerMain = deployment.contracts.PendleGovernanceManagerMain.address;
  const pendleRouterAddress = deployment.contracts.PendleRouter.address;

  if (!validAddress('Governance manager', governanceManagerMain)) process.exit(1);
  if (!validAddress('PendleRouter address', pendleRouterAddress)) process.exit(1);

  console.log(`\t Governance manager used = ${governanceManagerMain}`);
  console.log(`\t Forge Id used = ${consts.misc.FORGE_TRADER_JOE}`);
  console.log(`\t PendleRouter address used = ${pendleRouterAddress}`);

  const joeRewardManager = await deployWithName(
    hre,
    deployment,
    'PendleRewardManagerMulti',
    'PendleRewardManagerTraderJoe',
    [
      governanceManagerMain,
      consts.misc.FORGE_TRADER_JOE,
      [consts.misc.FACTORY_TRADER_JOE, consts.misc.CODE_HASH_TRADER_JOE, consts.misc.KYBER_DMM_FACTORY],
    ]
  );

  const joeYieldContractDeployer = await deploy(hre, deployment, 'PendleTraderJoeYieldContractDeployer', [
    governanceManagerMain,
    consts.misc.FORGE_TRADER_JOE,
    consts.misc.JOE_MASTERCHEF_V2_ADDRESS,
  ]);

  const joeForge = await deploy(hre, deployment, 'PendleTraderJoeForge', [
    governanceManagerMain,
    pendleRouterAddress,
    consts.misc.FORGE_TRADER_JOE,
    consts.misc.JOE_ADDRESS,
    joeRewardManager.address,
    joeYieldContractDeployer.address,
    consts.misc.CODE_HASH_TRADER_JOE,
    consts.misc.FACTORY_TRADER_JOE,
    consts.misc.JOE_MASTERCHEF_V2_ADDRESS,
  ]);

  await sendAndWaitForTransaction(hre, joeRewardManager.initialize, 'initialise joeRewardManager', [joeForge.address]);

  await sendAndWaitForTransaction(hre, joeYieldContractDeployer.initialize, 'initialize joeYieldContractDeployer', [
    joeForge.address,
  ]);

  const pendleData = await getContractFromDeployment(hre, deployment, 'PendleData');
  console.log(`\t pendleData.address = ${pendleData.address}`);
  await sendAndWaitForTransaction(hre, pendleData.addForge, 'add joe forge', [
    consts.misc.FORGE_TRADER_JOE,
    joeForge.address,
  ]);
  await sendAndWaitForTransaction(hre, pendleData.setForgeFactoryValidity, 'set forge-factory validity for joe', [
    consts.misc.FORGE_TRADER_JOE,
    consts.common.MARKET_FACTORY_GENERIC,
    true,
  ]);

  console.log(`\t Done step 20`);
}
