import {
  Deployment,
  validAddress,
  deploy,
  getContractFromDeployment,
  sendAndWaitForTransaction,
} from '../helpers/deployHelpers';

export async function step11(deployer: any, hre: any, deployment: Deployment, consts: any) {
  const pendleCompoundForgeAddress =
    hre.network.name != 'polygon' && !process.env.ISPOLYGON ? deployment.contracts.PendleCompoundForge.address : '';
  const pendleCompoundMarketFactoryAddress =
    hre.network.name != 'polygon' && !process.env.ISPOLYGON
      ? deployment.contracts.PendleCompoundMarketFactory.address
      : '';
  const pendleAaveV2ForgeAddress = deployment.contracts.PendleAaveV2Forge.address;
  const pendleAaveMarketFactoryAddress = deployment.contracts.PendleAaveMarketFactory.address;

  if (hre.network.name != 'polygon' && !process.env.ISPOLYGON) {
    if (!validAddress('pendleCompoundForge', pendleCompoundForgeAddress)) process.exit(1);
    if (!validAddress('pendleCompoundMarketFactory', pendleCompoundMarketFactoryAddress)) process.exit(1);
  }
  if (!validAddress('pendleAaveV2ForgeAddress', pendleAaveV2ForgeAddress)) process.exit(1);
  if (!validAddress('pendleAaveMarketFactoryAddress', pendleAaveMarketFactoryAddress)) process.exit(1);

  if (hre.network.name != 'polygon' && !process.env.ISPOLYGON) {
    console.log(`\t pendleCompoundForgeAddress used = ${pendleCompoundForgeAddress}`);
    console.log(`\t pendleCompoundMarketFactoryAddress used = ${pendleCompoundMarketFactoryAddress}`);
  }
  console.log(`\t pendleAaveV2ForgeAddress used = ${pendleAaveV2ForgeAddress}`);
  console.log(`\t pendleAaveMarketFactoryAddress used = ${pendleAaveMarketFactoryAddress}`);

  const pendleData = await getContractFromDeployment(hre, deployment, 'PendleData');
  console.log(`\t pendleData.address = ${pendleData.address}`);

  if (hre.network.name != 'polygon' && !process.env.ISPOLYGON) {
    await sendAndWaitForTransaction(hre, pendleData.addForge, 'add compound forge', [
      consts.common.FORGE_COMPOUND,
      pendleCompoundForgeAddress,
    ]);
    await sendAndWaitForTransaction(hre, pendleData.addMarketFactory, 'add compound market factory', [
      consts.common.MARKET_FACTORY_COMPOUND,
      pendleCompoundMarketFactoryAddress,
    ]);
    await sendAndWaitForTransaction(
      hre,
      pendleData.setForgeFactoryValidity,
      'set forge-factory validity for Compound',
      [consts.common.FORGE_COMPOUND, consts.common.MARKET_FACTORY_COMPOUND, true]
    );
  }

  // Setup for aaveV2
  await sendAndWaitForTransaction(hre, pendleData.addForge, 'add aaveV2 forge', [
    consts.common.FORGE_AAVE_V2,
    pendleAaveV2ForgeAddress,
  ]);
  await sendAndWaitForTransaction(hre, pendleData.addMarketFactory, 'add aave market factory', [
    consts.common.MARKET_FACTORY_AAVE,
    pendleAaveMarketFactoryAddress,
  ]);
  await sendAndWaitForTransaction(hre, pendleData.setForgeFactoryValidity, 'set forge-factory validity for aave', [
    consts.common.FORGE_AAVE_V2,
    consts.common.MARKET_FACTORY_AAVE,
    true,
  ]);
  if (hre.network.name == 'kovan') {
    console.log(`\t Its Kovan, so we are skipping rewards for aaveV2`);
    const a2RewardManager = await hre.ethers.getContractAt(
      'PendleRewardManager',
      deployment.contracts.PendleRewardManagerAaveV2.address
    );
    await sendAndWaitForTransaction(hre, a2RewardManager.setSkippingRewards, 'set skipping rewards', [true]);
  }

  deployment.yieldContracts = {}; //reset yield contracts
}
