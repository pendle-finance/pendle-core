import { BigNumber as BN, Contract, providers, Wallet } from 'ethers';
import PendleLiquidityMining from "../../../build/artifacts/contracts/core/PendleLiquidityMining.sol/PendleLiquidityMining.json";
import PENDLE from "../../../build/artifacts/contracts/tokens/PENDLE.sol/PENDLE.json";
import { amountToWei, consts, tokens } from '../../helpers';
import { AaveFixture } from './aave.fixture';
import { AaveForgeFixture } from './aaveForge.fixture';
import { CompoundFixture } from './compoundForge.fixture';
import { CoreFixture } from './core.fixture';
import { marketFixture } from './market.fixture';

const { waffle } = require("hardhat");
const hre = require("hardhat");
const { deployContract } = waffle;

interface LiquidityMiningFixture {
  core: CoreFixture,
  aForge: AaveForgeFixture,
  cForge: CompoundFixture,
  aave: AaveFixture,
  testToken: Contract,
  pdl: Contract,
  aMarket: Contract,
  cMarket: Contract,
  aLiquidityMining: Contract,
  cLiquidityMining: Contract,
  aLiquidityMiningWeb3: any
  params: liqParams,
}

export interface liqParams {
  START_TIME: BN,
  EPOCH_DURATION: BN,
  REWARDS_PER_EPOCH: BN,
  NUMBER_OF_EPOCHS: BN,
  VESTING_EPOCHS: BN,
  TOTAL_NUMERATOR: BN,
  INITIAL_LP_AMOUNT: BN,
}
export class UserStakeAction {
  time: BN;
  isStaking: boolean;
  amount: BN;
  id: number; // will not be used in calExpectedRewards
  constructor(time: BN, amount: BN, isStaking: boolean, id: number) {
    this.time = time;
    this.amount = amount;
    this.isStaking = isStaking;
    this.id = id;
  }
}

const params: liqParams = {
  START_TIME: consts.T0.add(1000), // starts in 1000s
  EPOCH_DURATION: BN.from(3600 * 24 * 10), //10 days
  REWARDS_PER_EPOCH: BN.from("10000000000"), // 1e10
  NUMBER_OF_EPOCHS: BN.from(20),
  VESTING_EPOCHS: BN.from(4),
  TOTAL_NUMERATOR: BN.from(10 ** 9),
  INITIAL_LP_AMOUNT: BN.from(10).pow(17),

};

export async function liquidityMiningFixture(
  wallets: Wallet[],
  provider: providers.Web3Provider,
): Promise<LiquidityMiningFixture> {
  let [alice, bob, charlie, dave, eve] = wallets;
  let { core, aForge, cForge, aave, testToken, aMarket, cMarket } = await marketFixture(wallets, provider);
  let router = core.router;
  let data = core.data;
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

  let pdl = await deployContract(alice, PENDLE, [alice.address]);

  let aLiquidityMining = await deployContract(
    alice,
    PendleLiquidityMining,
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
      params.REWARDS_PER_EPOCH,
      params.NUMBER_OF_EPOCHS,
      params.VESTING_EPOCHS,
    ]
  );

  let cLiquidityMining = await deployContract(
    alice,
    PendleLiquidityMining,
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
      params.REWARDS_PER_EPOCH,
      params.NUMBER_OF_EPOCHS,
      params.VESTING_EPOCHS,
    ]
  );

  await pdl.approve(aLiquidityMining.address, consts.MAX_ALLOWANCE);
  await pdl.approve(cLiquidityMining.address, consts.MAX_ALLOWANCE);

  await aMarket.approve(
    aLiquidityMining.address,
    consts.MAX_ALLOWANCE
  );
  await cMarket.approve(
    cLiquidityMining.address,
    consts.MAX_ALLOWANCE
  );
  await aLiquidityMining.setAllocationSetting(
    [consts.T0.add(consts.SIX_MONTH)],
    [params.TOTAL_NUMERATOR],
    consts.HIGH_GAS_OVERRIDE
  );
  await cLiquidityMining.setAllocationSetting(
    [consts.T0_C.add(consts.ONE_MONTH)],
    [params.TOTAL_NUMERATOR],
    consts.HIGH_GAS_OVERRIDE
  );


  for (var person of [bob, charlie, dave]) {
    await aMarket
      .connect(person)
      .approve(aLiquidityMining.address, consts.MAX_ALLOWANCE);
    await cMarket
      .connect(person)
      .approve(cLiquidityMining.address, consts.MAX_ALLOWANCE);
  }

  await aLiquidityMining.fund();
  await cLiquidityMining.fund();
  await pdl.transfer(aLiquidityMining.address, await pdl.balanceOf(alice.address));
  await pdl.transfer(cLiquidityMining.address, await pdl.balanceOf(alice.address));
  await data.setReentrancyWhitelist([aLiquidityMining.address], [true]);
  await data.setReentrancyWhitelist([cLiquidityMining.address], [true]);

  for (var person of [bob, charlie, dave]) {
    await aMarket.transfer(person.address, params.INITIAL_LP_AMOUNT);
    await cMarket.transfer(person.address, params.INITIAL_LP_AMOUNT);
  }

  let aLiquidityMiningWeb3 = new hre.web3.eth.Contract(
    PendleLiquidityMining.abi,
    aLiquidityMining.address
  );

  return { core, aForge, cForge, aave, testToken, pdl, aMarket, cMarket, aLiquidityMining, cLiquidityMining, aLiquidityMiningWeb3, params };
}
