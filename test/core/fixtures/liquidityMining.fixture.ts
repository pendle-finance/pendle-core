import { BigNumber as BN, Contract, providers, Wallet } from 'ethers';
import PendleCompoundLiquidityMining from "../../../build/artifacts/contracts/core/PendleCompoundLiquidityMining.sol/PendleCompoundLiquidityMining.json";
import MockPendleAaveLiquidityMining from "../../../build/artifacts/contracts/mock/MockPendleAaveLiquidityMining.sol/MockPendleAaveLiquidityMining.json";
import PENDLE from "../../../build/artifacts/contracts/tokens/PENDLE.sol/PENDLE.json";
import { amountToWei, consts, tokens } from '../../helpers';
import { AaveForgeFixture } from './aaveForge.fixture';
import { CompoundFixture } from './compoundForge.fixture';
import { CoreFixture } from './core.fixture';
import { marketFixture, MarketFixture } from './market.fixture';

const { waffle } = require("hardhat");
const hre = require("hardhat");
const { deployContract } = waffle;

export interface LiquidityMiningFixture {
  marketFix: MarketFixture,
  core: CoreFixture,
  aForge: AaveForgeFixture,
  cForge: CompoundFixture,
  testToken: Contract,
  pdl: Contract,
  aMarket: Contract,
  cMarket: Contract,
  aLiquidityMining: Contract,
  cLiquidityMining: Contract,
  params: LiqParams,
}

export interface LiqParams {
  START_TIME: BN,
  EPOCH_DURATION: BN,
  REWARDS_PER_EPOCH: BN[],
  NUMBER_OF_EPOCHS: BN,
  VESTING_EPOCHS: BN,
  TOTAL_NUMERATOR: BN,
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
  REWARDS_PER_EPOCH: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29].map((a) => BN.from("10000000000").mul(a)), // = [10000000000, 20000000000, ..]
  NUMBER_OF_EPOCHS: BN.from(30),
  VESTING_EPOCHS: BN.from(4),
  TOTAL_NUMERATOR: BN.from(10 ** 9),
};

export async function liquidityMiningFixture(
  wallets: Wallet[],
  provider: providers.Web3Provider,
): Promise<LiquidityMiningFixture> {
  let [alice, bob, charlie, dave, eve] = wallets;
  let marketFix: MarketFixture = await marketFixture(wallets, provider);
  let { core, aForge, cForge, testToken, aMarket, cMarket } = marketFix;
  let router = core.router;
  let aXyt = aForge.aFutureYieldToken;
  let cXyt = cForge.cFutureYieldToken;
  const amount = amountToWei(BN.from(100), 6);

  await router.bootstrapMarket(
    consts.MARKET_FACTORY_AAVE,
    aXyt.address,
    testToken.address,
    amount,
    amount,
    consts.HIGH_GAS_OVERRIDE
  );

  await router.bootstrapMarket(
    consts.MARKET_FACTORY_COMPOUND,
    cXyt.address,
    testToken.address,
    amount,
    amount,
    consts.HIGH_GAS_OVERRIDE
  );

  let pdl = await deployContract(alice, PENDLE, [alice.address, alice.address, alice.address, alice.address, alice.address]);

  let aLiquidityMining = await deployContract(
    alice,
    MockPendleAaveLiquidityMining,
    [
      alice.address,
      pdl.address,
      router.address,
      consts.MARKET_FACTORY_AAVE,
      consts.FORGE_AAVE,
      tokens.USDT.address,
      testToken.address,
      params.START_TIME,
      params.EPOCH_DURATION,
      params.VESTING_EPOCHS,
    ]
  );

  let cLiquidityMining = await deployContract(
    alice,
    PendleCompoundLiquidityMining,
    [
      alice.address,
      pdl.address,
      router.address,
      consts.MARKET_FACTORY_COMPOUND,
      consts.FORGE_COMPOUND,
      tokens.USDT.address,
      testToken.address,
      params.START_TIME,
      params.EPOCH_DURATION,
      params.VESTING_EPOCHS,
    ]
  );

  await pdl.approve(aLiquidityMining.address, consts.INF);
  await pdl.approve(cLiquidityMining.address, consts.INF);

  await aMarket.approve(
    aLiquidityMining.address,
    consts.INF
  );
  await cMarket.approve(
    cLiquidityMining.address,
    consts.INF
  );

  await aLiquidityMining.setAllocationSetting(
    [consts.T0.add(consts.SIX_MONTH)],
    [params.TOTAL_NUMERATOR],
    consts.HIGH_GAS_OVERRIDE
  );

  await cLiquidityMining.setAllocationSetting(
    [consts.T0_C.add(consts.SIX_MONTH)],
    [params.TOTAL_NUMERATOR],
    consts.HIGH_GAS_OVERRIDE
  );

  for (var person of [bob, charlie, dave]) {
    await aMarket
      .connect(person)
      .approve(aLiquidityMining.address, consts.INF);
    await cMarket
      .connect(person)
      .approve(cLiquidityMining.address, consts.INF);
  }

  await aLiquidityMining.fund(params.REWARDS_PER_EPOCH);
  await cLiquidityMining.fund(params.REWARDS_PER_EPOCH);
  await pdl.transfer(aLiquidityMining.address, await pdl.balanceOf(alice.address));
  await pdl.transfer(cLiquidityMining.address, await pdl.balanceOf(alice.address));


  let lpBalanceAlice = await aMarket.balanceOf(alice.address);

  for (var person of [bob, charlie, dave]) { // transfer some LP to each user
    await aMarket.transfer(person.address, lpBalanceAlice.div(10));
    await cMarket.transfer(person.address, lpBalanceAlice.div(10));
  }

  return { marketFix, core, aForge, cForge, testToken, pdl, aMarket, cMarket, aLiquidityMining, cLiquidityMining, params };
}