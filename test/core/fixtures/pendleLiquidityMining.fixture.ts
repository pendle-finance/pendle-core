import { BigNumber as BN, Contract, providers, Wallet } from 'ethers';
import PendleLiquidityMining from "../../../build/artifacts/contracts/core/PendleLiquidityMining.sol/PendleLiquidityMining.json";
import PENDLE from "../../../build/artifacts/contracts/tokens/PENDLE.sol/PENDLE.json";
import { amountToWei, consts, tokens } from '../../helpers/';
import { AaveFixture } from './aave.fixture';
import { PendleAaveFixture } from './pendleAaveForge.fixture';
import { PendleCompoundFixture } from './pendleCompoundForge.fixture';
import { PendleCoreFixture } from './pendleCore.fixture';
import { pendleMarketFixture } from './pendleMarket.fixture';

const { waffle } = require("hardhat");
const hre = require("hardhat");
const { deployContract } = waffle;

interface PendleLiquidityMiningFixture {
  core: PendleCoreFixture,
  aForge: PendleAaveFixture,
  cForge: PendleCompoundFixture,
  aave: AaveFixture,
  testToken: Contract,
  pdl: Contract,
  pendleAMarket: Contract,
  pendleCMarket: Contract,
  pendleALiquidityMining: Contract,
  pendleCLiquidityMining: Contract,
  pendleLiquidityMiningWeb3: any
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
  let { core, aForge, cForge, aave, testToken, pendleAMarket, pendleCMarket } = await pendleMarketFixture(wallets, provider);
  let pendleRouter = core.pendleRouter;
  let pendleData = core.pendleData;
  let pendleAaveForge = aForge.pendleAaveForge;
  let pendleCompoundForge = cForge.pendleCompoundForge;
  let pendleAXyt = aForge.pendleAFutureYieldToken;
  let pendleCXyt = cForge.pendleCFutureYieldToken;
  let pendleAMarketFactory = core.pendleAMarketFactory;
  let pendleCMarketFactory = core.pendleCMarketFactory;
  const amountToTokenize = amountToWei(tokens.USDT, BN.from(100));

  await pendleRouter.bootstrapMarket(
    consts.MARKET_FACTORY_AAVE,
    pendleAXyt.address,
    testToken.address,
    amountToTokenize,
    amountToTokenize,
    consts.HIGH_GAS_OVERRIDE
  );
  await pendleRouter.bootstrapMarket(
    consts.MARKET_FACTORY_COMPOUND,
    pendleCXyt.address,
    testToken.address,
    amountToTokenize,
    amountToTokenize,
    consts.HIGH_GAS_OVERRIDE
  );

  let pdl = await deployContract(alice, PENDLE, [alice.address]);

  let pendleALiquidityMining = await deployContract(
    alice,
    PendleLiquidityMining,
    [
      alice.address,
      pdl.address,
      pendleRouter.address,
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

  let pendleCLiquidityMining = await deployContract(
    alice,
    PendleLiquidityMining,
    [
      alice.address,
      pdl.address,
      pendleRouter.address,
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

  await pdl.approve(pendleALiquidityMining.address, consts.MAX_ALLOWANCE);
  await pdl.approve(pendleCLiquidityMining.address, consts.MAX_ALLOWANCE);

  await pendleAMarket.approve(
    pendleALiquidityMining.address,
    consts.MAX_ALLOWANCE
  );
  await pendleCMarket.approve(
    pendleCLiquidityMining.address,
    consts.MAX_ALLOWANCE
  );
  await pendleALiquidityMining.setAllocationSetting(
    [consts.T0.add(consts.SIX_MONTH)],
    [params.TOTAL_NUMERATOR],
    consts.HIGH_GAS_OVERRIDE
  );
  await pendleCLiquidityMining.setAllocationSetting(
    [consts.T0_C.add(consts.ONE_MONTH)],
    [params.TOTAL_NUMERATOR],
    consts.HIGH_GAS_OVERRIDE
  );


  for (var person of [bob, charlie, dave]) {
    await pendleAMarket
      .connect(person)
      .approve(pendleALiquidityMining.address, consts.MAX_ALLOWANCE);
    await pendleCMarket
      .connect(person)
      .approve(pendleCLiquidityMining.address, consts.MAX_ALLOWANCE);
  }

  await pendleALiquidityMining.fund();
  await pendleCLiquidityMining.fund();
  await pdl.transfer(pendleALiquidityMining.address, await pdl.balanceOf(alice.address));
  await pdl.transfer(pendleCLiquidityMining.address, await pdl.balanceOf(alice.address));
  await pendleData.setReentrancyWhitelist([pendleALiquidityMining.address], [true]);
  await pendleData.setReentrancyWhitelist([pendleCLiquidityMining.address], [true]);

  for (var person of [bob, charlie, dave]) {
    await pendleAMarket.transfer(person.address, params.INITIAL_LP_AMOUNT);
    await pendleCMarket.transfer(person.address, params.INITIAL_LP_AMOUNT);
  }

  let pendleLiquidityMiningWeb3 = new hre.web3.eth.Contract(
    PendleLiquidityMining.abi,
    pendleALiquidityMining.address
  );

  return { core, aForge, cForge, aave, testToken, pdl, pendleAMarket, pendleCMarket, pendleALiquidityMining, pendleCLiquidityMining, pendleLiquidityMiningWeb3, params };
}
