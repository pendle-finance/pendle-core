import {
  Deployment,
  validAddress,
  deploy,
  deployWithName,
  sendAndWaitForTransaction,
  getContractFromDeployment,
} from '../helpers/deployHelpers';

export async function step19(deployer: any, hre: any, deployment: Deployment, consts: any) {
  const governanceManagerMain = deployment.contracts.PendleGovernanceManagerMain.address;
  const pendleRouterAddress = deployment.contracts.PendleRouter.address;

  if (!validAddress('Governance manager', governanceManagerMain)) process.exit(1);
  if (!validAddress('PendleRouter address', pendleRouterAddress)) process.exit(1);

  console.log(`\t Governance manager used = ${governanceManagerMain}`);
  console.log(`\t Forge Id used = ${consts.misc.FORGE_BENQI}`);
  console.log(`\t PendleRouter address used = ${pendleRouterAddress}`);
  console.log(`\t BENQI_ADDRESS used = ${consts.misc.BENQI_ADDRESS}`);

  const benqiRewardManager = await deployWithName(
    hre,
    deployment,
    'PendleRewardManagerMulti',
    'PendleRewardManagerBenqi',
    [
      governanceManagerMain,
      consts.misc.FORGE_BENQI,
      [consts.misc.FACTORY_TRADER_JOE, consts.misc.CODE_HASH_TRADER_JOE, consts.misc.KYBER_DMM_FACTORY],
    ]
  );

  const benqiYieldContractDeployer = await deploy(hre, deployment, 'PendleBenQiYieldContractDeployer', [
    governanceManagerMain,
    consts.misc.FORGE_BENQI,
    consts.misc.BENQI_COMPTROLLER_ADDRESS,
  ]);

  const benqiForge = await deploy(hre, deployment, 'PendleBenQiForge', [
    governanceManagerMain,
    pendleRouterAddress,
    consts.misc.BENQI_COMPTROLLER_ADDRESS,
    consts.misc.FORGE_BENQI,
    consts.misc.BENQI_ADDRESS,
    benqiRewardManager.address,
    benqiYieldContractDeployer.address,
    consts.misc.BENQI_AVAX,
  ]);

  await sendAndWaitForTransaction(hre, benqiRewardManager.initialize, 'initialise benqiYieldRewardManager', [
    benqiForge.address,
  ]);

  await sendAndWaitForTransaction(hre, benqiYieldContractDeployer.initialize, 'initialize benqiYieldContractDeployer', [
    benqiForge.address,
  ]);

  const pendleData = await getContractFromDeployment(hre, deployment, 'PendleData');
  console.log(`\t pendleData.address = ${pendleData.address}`);
  await sendAndWaitForTransaction(hre, pendleData.addForge, 'add benqi forge', [
    consts.misc.FORGE_BENQI,
    benqiForge.address,
  ]);
  await sendAndWaitForTransaction(hre, pendleData.setForgeFactoryValidity, 'set forge-factory validity for benqi', [
    consts.misc.FORGE_BENQI,
    consts.common.MARKET_FACTORY_GENERIC,
    true,
  ]);

  console.log(`\t Done step 19`);
}
