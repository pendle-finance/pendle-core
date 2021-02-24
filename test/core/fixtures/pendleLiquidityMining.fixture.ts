import { BigNumber as BN, Contract, providers, Wallet } from 'ethers';
import PendleLiquidityMining from "../../../build/artifacts/contracts/core/PendleLiquidityMining.sol/PendleLiquidityMining.json";
import PENDLE from "../../../build/artifacts/contracts/tokens/PENDLE.sol/PENDLE.json";
import { amountToWei, consts, tokens } from '../../helpers/';
import { AaveFixture } from './aave.fixture';
import { PendleAaveFixture } from './pendleAaveForge.fixture';
import { PendleCoreFixture } from './pendleCore.fixture';
import { pendleMarketFixture } from './pendleMarket.fixture';

const { waffle } = require("hardhat");
const { deployContract } = waffle;

interface PendleLiquidityMiningFixture {
  core: PendleCoreFixture,
  forge: PendleAaveFixture,
  aave: AaveFixture,
  testToken: Contract,
  pdl: Contract,
  pendleStdMarket: Contract,
  pendleLiquidityMining: Contract,
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

export async function pendleLiquidityMiningFixture(
  wallets: Wallet[],
  provider: providers.Web3Provider,
): Promise<PendleLiquidityMiningFixture> {
  let [alice, bob, charlie, dave, eve] = wallets;
  let { core, forge, aave, testToken, pendleStdMarket } = await pendleMarketFixture(wallets, provider);
  let pendleRouter = core.pendleRouter;
  let pendleData = core.pendleData;
  let pendleAaveForge = forge.pendleAaveForge;
  let pendleXyt = forge.pendleFutureYieldToken;
  let pendleMarketFactory = core.pendleMarketFactory;
  const amountToTokenize = amountToWei(tokens.USDT, BN.from(100));

  await pendleRouter.bootstrapMarket(
    consts.MARKET_FACTORY_AAVE,
    pendleXyt.address,
    testToken.address,
    amountToTokenize,
    amountToTokenize,
    consts.HIGH_GAS_OVERRIDE
  );

  let pdl = await deployContract(alice, PENDLE, [alice.address]);

  let pendleLiquidityMining = await deployContract(
    alice,
    PendleLiquidityMining,
    [
      alice.address,
      pdl.address,
      pendleData.address,
      pendleMarketFactory.address,
      pendleAaveForge.address,
      tokens.USDT.address,
      testToken.address,
      params.START_TIME,
      params.EPOCH_DURATION,
      params.REWARDS_PER_EPOCH,
      params.NUMBER_OF_EPOCHS,
      params.VESTING_EPOCHS,
    ]
  );

  await pdl.approve(pendleLiquidityMining.address, consts.MAX_ALLOWANCE);
  await pendleStdMarket.approve(
    pendleLiquidityMining.address,
    consts.MAX_ALLOWANCE
  );
  await pendleLiquidityMining.setAllocationSetting(
    [consts.T0.add(consts.SIX_MONTH)],
    [params.TOTAL_NUMERATOR],
    consts.HIGH_GAS_OVERRIDE
  );

  for (var person of [bob, charlie, dave]) {
    await pendleStdMarket
      .connect(person)
      .approve(pendleLiquidityMining.address, consts.MAX_ALLOWANCE);
  }

  await pendleLiquidityMining.fund();
  await pdl.transfer(pendleLiquidityMining.address, await pdl.balanceOf(alice.address));

  for (var person of [bob, charlie, dave, eve]) {
    await pendleStdMarket.transfer(person.address, params.INITIAL_LP_AMOUNT);
  }

  return { core, forge, aave, testToken, pdl, pendleStdMarket, pendleLiquidityMining, params };
}
