import {
  Deployment,
  validAddress,
  deploy,
  getContractFromDeployment,
  sendAndWaitForTransaction,
} from '../helpers/deployHelpers';

export async function step17(deployer: any, hre: any, deployment: Deployment, consts: any) {
  const pendleSushiswapSimpleForgeAddress = deployment.contracts.PendleSushiswapSimpleForge.address;
  const pendleSushiswapComplexForgeAddress = deployment.contracts.PendleSushiswapComplexForge.address;
  const pendleCompoundV2ForgeAddress =
    hre.network.name != 'polygon' && !process.env.ISPOLYGON ? deployment.contracts.PendleCompoundV2Forge.address : '';
  const pendleGenericMarketFactoryAddress = deployment.contracts.PendleGenericMarketFactory.address;

  if (!validAddress('pendleSushiswapSimpleForgeAddress', pendleSushiswapSimpleForgeAddress)) process.exit(1);
  if (!validAddress('pendleSushiswapComplexForgeAddress', pendleSushiswapComplexForgeAddress)) process.exit(1);
  if (hre.network.name != 'polygon' && !process.env.ISPOLYGON) {
    if (!validAddress('pendleCompoundV2ForgeAddress', pendleCompoundV2ForgeAddress)) process.exit(1);
  }
  if (!validAddress('pendleGenericMarketFactoryAddress', pendleGenericMarketFactoryAddress)) process.exit(1);

  console.log(`\t pendleSushiswapSimpleForgeAddress used = ${pendleSushiswapSimpleForgeAddress}`);
  console.log(`\t pendleSushiswapComplexForgeAddress used = ${pendleSushiswapComplexForgeAddress}`);
  if (hre.network.name != 'polygon' && !process.env.ISPOLYGON) {
    console.log(`\t pendleCompoundV2ForgeAddress used = ${pendleCompoundV2ForgeAddress}`);
  }
  console.log(`\t pendleGenericMarketFactoryAddress used = ${pendleGenericMarketFactoryAddress}`);

  const pendleData = await getContractFromDeployment(hre, deployment, 'PendleData');
  console.log(`\t pendleData.address = ${pendleData.address}`);
  console.log(`\t MARKET_FACTORY_GENERIC = ${consts.common.MARKET_FACTORY_GENERIC}`);
  console.log(`\t FORGE_SUSHISWAP_SIMPLE = ${consts.common.FORGE_SUSHISWAP_SIMPLE}`);
  console.log(`\t FORGE_SUSHISWAP_COMPLEX = ${consts.common.FORGE_SUSHISWAP_COMPLEX}`);
  if (hre.network.name != 'polygon' && !process.env.ISPOLYGON) {
    console.log(`\t FORGE_COMPOUNDV2 = ${consts.common.FORGE_COMPOUNDV2}`);
  }
  await sendAndWaitForTransaction(hre, pendleData.addMarketFactory, 'add generic market factory', [
    consts.common.MARKET_FACTORY_GENERIC,
    pendleGenericMarketFactoryAddress,
  ]);

  // Setup for Sushiswap Simple
  await sendAndWaitForTransaction(hre, pendleData.addForge, 'add Sushiswap Simple forge', [
    consts.common.FORGE_SUSHISWAP_SIMPLE,
    pendleSushiswapSimpleForgeAddress,
  ]);
  await sendAndWaitForTransaction(
    hre,
    pendleData.setForgeFactoryValidity,
    'set forge-factory validity for Sushiswap Simple',
    [consts.common.FORGE_SUSHISWAP_SIMPLE, consts.common.MARKET_FACTORY_GENERIC, true]
  );

  // Setup for Sushiswap Complex
  await sendAndWaitForTransaction(hre, pendleData.addForge, 'add Sushiswap Complex forge', [
    consts.common.FORGE_SUSHISWAP_COMPLEX,
    pendleSushiswapComplexForgeAddress,
  ]);
  await sendAndWaitForTransaction(
    hre,
    pendleData.setForgeFactoryValidity,
    'set forge-factory validity for Sushiswap Complex',
    [consts.common.FORGE_SUSHISWAP_COMPLEX, consts.common.MARKET_FACTORY_GENERIC, true]
  );

  if (hre.network.name != 'polygon' && !process.env.ISPOLYGON) {
    // Setup for CompoundV2
    await sendAndWaitForTransaction(hre, pendleData.addForge, 'add CompoundV2 forge', [
      consts.common.FORGE_COMPOUNDV2,
      pendleCompoundV2ForgeAddress,
    ]);
    await sendAndWaitForTransaction(
      hre,
      pendleData.setForgeFactoryValidity,
      'set forge-factory validity for compoundV2',
      [consts.common.FORGE_COMPOUNDV2, consts.common.MARKET_FACTORY_GENERIC, true]
    );
  }
  console.log(`\t Done step 17`);
}
