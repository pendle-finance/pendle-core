import { BigNumber as BN, Contract, providers, Wallet } from 'ethers';
import PendleCompoundLiquidityMining from '../../../build/artifacts/contracts/core/compound/PendleCompoundLiquidityMining.sol/PendleCompoundLiquidityMining.json';
import PendleGenOneLiquidityMining from '../../../build/artifacts/contracts/core/GenOne/PendleGenOneLiquidityMining.sol/PendleGenOneLiquidityMining.json';
import PendleLiquidityMiningBaseV2 from '../../../build/artifacts/contracts/core/abstractV2/PendleLiquidityMiningBaseV2.sol/PendleLiquidityMiningBaseV2.json';
import PendleWhitelist from '../../../build/artifacts/contracts/core/PendleWhitelist.sol/PendleWhitelist.json';
import MockPendleAaveLiquidityMining from '../../../build/artifacts/contracts/mock/MockPendleAaveLiquidityMining.sol/MockPendleAaveLiquidityMining.json';
import PendleSushiswapComplexLiquidityMining from '../../../build/artifacts/contracts/core/SushiswapComplex/PendleSushiswapComplexLiquidityMining.sol/PendleSushiswapComplexLiquidityMining.json';
import PENDLE from '../../../build/artifacts/contracts/tokens/PENDLE.sol/PENDLE.json';
import { amountToWei, consts, getERC20Contract, tokens } from '../../helpers';
import { CompoundFixture } from './compoundForge.fixture';
import { CoreFixture } from './core.fixture';
import { marketFixture, MarketFixture } from './market.fixture';
const { waffle } = require('hardhat');
const { deployContract, loadFixture } = waffle;

export interface LiquidityMiningFixture {
  marketFix: MarketFixture;
  core: CoreFixture;
  cForge: CompoundFixture;
  testToken: Contract;
  pdl: Contract;
  a2Market: Contract;
  a2Market18: Contract;
  cMarket: Contract;
  a2LiquidityMining: Contract;
  a2LiquidityMining18: Contract;
  cLiquidityMining: Contract;
  cLiquidityMining8: Contract;
  scLiquidityMining: Contract;
  ssLiquidityMining: Contract;
  baseLiquidityMiningV2: Contract;
  sushiLiquidityMiningV2: Contract;
  params: LiqParams;
  whitelist: Contract;
}

export interface LiqParams {
  START_TIME: BN;
  EPOCH_DURATION: BN;
  REWARDS_PER_EPOCH: BN[];
  NUMBER_OF_EPOCHS: BN;
  VESTING_EPOCHS: BN;
  TOTAL_NUMERATOR: BN;
  ALLOCATION_SETTING: BN[];
}
export class UserStakeAction {
  time: BN;
  isStaking: boolean;
  amount: BN;
  id: number; // will not be used in calcExpectedRewards
  constructor(time: BN, amount: BN, isStaking: boolean, id: number) {
    this.time = time;
    this.amount = amount;
    this.isStaking = isStaking;
    this.id = id;
  }
}

// TOTAL_DURATION = 10 days * 20 = 200 days
const params: LiqParams = {
  START_TIME: consts.T0_C.add(1000), // starts in 1000s
  EPOCH_DURATION: BN.from(3600 * 24 * 10), //10 days
  REWARDS_PER_EPOCH: [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29,
  ].map((a) => BN.from('10000000000').mul(a)), // = [10000000000, 20000000000, ..]
  NUMBER_OF_EPOCHS: BN.from(30),
  VESTING_EPOCHS: BN.from(4),
  TOTAL_NUMERATOR: BN.from(10 ** 9),
  ALLOCATION_SETTING: [
    1, 1, 1, 2, 2, 2, 2, 1, 1, 1, 3, 4, 4, 4, 4, 4, 4, 4, 4, 1, 1, 2, 3, 1, 2, 3, 4, 10, 11, 1, 2, 3, 1, 1, 1, 1,
  ].map((a) => BN.from(10 ** 9).div(a)),
};

export async function liquidityMiningFixture(
  _: Wallet[],
  provider: providers.Web3Provider
): Promise<LiquidityMiningFixture> {
  const wallets = waffle.provider.getWallets();
  let [alice, bob, charlie, dave, eve] = wallets;

  let marketFix: MarketFixture = await loadFixture(marketFixture);
  let {
    core,
    a2Forge,
    cForge,
    testToken,
    a2Market,
    a2Market18,
    cMarket,
    cMarket8,
    scForge,
    scMarket,
    ssForge,
    ssMarket,
  } = marketFix;
  let router = core.router;
  let a2Xyt = a2Forge.a2FutureYieldToken;
  let a2Xyt18 = a2Forge.a2FutureYieldToken18;
  let cXyt = cForge.cFutureYieldToken;
  let cXyt8 = cForge.cFutureYieldToken8;
  let scXyt = scForge.scFutureYieldToken;
  let ssXyt = ssForge.ssFutureYieldToken;
  const amount = amountToWei(BN.from(100), 6);

  await router.bootstrapMarket(
    consts.MARKET_FACTORY_AAVE_V2,
    a2Xyt.address,
    testToken.address,
    amount,
    amount,
    consts.HG
  );

  await router.bootstrapMarket(
    consts.MARKET_FACTORY_AAVE_V2,
    a2Xyt18.address,
    testToken.address,
    amount.mul(consts.ONE_E_12),
    amount.mul(consts.ONE_E_12),
    consts.HG
  );

  await router.bootstrapMarket(
    consts.MARKET_FACTORY_COMPOUND,
    cXyt.address,
    testToken.address,
    amount,
    amount,
    consts.HG
  );

  await router.bootstrapMarket(
    consts.MARKET_FACTORY_COMPOUND,
    cXyt8.address,
    testToken.address,
    amount.mul(100),
    amount.mul(100),
    consts.HG
  );

  await router.bootstrapMarket(
    consts.MARKET_FACTORY_SUSHISWAP_COMPLEX,
    scXyt.address,
    testToken.address,
    amount.mul(10 ** 6),
    amount.mul(10 ** 6),
    consts.HG
  );

  await router.bootstrapMarket(
    consts.MARKET_FACTORY_SUSHISWAP_SIMPLE,
    ssXyt.address,
    testToken.address,
    amount.mul(10 ** 6),
    amount.mul(10 ** 6),
    consts.HG
  );

  let pdl = await deployContract(alice, PENDLE, [
    alice.address,
    alice.address,
    alice.address,
    alice.address,
    alice.address,
  ]);
  let whitelist = await deployContract(alice, PendleWhitelist, [core.govManager.address]);

  let a2LiquidityMining = await deployContract(alice, MockPendleAaveLiquidityMining, [
    core.govManager.address,
    core.pausingManager.address,
    whitelist.address,
    pdl.address,
    router.address,
    consts.MARKET_FACTORY_AAVE_V2,
    consts.FORGE_AAVE_V2,
    tokens.USDT.address,
    testToken.address,
    params.START_TIME,
    params.EPOCH_DURATION,
    params.VESTING_EPOCHS,
  ]);

  let a2LiquidityMining18 = await deployContract(alice, MockPendleAaveLiquidityMining, [
    core.govManager.address,
    core.pausingManager.address,
    whitelist.address,
    pdl.address,
    router.address,
    consts.MARKET_FACTORY_AAVE_V2,
    consts.FORGE_AAVE_V2,
    tokens.UNI.address,
    testToken.address,
    params.START_TIME,
    params.EPOCH_DURATION,
    params.VESTING_EPOCHS,
  ]);

  let cLiquidityMining = await deployContract(alice, PendleCompoundLiquidityMining, [
    core.govManager.address,
    core.pausingManager.address,
    whitelist.address,
    pdl.address,
    router.address,
    consts.MARKET_FACTORY_COMPOUND,
    consts.FORGE_COMPOUND,
    tokens.USDT.address,
    testToken.address,
    params.START_TIME,
    params.EPOCH_DURATION,
    params.VESTING_EPOCHS,
  ]);

  let cLiquidityMining8 = await deployContract(alice, PendleCompoundLiquidityMining, [
    core.govManager.address,
    core.pausingManager.address,
    whitelist.address,
    pdl.address,
    router.address,
    consts.MARKET_FACTORY_COMPOUND,
    consts.FORGE_COMPOUND,
    tokens.WETH.address,
    testToken.address,
    params.START_TIME,
    params.EPOCH_DURATION,
    params.VESTING_EPOCHS,
  ]);

  let scLiquidityMining = await deployContract(alice, PendleGenOneLiquidityMining, [
    core.govManager.address,
    core.pausingManager.address,
    whitelist.address,
    pdl.address,
    router.address,
    consts.MARKET_FACTORY_SUSHISWAP_COMPLEX,
    consts.FORGE_SUSHISWAP_COMPLEX,
    tokens.SUSHI_USDT_WETH_LP.address,
    testToken.address,
    params.START_TIME,
    params.EPOCH_DURATION,
    params.VESTING_EPOCHS,
  ]);

  // baseLiquidityMiningV2 will use the LP token of AaveV2 market
  let baseLiquidityMiningV2 = await deployContract(alice, PendleLiquidityMiningBaseV2, [
    core.govManager.address,
    core.pausingManager.address,
    whitelist.address,
    pdl.address,
    a2Market.address,
    consts.ZERO_ADDRESS,
    params.START_TIME,
    params.EPOCH_DURATION,
    params.VESTING_EPOCHS,
  ]);

  let ssLiquidityMining = await deployContract(alice, PendleGenOneLiquidityMining, [
    core.govManager.address,
    core.pausingManager.address,
    whitelist.address,
    pdl.address,
    router.address,
    consts.MARKET_FACTORY_SUSHISWAP_SIMPLE,
    consts.FORGE_SUSHISWAP_SIMPLE,
    tokens.SUSHI_USDT_WETH_LP.address,
    testToken.address,
    params.START_TIME,
    params.EPOCH_DURATION,
    params.VESTING_EPOCHS,
  ]);

  let sushiLiquidityMiningV2 = await deployContract(alice, PendleSushiswapComplexLiquidityMining, [
    core.govManager.address,
    core.pausingManager.address,
    whitelist.address,
    pdl.address,
    tokens.SUSHI_USDT_WETH_LP.address,
    consts.SUSHI_ADDRESS,
    params.START_TIME,
    params.EPOCH_DURATION,
    params.VESTING_EPOCHS,
    consts.MASTERCHEF_V1_ADDRESS,
    consts.SUSHI_USDT_WETH_PID
  ]);

  await pdl.approve(a2LiquidityMining.address, consts.INF);
  await pdl.approve(a2LiquidityMining18.address, consts.INF);
  await pdl.approve(cLiquidityMining.address, consts.INF);
  await pdl.approve(cLiquidityMining8.address, consts.INF);
  await pdl.approve(scLiquidityMining.address, consts.INF);
  await pdl.approve(ssLiquidityMining.address, consts.INF);
  await pdl.approve(baseLiquidityMiningV2.address, consts.INF);
  await pdl.approve(sushiLiquidityMiningV2.address, consts.INF);

  for (var person of [alice, bob, charlie, dave]) {
    await a2Market.connect(person).approve(a2LiquidityMining.address, consts.INF);
    await a2Market18.connect(person).approve(a2LiquidityMining18.address, consts.INF);
    await cMarket.connect(person).approve(cLiquidityMining.address, consts.INF);
    await cMarket8.connect(person).approve(cLiquidityMining8.address, consts.INF);
    await scMarket.connect(person).approve(scLiquidityMining.address, consts.INF);
    await ssMarket.connect(person).approve(ssLiquidityMining.address, consts.INF);
    await a2Market.connect(person).approve(baseLiquidityMiningV2.address, consts.INF);

    /* @DEV: I dont know why this doesn't work
    const scContract = await getERC20Contract(person, tokens.SUSHI_USDT_WETH_LP);
    await scContract.connect(person).approve(sushiLiquidityMiningV2.address, consts.INF);
    */
  }

  await a2LiquidityMining.setAllocationSetting(
    [consts.T0_A2.add(consts.SIX_MONTH)],
    [params.TOTAL_NUMERATOR],
    consts.HG
  );
  await a2LiquidityMining18.setAllocationSetting(
    [consts.T0_A2.add(consts.SIX_MONTH)],
    [params.TOTAL_NUMERATOR],
    consts.HG
  );
  await cLiquidityMining.setAllocationSetting([consts.T0_C.add(consts.SIX_MONTH)], [params.TOTAL_NUMERATOR], consts.HG);
  await cLiquidityMining8.setAllocationSetting(
    [consts.T0_C.add(consts.SIX_MONTH)],
    [params.TOTAL_NUMERATOR],
    consts.HG
  );


  await scLiquidityMining.setAllocationSetting(
    [consts.T0_SC.add(consts.SIX_MONTH)],
    [params.TOTAL_NUMERATOR],
    consts.HG
  );
  await ssLiquidityMining.setAllocationSetting(
    [consts.T0_SC.add(consts.SIX_MONTH)],
    [params.TOTAL_NUMERATOR],
    consts.HG
  );

  await a2LiquidityMining.fund(params.REWARDS_PER_EPOCH, consts.HG);
  await a2LiquidityMining18.fund(params.REWARDS_PER_EPOCH, consts.HG);
  await cLiquidityMining.fund(params.REWARDS_PER_EPOCH, consts.HG);
  await cLiquidityMining8.fund(params.REWARDS_PER_EPOCH, consts.HG);
  await scLiquidityMining.fund(params.REWARDS_PER_EPOCH, consts.HG);
  await ssLiquidityMining.fund(params.REWARDS_PER_EPOCH, consts.HG);
  await baseLiquidityMiningV2.fund(params.REWARDS_PER_EPOCH);
  await sushiLiquidityMiningV2.fund(params.REWARDS_PER_EPOCH);

  await pdl.transfer(eve.address, await pdl.balanceOf(alice.address));

  let lpBalanceA2Market = await a2Market.balanceOf(alice.address);
  let lpBalanceA2Market18 = await a2Market18.balanceOf(alice.address);
  let lpBalanceCMarket = await cMarket.balanceOf(alice.address);
  let lpBalanceCMarket8 = await cMarket.balanceOf(alice.address);
  let lpBalanceScMarket = await scMarket.balanceOf(alice.address);
  let lpBalanceSsMarket = await ssMarket.balanceOf(alice.address);

  for (var person of [bob, charlie, dave]) {
    // transfer some LP to each user
    await a2Market.transfer(person.address, lpBalanceA2Market.div(10));
    // the lp of AaveV2 will also be used for baseLiquidityMiningV2
    await a2Market18.transfer(person.address, lpBalanceA2Market18.div(10));
    await cMarket.transfer(person.address, lpBalanceCMarket.div(10));
    await cMarket8.transfer(person.address, lpBalanceCMarket8.div(10));
    await scMarket.transfer(person.address, lpBalanceScMarket.div(10));
    await ssMarket.transfer(person.address, lpBalanceSsMarket.div(10), consts.HG);
  }

  return {
    marketFix,
    core,
    cForge,
    testToken,
    pdl,
    a2Market,
    a2Market18,
    cMarket,
    a2LiquidityMining,
    a2LiquidityMining18,
    cLiquidityMining,
    cLiquidityMining8,
    scLiquidityMining,
    baseLiquidityMiningV2,
    params,
    whitelist,
    ssLiquidityMining,
    sushiLiquidityMiningV2
  };
}
