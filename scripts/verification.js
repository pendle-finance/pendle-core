require('@nomiclabs/hardhat-ethers');
const { utils } = require('ethers');
const deployment = require('../deployments/mainnet.json');
const { kovanConstants, mainnetConstants } = require('./helpers/constants');

// yarn hardhat --network mainnet verifyPendle
task('verifyPendle', 'verify Pendle contracts').setAction(async (args, hre) => {
  const deployer = '0x196e6d50df6289e1F82838E84774b2B0c8f4aF62';
  const ct = deployment.contracts;
  const vars = deployment.variables;
  const weth = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
  const oneWeek = 604800;
  const startTime = 1629936000; // 19th Aug 2021
  const network = hre.network.name;
  let consts;

  if (network == 'kovan' || network == 'kovantest') {
    consts = kovanConstants;
  } else if (network == 'mainnet') {
    consts = mainnetConstants;
  }

  console.log('Verifying Contracts');
  console.log('============================\n');

  // await hre.run('verify:verify', {
  //   address:
  //     deployment.yieldContracts.SushiswapSimple['0x37922c69b08babcceae735a31235c81f1d1e8e43'].expiries[1672272000]
  //       .markets.PENDLE,
  //   contract: 'contracts/core/Generic/PendleGenericMarket.sol:PendleGenericMarket',
  //   constructorArguments: [
  //     ct.PendleGovernanceManagerMain.address,
  //     deployment.yieldContracts.SushiswapSimple['0x37922c69b08babcceae735a31235c81f1d1e8e43'].expiries[1672272000].XYT,
  //     ct.PENDLE.address,
  //   ],
  // });
  // console.log(
  //   `Verified YT-PENDLEETH-SLP/PENDLE market: ${deployment.yieldContracts.SushiswapSimple['0x37922c69b08babcceae735a31235c81f1d1e8e43'].expiries[1672272000].markets.PENDLE}\n\n`
  // );
  //
  // await hre.run('verify:verify', {
  //   address:
  //     deployment.yieldContracts.SushiswapSimple['0x37922c69b08babcceae735a31235c81f1d1e8e43'].expiries[1672272000].XYT,
  //   constructorArguments: [
  //     ct.PendleRouter.address,
  //     ct.PendleSushiswapSimpleForge.address,
  //     '0x37922c69b08babcceae735a31235c81f1d1e8e43',
  //     '0x37922c69b08babcceae735a31235c81f1d1e8e43',
  //     'YT SushiSwap LP Token 29DEC2022',
  //     'YT-SLP-29DEC2022',
  //     18,
  //     1629205198,
  //     1672272000,
  //   ],
  // });
  // console.log(
  //   `Verified Pendle YT: ${deployment.yieldContracts.SushiswapSimple['0x37922c69b08babcceae735a31235c81f1d1e8e43'].expiries[1672272000].XYT}\n\n`
  // );
  //
  // await hre.run('verify:verify', {
  //   address:
  //     deployment.yieldContracts.SushiswapSimple['0x37922c69b08babcceae735a31235c81f1d1e8e43'].expiries[1672272000].OT,
  //   constructorArguments: [
  //     ct.PendleRouter.address,
  //     ct.PendleSushiswapSimpleForge.address,
  //     '0x37922c69b08babcceae735a31235c81f1d1e8e43',
  //     '0x37922c69b08babcceae735a31235c81f1d1e8e43',
  //     'OT SushiSwap LP Token 29DEC2022',
  //     'OT-SLP-29DEC2022',
  //     18,
  //     1629205198,
  //     1672272000,
  //   ],
  // });
  // console.log(
  //   `Verified Pendle OT: ${deployment.yieldContracts.SushiswapSimple['0x37922c69b08babcceae735a31235c81f1d1e8e43'].expiries[1672272000].OT}\n\n`
  // );
  //
  // await hre.run('verify:verify', {
  //   address:
  //     deployment.yieldContracts.SushiswapComplex['0x397ff1542f962076d0bfe58ea045ffa2d347aca0'].expiries[1672272000]
  //       .markets.USDC,
  //   contract: 'contracts/core/Generic/PendleGenericMarket.sol:PendleGenericMarket',
  //   constructorArguments: [
  //     ct.PendleGovernanceManagerMain.address,
  //     deployment.yieldContracts.SushiswapComplex['0x397ff1542f962076d0bfe58ea045ffa2d347aca0'].expiries[1672272000].XYT,
  //     consts.tokens.USDC.address,
  //   ],
  // });
  // console.log(
  //   `Verified YT-ETHUSDC-SLP/USDC market: ${deployment.yieldContracts.SushiswapComplex['0x397ff1542f962076d0bfe58ea045ffa2d347aca0'].expiries[1672272000].markets.USDC}\n\n`
  // );
  //
  // await hre.run('verify:verify', {
  //   address: ct.PendleRewardManagerSushiswapSimple.address,
  //   contract: 'contracts/core/PendleRewardManager.sol:PendleRewardManager',
  //   constructorArguments: [ct.PendleGovernanceManagerMain.address, consts.common.FORGE_SUSHISWAP_SIMPLE],
  // });
  // console.log(`Verified Pendle Sushiswap Simple RewardManager: ${ct.PendleRewardManagerSushiswapSimple.address}\n\n`);
  //
  // await hre.run('verify:verify', {
  //   address: ct.PendleRewardManagerSushiswapComplex.address,
  //   contract: 'contracts/core/PendleRewardManager.sol:PendleRewardManager',
  //   constructorArguments: [ct.PendleGovernanceManagerMain.address, consts.common.FORGE_SUSHISWAP_COMPLEX],
  // });
  // console.log(`Verified Pendle Sushiswap Complex RewardManager: ${ct.PendleRewardManagerSushiswapComplex.address}\n\n`);
  //
  // await hre.run('verify:verify', {
  //   address: ct.PendleRewardManagerCompoundV2.address,
  //   contract: 'contracts/core/PendleRewardManager.sol:PendleRewardManager',
  //   constructorArguments: [ct.PendleGovernanceManagerMain.address, consts.common.FORGE_COMPOUNDV2],
  // });
  // console.log(`Verified Pendle CompoundV2 RewardManager: ${ct.PendleRewardManagerCompoundV2.address}\n\n`);
  //
  // await hre.run('verify:verify', {
  //   address:
  //     deployment.yieldContracts.SushiswapComplex['0x397ff1542f962076d0bfe58ea045ffa2d347aca0'].expiries[1672272000].XYT,
  //   constructorArguments: [
  //     ct.PendleRouter.address,
  //     ct.PendleSushiswapComplexForge.address,
  //     '0x397ff1542f962076d0bfe58ea045ffa2d347aca0',
  //     '0x397ff1542f962076d0bfe58ea045ffa2d347aca0',
  //     'YT SushiSwap LP Token 29DEC2022',
  //     'YT-SLP-29DEC2022',
  //     18,
  //     1629205073,
  //     1672272000,
  //   ],
  // });
  // console.log(
  //   `Verified Pendle YT: ${deployment.yieldContracts.SushiswapComplex['0x397ff1542f962076d0bfe58ea045ffa2d347aca0'].expiries[1672272000].XYT}\n\n`
  // );
  //
  // await hre.run('verify:verify', {
  //   address:
  //     deployment.yieldContracts.SushiswapComplex['0x397ff1542f962076d0bfe58ea045ffa2d347aca0'].expiries[1672272000].OT,
  //   constructorArguments: [
  //     ct.PendleRouter.address,
  //     ct.PendleSushiswapComplexForge.address,
  //     '0x397ff1542f962076d0bfe58ea045ffa2d347aca0',
  //     '0x397ff1542f962076d0bfe58ea045ffa2d347aca0',
  //     'OT SushiSwap LP Token 29DEC2022',
  //     'OT-SLP-29DEC2022',
  //     18,
  //     1629205073,
  //     1672272000,
  //   ],
  // });
  // console.log(
  //   `Verified Pendle OT: ${deployment.yieldContracts.SushiswapComplex['0x397ff1542f962076d0bfe58ea045ffa2d347aca0'].expiries[1672272000].OT}\n\n`
  // );

  // await hre.run('verify:verify', {
  //   address: ct.Directory.address,
  //   constructorArguments: [],
  // });
  // await hre.run('verify:verify', {
  //   address: ct.PendleGenericMarketFactory.address,
  //   constructorArguments: [ct.PendleRouter.address, consts.common.MARKET_FACTORY_GENERIC],
  // });
  // console.log(`Verified PendleGenericMarketFactory: ${ct.PendleGenericMarketFactory.address}\n\n`);

  // await hre.run('verify:verify', {
  //   address: ct.PendleCompoundV2Forge.address,
  //   constructorArguments: [
  //     ct.PendleGovernanceManagerMain.address,
  //     ct.PendleRouter.address,
  //     consts.misc.COMPOUND_COMPTROLLER_ADDRESS,
  //     consts.common.FORGE_COMPOUNDV2,
  //     consts.misc.COMP_ADDRESS,
  //     ct.PendleRewardManagerCompoundV2.address,
  //     ct.PendleCompoundV2YieldContractDeployer.address,
  //     consts.tokens.WETH.compound,
  //   ],
  // });
  // console.log(`Verified PendleCompoundV2Forge: ${ct.PendleCompoundV2Forge.address}\n\n`);

  // await hre.run('verify:verify', {
  //   address: ct.PendleSushiswapComplexForge.address,
  //   constructorArguments: [
  //     ct.PendleGovernanceManagerMain.address,
  //     ct.PendleRouter.address,
  //     consts.common.FORGE_SUSHISWAP_COMPLEX,
  //     consts.misc.SUSHI_ADDRESS,
  //     ct.PendleRewardManagerSushiswapComplex.address,
  //     ct.PendleSushiswapComplexYieldContractDeployer.address,
  //     consts.common.CODE_HASH_SUSHISWAP,
  //     consts.misc.SUSHISWAP_PAIR_FACTORY,
  //     consts.misc.MASTER_CHEF,
  //   ],
  // });
  // console.log(`Verified PendleSushiswapComplexForge: ${ct.PendleSushiswapComplexForge.address}\n\n`);

  // await hre.run('verify:verify', {
  //   address: ct.PendleSushiswapSimpleForge.address,
  //   contract: 'contracts/core/SushiswapSimple/PendleSushiswapSimpleForge.sol:PendleSushiswapSimpleForge',
  //   constructorArguments: [
  //     ct.PendleGovernanceManagerMain.address,
  //     ct.PendleRouter.address,
  //     consts.common.FORGE_SUSHISWAP_SIMPLE,
  //     consts.misc.SUSHI_ADDRESS,
  //     ct.PendleRewardManagerSushiswapSimple.address,
  //     ct.PendleSushiswapSimpleYieldContractDeployer.address,
  //     consts.common.CODE_HASH_SUSHISWAP,
  //     consts.misc.SUSHISWAP_PAIR_FACTORY,
  //   ],
  // });
  // console.log(`Verified PendleSushiswapSimpleForge: ${ct.PendleSushiswapSimpleForge.address}\n\n`);

  // await hre.run('verify:verify', {
  //   address: ct.PendleCompoundV2YieldContractDeployer.address,
  //   constructorArguments: [ct.PendleGovernanceManagerMain.address, consts.common.FORGE_COMPOUNDV2],
  // });
  // console.log(
  //   `Verified PendleCompoundV2YieldContractDeployer: ${ct.PendleCompoundV2YieldContractDeployer.address}\n\n`
  // );

  // await hre.run('verify:verify', {
  //   address: ct.PendleRewardManagerCompoundV2.address,
  //   contract: 'contracts/core/PendleRewardManager.sol:PendleRewardManager',
  //   constructorArguments: [ct.PendleGovernanceManagerMain.address, consts.common.FORGE_COMPOUNDV2],
  // });
  // console.log(`Verified PendleRewardManagerCompoundV2: ${ct.PendleRewardManagerCompoundV2.address}\n\n`);

  // PendleCompoundYieldContractDeployer
  // await hre.run('verify:verify', {
  //   address: ct.PendleRedeemProxy.address,
  //   constructorArguments: [ct.PendleRouter.address],
  // });
  // console.log(`Verified PendleRedeemProxy: ${ct.PendleRedeemProxy.address}\n\n`);

  // await hre.run('verify:verify', {
  //   address: ct.PendleLiquidityRewardsProxy.address,
  //   constructorArguments: [],
  // });
  // console.log(`Verified PendleLiquidityRewardsProxy: ${ct.PendleLiquidityRewardsProxy.address}\n\n`);

  // await hre.run('verify:verify', {
  //   address: ct.PendlePausingManagerLiqMiningV2.address,
  //   constructorArguments: [
  //     ct.PendleGovernanceManagerLiqMining.address,
  //     deployment.variables.GOVERNANCE_MULTISIG,
  //     deployment.variables.GOVERNANCE_MULTISIG,
  //     deployment.variables.GOVERNANCE_MULTISIG,
  //   ],
  // });
  // console.log(`Verified PendlePausingManagerLiqMiningV2: ${ct.PendlePausingManagerLiqMiningV2.address}\n\n`);

  // PendleCompoundYieldContractDeployer
  // await hre.run('verify:verify', {
  //   address: ct.PendleCompoundYieldContractDeployer.address,
  //   constructorArguments: [ct.PendleGovernanceManagerMain.address, utils.formatBytes32String('Compound')],
  // });
  // console.log(
  //   `Verified PendleCompoundYieldContractDeployer: ${deployment.contracts.PendleCompoundYieldContractDeployer.address}\n\n`
  // );

  // PendleLiquidityMiningBaseV2
  // await hre.run('verify:verify', {
  //   address: '0xa660c9aAa46b696Df01768E1D2d88CE2d5293778',
  //   constructorArguments: [
  //     ct.PendleGovernanceManagerLiqMining.address,
  //     ct.PendlePausingManagerLiqMiningV2.address,
  //     ct.PendleWhitelist.address,
  //     ct.PENDLE.address,
  //     '0x4556C4488CC16D5e9552cC1a99a529c1392E4fe9',
  //     '0x0000000000000000000000000000000000000000',
  //     startTime,
  //     oneWeek,
  //     5,
  //   ],
  // });
  console.log(`ct.PendleGovernanceManagerLiqMining.address=${ct.PendleGovernanceManagerLiqMining.address}`);
  console.log(`ct.PendlePausingManagerLiqMiningV2.address=${ct.PendlePausingManagerLiqMiningV2.address}`);
  console.log(`ct.PendleWhitelist.address=${ct.PendleWhitelist.address}`);
  console.log(`ct.PENDLE.address=${ct.PENDLE.address}`);
  console.log(`startTime=${startTime}`);
  await hre.run('verify:verify', {
    address: '0x07C87cfE096c417212eAB4152d365F0F7dC6FCe4',
    constructorArguments: [
      ct.PendleGovernanceManagerLiqMining.address,
      ct.PendlePausingManagerLiqMiningV2.address,
      ct.PendleWhitelist.address,
      ct.PENDLE.address,
      '0x8B758d7fD0fC58FCA8caA5e53AF2c7Da5F5F8De1',
      '0x0000000000000000000000000000000000000000',
      startTime,
      oneWeek,
      5,
    ],
  });

  await hre.run('verify:verify', {
    address: '0xFb0e378b3eD6D7F8b73230644D945E28fd7F7b03',
    constructorArguments: [
      ct.PendleGovernanceManagerLiqMining.address,
      ct.PendlePausingManagerLiqMiningV2.address,
      ct.PendleWhitelist.address,
      ct.PENDLE.address,
      '0x0D8a21f2Ea15269B7470c347083ee1f85e6A723B',
      '0x0000000000000000000000000000000000000000',
      startTime,
      oneWeek,
      5,
    ],
  });
  // console.log(`Verified PendleLiquidityMiningBaseV2: ${deployment.contracts.PendleLiquidityMiningBaseV2.address}\n\n`);

  // PendleAaveLiquidityMining
  // await hre.run('verify:verify', {
  //   address: ct.PendleAaveLiquidityMining.address,
  //   constructorArguments: [
  //     ct.PendleGovernanceManagerLiqMining.address,
  //     ct.PendlePausingManagerLiqMining.address,
  //     ct.PendleWhitelist.address,
  //     ct.PENDLE.address,
  //     ct.PendleRouter.address,
  //     utils.formatBytes32String('Aave'),
  //     utils.formatBytes32String('AaveV2'),
  //     '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  //     '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  //     '1623888000',
  //     '604800',
  //     '5',
  //   ],
  // });
  // console.log(`Verified PendleAaveLiquidityMining: ${deployment.contracts.PendleAaveLiquidityMining.address}\n\n`);

  // PendleGenericLiquidityMining
  // await hre.run('verify:verify', {
  //   address: '0xA78029ab5235B9A83EC45eD036042Db26c6E4300',
  //   contract: 'contracts/core/Generic/PendleGenericLiquidityMining.sol:PendleGenericLiquidityMining',
  //   constructorArguments: [
  //     ct.PendleGovernanceManagerLiqMining.address,
  //     ct.PendlePausingManagerLiqMining.address,
  //     ct.PendleWhitelist.address,
  //     ct.PENDLE.address,
  //     ct.PendleRouter.address,
  //     utils.formatBytes32String('Generic'),
  //     utils.formatBytes32String('SushiswapComplex'),
  //     '0x397FF1542f962076d0BFE58eA045FfA2d347ACa0',
  //     '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  //     '1629331200',
  //     '604800',
  //     '5',
  //   ],
  // });
  // console.log(`Verified PendleCompoundLiquidityMining: ${deployment.contracts.PendleCompoundLiquidityMining.address}\n\n`);
});
