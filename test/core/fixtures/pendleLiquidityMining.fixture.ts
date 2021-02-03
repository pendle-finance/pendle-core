import { BigNumber as BN, Contract, providers, Wallet } from 'ethers';
import PendleLiquidityMining from "../../../build/artifacts/contracts/core/PendleLiquidityMining.sol/PendleLiquidityMining.json";
import PDL from "../../../build/artifacts/contracts/tokens/PDL.sol/PDL.json";
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
  pendleMarket: Contract,
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
  let [alice, bob, charlie, dave] = wallets;
  let { core, forge, aave, testToken, pendleMarket } = await pendleMarketFixture(wallets, provider);
  let pendle = core.pendle;
  let pendleXyt = forge.pendleFutureYieldToken;
  let pendleAaveMarketFactory = core.pendleAaveMarketFactory;
  const amountToTokenize = amountToWei(tokens.USDT, BN.from(100));

  await pendle.bootStrapMarket(
    consts.FORGE_AAVE,
    consts.MARKET_FACTORY_AAVE,
    pendleXyt.address,
    testToken.address,
    amountToTokenize,
    amountToTokenize,
    consts.HIGH_GAS_OVERRIDE
  );

  let pdl = await deployContract(alice, PDL, [alice.address]);

  let pendleLiquidityMining = await deployContract(
    alice,
    PendleLiquidityMining,
    [
      alice.address,
      pdl.address,
      pendleAaveMarketFactory.address,
      tokens.USDT.address,
      testToken.address,
      params.START_TIME,
      params.EPOCH_DURATION,
      params.REWARDS_PER_EPOCH,
      params.NUMBER_OF_EPOCHS,
      params.VESTING_EPOCHS,
    ]
  );
  console.log("deployed liquidity mining contract");

  await pdl.approve(pendleLiquidityMining.address, consts.MAX_ALLOWANCE);
  await pendleMarket.approve(
    pendleLiquidityMining.address,
    consts.MAX_ALLOWANCE
  );
  await pendleLiquidityMining.setAllocationSetting(
    [consts.T0.add(consts.SIX_MONTH)],
    [params.TOTAL_NUMERATOR],
    consts.HIGH_GAS_OVERRIDE
  );

  for (var person of [bob, charlie, dave]) {
    await pendleMarket
      .connect(person)
      .approve(pendleLiquidityMining.address, consts.MAX_ALLOWANCE);
  }

  await pendleLiquidityMining.fund();

  for (var person of [bob, charlie, dave]) {
    await pendleMarket.transfer(person.address, params.INITIAL_LP_AMOUNT);
  }

  return { core, forge, aave, testToken, pdl, pendleMarket, pendleLiquidityMining, params };
}
