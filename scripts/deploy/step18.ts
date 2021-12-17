import {
  deploy,
  Deployment,
  deployWithName,
  getContractFromDeployment,
  sendAndWaitForTransaction,
  validAddress,
  isNotAvax,
} from '../helpers/deployHelpers';
export async function step18(deployer: any, hre: any, deployment: Deployment, consts: any) {
  const governanceManagerMain = deployment.contracts.PendleGovernanceManagerMain.address;
  const pendleRouterAddress = deployment.contracts.PendleRouter.address;
  const pendleGenericMarketFactoryAddress = deployment.contracts.PendleGenericMarketFactory.address;

  if (!validAddress('Governance manager', governanceManagerMain)) process.exit(1);
  if (!validAddress('PendleRouter address', pendleRouterAddress)) process.exit(1);
  if (!validAddress('pendleGenericMarketFactoryAddress', pendleGenericMarketFactoryAddress)) process.exit(1);

  const forgeId = isNotAvax(hre) ? consts.common.FORGE_UNISWAPV2 : consts.misc.FORGE_TRADER_JOE_SIMPLE;
  console.log(`\t Governance manager used = ${governanceManagerMain}`);
  console.log(`\t Forge Id used = ${forgeId}`);
  console.log(`\t PendleRouter address used = ${pendleRouterAddress}`);

  const uniswapV2RewardManager = await deployWithName(
    hre,
    deployment,
    'PendleRewardManager',
    'PendleRewardManagerUniswapV2',
    [governanceManagerMain, forgeId]
  );

  const uniswapV2YieldContractDeployer = await deploy(hre, deployment, 'PendleYieldContractDeployerBaseV2', [
    governanceManagerMain,
    forgeId,
  ]);

  const pendleUniswapV2Forge = await deploy(hre, deployment, 'PendleUniswapV2Forge', [
    governanceManagerMain,
    pendleRouterAddress,
    forgeId,
    consts.tokens.USDC.address, //dummy reward token
    uniswapV2RewardManager.address,
    uniswapV2YieldContractDeployer.address,
    isNotAvax(hre) ? consts.common.CODE_HASH_UNISWAP : consts.misc.CODE_HASH_TRADER_JOE,
    isNotAvax(hre) ? consts.misc.UNISWAP_PAIR_FACTORY : consts.misc.FACTORY_TRADER_JOE,
  ]);

  await sendAndWaitForTransaction(hre, uniswapV2RewardManager.initialize, 'initialise uniswapV2RewardManager', [
    pendleUniswapV2Forge.address,
  ]);

  await sendAndWaitForTransaction(
    hre,
    uniswapV2YieldContractDeployer.initialize,
    'initialize uniswapV2YieldContractDeployer',
    [pendleUniswapV2Forge.address]
  );

  const pendleData = await getContractFromDeployment(hre, deployment, 'PendleData');
  console.log(`\t pendleGenericMarketFactoryAddress used = ${pendleGenericMarketFactoryAddress}`);
  console.log(`\t pendleData.address = ${pendleData.address}`);
  console.log(`\t MARKET_FACTORY_GENERIC = ${consts.common.MARKET_FACTORY_GENERIC}`);

  // Setup for UniswapV2
  await sendAndWaitForTransaction(hre, pendleData.addForge, 'add UniswapV2 forge', [
    forgeId,
    pendleUniswapV2Forge.address,
  ]);
  await sendAndWaitForTransaction(hre, pendleData.setForgeFactoryValidity, 'set forge-factory validity for uniswapV2', [
    forgeId,
    consts.common.MARKET_FACTORY_GENERIC,
    true,
  ]);

  console.log(`\t Done step 18`);
}
