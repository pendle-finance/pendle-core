import { MiscConsts } from '@pendle/constants';
import { loadFixture } from 'ethereum-waffle';
import { BigNumber as BN, providers, Wallet } from 'ethers';
import { checkDisabled, Mode, TestEnv, wallets } from '.';
import {
  fundLiqMiningYT,
  getContract,
  newLiqMiningJLP,
  newLiqMiningYT,
  setLiqMiningAllocationYT,
} from '../../pendle-deployment-scripts';
import { approve, approveAll, deployContract, liqParams, teConsts } from '../helpers';
import { marketFixture } from './market.fixture';

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

const amount = BN.from(100 * 10 ** 6);

export async function liquidityMiningFixture(_: Wallet[], provider: providers.Web3Provider): Promise<TestEnv> {
  let env: TestEnv = await loadFixture(marketFixture);
  env.liqParams = liqParams;
  let [alice, bob, charlie, dave, eve] = wallets;

  env.whitelist = await deployContract('PendleWhitelist', [env.govManager.address]);

  await deployAaveV2Liq(env);
  await deployCompoundLiq(env);
  await deployCompoundV2Liq(env);
  await deploySushiswapSimpleLiq(env);
  await deploySushiswapComplexLiq(env);
  await deployKyberDMMLiq(env);
  await deploySLPLiq(env);
  await deployBenQiLiq(env);
  await deployTraderJoeLiq(env);
  await deployJLPLiq(env);
  await deployXJoeLiq(env);
  await deployWonderlandLiq(env);
  await env.pendle.transfer(eve.address, await env.pendle.balanceOf(alice.address));

  return env;
}

export async function deployAaveV2Liq(env: TestEnv) {
  if (checkDisabled(Mode.AAVE_V2)) return;
  let [alice, bob, charlie, dave, eve] = wallets;
  let a2Xyt = env.a2FutureYieldToken;
  let a2Xyt18 = env.a2FutureYieldToken18;
  await env.router.bootstrapMarket(
    env.pconsts.aave!.MARKET_FACTORY_ID,
    a2Xyt.address,
    env.testToken.address,
    amount,
    amount,
    teConsts.HG
  );
  await env.router.bootstrapMarket(
    env.pconsts.aave!.MARKET_FACTORY_ID,
    a2Xyt18.address,
    env.testToken.address,
    amount.mul(MiscConsts.ONE_E_12),
    amount.mul(MiscConsts.ONE_E_12),
    teConsts.HG
  );
  env.a2LiquidityMining = await deployContract('MockPendleAaveLiquidityMining', [
    env.govManager.address,
    env.pausingManagerLiqMining.address,
    env.whitelist.address,
    env.pendle.address,
    env.router.address,
    env.pconsts.aave!.MARKET_FACTORY_ID,
    env.pconsts.aave!.FORGE_ID,
    env.ptokens.USDT!.address,
    env.testToken.address,
    env.liqParams.START_TIME,
    env.liqParams.EPOCH_DURATION,
    env.liqParams.VESTING_EPOCHS,
  ]);
  env.a2LiquidityMining18 = await deployContract('MockPendleAaveLiquidityMining', [
    env.govManager.address,
    env.pausingManagerLiqMining.address,
    env.whitelist.address,
    env.pendle.address,
    env.router.address,
    env.pconsts.aave!.MARKET_FACTORY_ID,
    env.pconsts.aave!.FORGE_ID,
    env.ptokens.DAI!.address,
    env.testToken.address,
    env.liqParams.START_TIME,
    env.liqParams.EPOCH_DURATION,
    env.liqParams.VESTING_EPOCHS,
  ]);
  await approve(alice, [env.pendle], [env.a2LiquidityMining, env.a2LiquidityMining18]);
  await approveAll([env.a2Market], [env.a2LiquidityMining]);
  await approveAll([env.a2Market18], [env.a2LiquidityMining18]);
  await env.a2LiquidityMining.setAllocationSetting(
    [teConsts.T0_A2.add(env.pconsts.misc.SIX_MONTH)],
    [env.liqParams.TOTAL_NUMERATOR],
    teConsts.HG
  );
  await env.a2LiquidityMining18.setAllocationSetting(
    [teConsts.T0_A2.add(env.pconsts.misc.SIX_MONTH)],
    [env.liqParams.TOTAL_NUMERATOR],
    teConsts.HG
  );
  await env.a2LiquidityMining.fund(env.liqParams.REWARDS_PER_EPOCH, teConsts.HG);
  await env.a2LiquidityMining18.fund(env.liqParams.REWARDS_PER_EPOCH, teConsts.HG);
  let lpBalanceA2Market = await env.a2Market.balanceOf(alice.address);
  let lpBalanceA2Market18 = await env.a2Market18.balanceOf(alice.address);
  for (var person of [bob, charlie, dave]) {
    await env.a2Market.transfer(person.address, lpBalanceA2Market.div(10));
    await env.a2Market18.transfer(person.address, lpBalanceA2Market18.div(10));
  }
}

export async function deployCompoundLiq(env: TestEnv) {
  if (checkDisabled(Mode.COMPOUND)) return;
  let [alice, bob, charlie, dave, eve] = wallets;
  let cXyt = env.cFutureYieldToken;
  let cXyt8 = env.cFutureYieldToken8;
  await env.router.bootstrapMarket(
    env.pconsts.compound!.MARKET_FACTORY_ID,
    cXyt.address,
    env.testToken.address,
    amount,
    amount,
    teConsts.HG
  );

  await env.router.bootstrapMarket(
    env.pconsts.compound!.MARKET_FACTORY_ID,
    cXyt8.address,
    env.testToken.address,
    amount.mul(100),
    amount.mul(100),
    teConsts.HG
  );
  env.cLiquidityMining = await deployContract('PendleCompoundLiquidityMining', [
    env.govManager.address,
    env.pausingManagerLiqMining.address,
    env.whitelist.address,
    env.pendle.address,
    env.router.address,
    env.pconsts.compound!.MARKET_FACTORY_ID,
    env.pconsts.compound!.FORGE_ID_V1,
    env.ptokens.USDT!.address,
    env.testToken.address,
    env.liqParams.START_TIME,
    env.liqParams.EPOCH_DURATION,
    env.liqParams.VESTING_EPOCHS,
  ]);

  env.cLiquidityMining8 = await deployContract('PendleCompoundLiquidityMining', [
    env.govManager.address,
    env.pausingManagerLiqMining.address,
    env.whitelist.address,
    env.pendle.address,
    env.router.address,
    env.pconsts.compound!.MARKET_FACTORY_ID,
    env.pconsts.compound!.FORGE_ID_V1,
    env.ptokens.WNATIVE.address,
    env.testToken.address,
    env.liqParams.START_TIME,
    env.liqParams.EPOCH_DURATION,
    env.liqParams.VESTING_EPOCHS,
  ]);
  await approve(alice, [env.pendle], [env.cLiquidityMining, env.cLiquidityMining8]);
  await approveAll([env.cMarket], [env.cLiquidityMining]);
  await approveAll([env.cMarket8], [env.cLiquidityMining8]);

  await env.cLiquidityMining.setAllocationSetting(
    [teConsts.T0_C.add(env.pconsts.misc.SIX_MONTH)],
    [env.liqParams.TOTAL_NUMERATOR],
    teConsts.HG
  );
  await env.cLiquidityMining8.setAllocationSetting(
    [teConsts.T0_C.add(env.pconsts.misc.SIX_MONTH)],
    [env.liqParams.TOTAL_NUMERATOR],
    teConsts.HG
  );

  await env.cLiquidityMining.fund(env.liqParams.REWARDS_PER_EPOCH, teConsts.HG);
  await env.cLiquidityMining8.fund(env.liqParams.REWARDS_PER_EPOCH, teConsts.HG);

  let lpBalanceCMarket = await env.cMarket.balanceOf(alice.address);
  let lpBalanceCMarket8 = await env.cMarket8.balanceOf(alice.address);
  for (var person of [bob, charlie, dave]) {
    await env.cMarket.transfer(person.address, lpBalanceCMarket.div(10));
    await env.cMarket8.transfer(person.address, lpBalanceCMarket8.div(10));
  }
}

export async function deployCompoundV2Liq(env: TestEnv) {
  let person;
  if (checkDisabled(Mode.COMPOUND_V2)) return;
  let [alice, bob, charlie, dave, eve] = wallets;
  let c2Xyt = env.c2FutureYieldToken;
  let c2Xyt8 = env.c2FutureYieldToken8;
  await env.router.bootstrapMarket(
    env.pconsts.common.GENERIC_MARKET_FACTORY_ID,
    c2Xyt.address,
    env.testToken.address,
    amount,
    amount,
    teConsts.HG
  );

  await env.router.bootstrapMarket(
    env.pconsts.common.GENERIC_MARKET_FACTORY_ID,
    c2Xyt8.address,
    env.testToken.address,
    amount.mul(100),
    amount.mul(100),
    teConsts.HG
  );
  env.c2LiquidityMining = await deployContract('PendleCompoundLiquidityMining', [
    env.govManager.address,
    env.pausingManagerLiqMining.address,
    env.whitelist.address,
    env.pendle.address,
    env.router.address,
    env.pconsts.common.GENERIC_MARKET_FACTORY_ID,
    env.pconsts.compound!.FORGE_ID_V2,
    env.ptokens.USDT!.address,
    env.testToken.address,
    env.liqParams.START_TIME,
    env.liqParams.EPOCH_DURATION,
    env.liqParams.VESTING_EPOCHS,
  ]);

  env.c2LiquidityMining8 = await deployContract('PendleCompoundLiquidityMining', [
    env.govManager.address,
    env.pausingManagerLiqMining.address,
    env.whitelist.address,
    env.pendle.address,
    env.router.address,
    env.pconsts.common.GENERIC_MARKET_FACTORY_ID,
    env.pconsts.compound!.FORGE_ID_V2,
    env.ptokens.WNATIVE.address,
    env.testToken.address,
    env.liqParams.START_TIME,
    env.liqParams.EPOCH_DURATION,
    env.liqParams.VESTING_EPOCHS,
  ]);

  await approve(alice, [env.pendle], [env.c2LiquidityMining, env.c2LiquidityMining8]);
  await approveAll([env.c2Market], [env.c2LiquidityMining]);
  await approveAll([env.c2Market8], [env.c2LiquidityMining8]);

  for (person of [alice, bob, charlie, dave]) {
    await env.c2Market.connect(person).approve(env.c2LiquidityMining.address, MiscConsts.INF);
    await env.c2Market8.connect(person).approve(env.c2LiquidityMining8.address, MiscConsts.INF);
  }

  await env.c2LiquidityMining.setAllocationSetting(
    [teConsts.T0_C2.add(env.pconsts.misc.SIX_MONTH)],
    [env.liqParams.TOTAL_NUMERATOR],
    teConsts.HG
  );
  await env.c2LiquidityMining8.setAllocationSetting(
    [teConsts.T0_C2.add(env.pconsts.misc.SIX_MONTH)],
    [env.liqParams.TOTAL_NUMERATOR],
    teConsts.HG
  );

  await env.c2LiquidityMining8.fund(env.liqParams.REWARDS_PER_EPOCH, teConsts.HG);
  await env.c2LiquidityMining.fund(env.liqParams.REWARDS_PER_EPOCH, teConsts.HG);
  let lpBalanceCMarket = await env.c2Market.balanceOf(alice.address);
  let lpBalanceCMarket8 = await env.c2Market8.balanceOf(alice.address);
  for (person of [bob, charlie, dave]) {
    await env.c2Market.transfer(person.address, lpBalanceCMarket.div(10));
    await env.c2Market8.transfer(person.address, lpBalanceCMarket8.div(10));
  }
}

export async function deploySushiswapComplexLiq(env: TestEnv) {
  if (checkDisabled(Mode.SUSHISWAP_COMPLEX)) return;
  let [alice, bob, charlie, dave, eve] = wallets;
  let scXyt = env.scFutureYieldToken;
  await env.router.bootstrapMarket(
    env.pconsts.common.GENERIC_MARKET_FACTORY_ID,
    scXyt.address,
    env.testToken.address,
    amount.mul(10 ** 6),
    amount.mul(10 ** 6),
    teConsts.HG
  );
  env.scLiquidityMining = await deployContract('PendleGenericLiquidityMining', [
    env.govManager.address,
    env.pausingManagerLiqMining.address,
    env.whitelist.address,
    env.pendle.address,
    env.router.address,
    env.pconsts.common.GENERIC_MARKET_FACTORY_ID,
    env.pconsts.sushi!.FORGE_ID_COMPLEX,
    env.ptokens.SUSHI_USDT_WETH_LP!.address,
    env.testToken.address,
    env.liqParams.START_TIME,
    env.liqParams.EPOCH_DURATION,
    env.liqParams.VESTING_EPOCHS,
  ]);

  await approve(alice, [env.pendle], [env.scLiquidityMining]);
  await approveAll([env.scMarket], [env.scLiquidityMining]);

  await env.scLiquidityMining.setAllocationSetting(
    [teConsts.T0_SC.add(env.pconsts.misc.SIX_MONTH)],
    [env.liqParams.TOTAL_NUMERATOR],
    teConsts.HG
  );
  await env.scLiquidityMining.fund(env.liqParams.REWARDS_PER_EPOCH, teConsts.HG);
  let lpBalanceScMarket = await env.scMarket.balanceOf(alice.address);
  for (var person of [bob, charlie, dave]) {
    await env.scMarket.transfer(person.address, lpBalanceScMarket.div(10));
  }
}

export async function deploySushiswapSimpleLiq(env: TestEnv) {
  if (checkDisabled(Mode.SUSHISWAP_SIMPLE)) return;
  let [alice, bob, charlie, dave, eve] = wallets;
  let ssXyt = env.ssFutureYieldToken;
  await env.router.bootstrapMarket(
    env.pconsts.common.GENERIC_MARKET_FACTORY_ID,
    ssXyt.address,
    env.testToken.address,
    amount.mul(10 ** 6),
    amount.mul(10 ** 6),
    teConsts.HG
  );
  env.ssLiquidityMining = await deployContract('PendleGenericLiquidityMining', [
    env.govManager.address,
    env.pausingManagerLiqMining.address,
    env.whitelist.address,
    env.pendle.address,
    env.router.address,
    env.pconsts.common.GENERIC_MARKET_FACTORY_ID,
    env.pconsts.sushi!.FORGE_ID_SIMPLE,
    env.ptokens.SUSHI_USDT_WETH_LP!.address,
    env.testToken.address,
    env.liqParams.START_TIME,
    env.liqParams.EPOCH_DURATION,
    env.liqParams.VESTING_EPOCHS,
  ]);

  await approve(alice, [env.pendle], [env.ssLiquidityMining]);
  await approveAll([env.ssMarket], [env.ssLiquidityMining]);

  await env.ssLiquidityMining.setAllocationSetting(
    [teConsts.T0_SC.add(env.pconsts.misc.SIX_MONTH)],
    [env.liqParams.TOTAL_NUMERATOR],
    teConsts.HG
  );
  await env.ssLiquidityMining.fund(env.liqParams.REWARDS_PER_EPOCH, teConsts.HG);
  let lpBalanceSsMarket = await env.ssMarket.balanceOf(alice.address);
  for (var person of [bob, charlie, dave]) {
    await env.ssMarket.transfer(person.address, lpBalanceSsMarket.div(10), teConsts.HG);
  }
}

async function deployTraderJoeLiq(env: TestEnv) {
  if (checkDisabled(Mode.TRADER_JOE)) return;
  let [alice, bob, charlie, dave, eve] = wallets;
  let joeXyt = env.joeFutureYieldToken;

  await env.router.bootstrapMarket(
    env.pconsts.common.GENERIC_MARKET_FACTORY_ID,
    joeXyt.address,
    env.testToken.address,
    amount.mul(10 ** 6),
    amount.mul(10 ** 6),
    teConsts.HG
  );

  let liqAddr = await newLiqMiningYT(env.penv, env.joeMarket.address, env.liqParams.START_TIME);
  env.joeLiquididtyMining = await getContract('PendleGenericLiquidityMiningMulti', liqAddr);
  await setLiqMiningAllocationYT(
    env.penv,
    env.joeLiquididtyMining.address,
    [teConsts.T0_TJ.add(env.pconsts.misc.SIX_MONTH)],
    [env.liqParams.TOTAL_NUMERATOR]
  );

  await approve(alice, [env.pendle], [env.joeLiquididtyMining]);
  await approveAll([env.joeMarket], [env.joeLiquididtyMining]);

  await env.joeLiquididtyMining.fund(env.liqParams.REWARDS_PER_EPOCH2, teConsts.HG);
  let lpBalanceJoeMarket = await env.joeMarket.balanceOf(alice.address);
  for (var person of [bob, charlie, dave]) {
    await env.joeMarket.transfer(person.address, lpBalanceJoeMarket.div(10));
  }
}

async function deployBenQiLiq(env: TestEnv) {
  if (checkDisabled(Mode.BENQI)) return;
  let [alice, bob, charlie, dave, eve] = wallets;
  let qiXyt = env.benQiYtDAI;
  await env.router.bootstrapMarket(
    env.pconsts.common.GENERIC_MARKET_FACTORY_ID,
    qiXyt.address,
    env.testToken.address,
    amount.mul(10 ** 6),
    amount.mul(10 ** 6),
    teConsts.HG
  );

  let liqAddr = await newLiqMiningYT(env.penv, env.benQiMarket.address, env.liqParams.START_TIME);
  env.benQiLiquidityMining = await getContract('PendleGenericLiquidityMiningMulti', liqAddr);
  await setLiqMiningAllocationYT(
    env.penv,
    env.benQiLiquidityMining.address,
    [teConsts.T0_B.add(env.pconsts.misc.SIX_MONTH)],
    [env.liqParams.TOTAL_NUMERATOR]
  );

  await approve(alice, [env.pendle], [env.benQiLiquidityMining]);
  await approveAll([env.benQiMarket], [env.benQiLiquidityMining]);

  await fundLiqMiningYT(env.penv, env.benQiLiquidityMining.address, env.liqParams.REWARDS_PER_EPOCH2);
  let lpBalanceQiMarket = await env.benQiMarket.balanceOf(alice.address);
  for (let person of [bob, charlie, dave]) {
    await env.benQiMarket.transfer(person.address, lpBalanceQiMarket.div(10));
  }
}

async function deployKyberDMMLiq(env: TestEnv) {
  if (checkDisabled(Mode.KYBER_DMM)) return;
  let [alice, bob, charlie, dave, eve] = wallets;
  let kyberXyt = env.kyberFutureYieldToken;

  await env.router.bootstrapMarket(
    env.pconsts.common.GENERIC_MARKET_FACTORY_ID,
    kyberXyt.address,
    env.testToken.address,
    amount.mul(10),
    amount.mul(10),
    teConsts.HG
  );

  env.kyberLiquidityMining = await deployContract('PendleGenericLiquidityMiningMulti', [
    [
      env.govManager.address,
      env.pausingManagerLiqMining.address,
      env.whitelist.address,
      [env.pendle.address, MiscConsts.ZERO_ADDRESS],
      env.router.address,
      env.pconsts.common.GENERIC_MARKET_FACTORY_ID,
      env.pconsts.kyber!.FORGE_ID,
      env.ptokens.KYBER_USDT_WETH_LP!.address,
      env.testToken.address,
      env.liqParams.START_TIME,
      env.liqParams.EPOCH_DURATION,
      env.liqParams.VESTING_EPOCHS,
    ],
  ]);
  await approve(alice, [env.pendle], [env.kyberLiquidityMining]);
  await approveAll([env.kyberMarket], [env.kyberLiquidityMining]);

  await env.kyberLiquidityMining.setAllocationSetting(
    [teConsts.T0_K.add(env.pconsts.misc.SIX_MONTH)],
    [env.liqParams.TOTAL_NUMERATOR],
    teConsts.HG
  );

  await env.kyberLiquidityMining.fund(env.liqParams.REWARDS_PER_EPOCH2, teConsts.HG);
  let lpBalanceKyberMarket = await env.kyberMarket.balanceOf(alice.address);
  for (var person of [bob, charlie, dave]) {
    await env.kyberMarket.transfer(person.address, lpBalanceKyberMarket.div(10));
  }
}

async function deployXJoeLiq(env: TestEnv) {
  if (checkDisabled(Mode.XJOE)) return;
  let [alice, bob, charlie, dave, eve] = wallets;
  let xJoeXyt = env.xJoeFutureYieldToken;

  await env.router.bootstrapMarket(
    env.pconsts.common.GENERIC_MARKET_FACTORY_ID,
    xJoeXyt.address,
    env.testToken.address,
    amount.mul(10),
    amount.mul(10),
    teConsts.HG
  );

  let liqAddr = await newLiqMiningYT(env.penv, env.xJoeMarket.address, env.liqParams.START_TIME);
  env.xJoeLiquidityMining = await getContract('PendleGenericLiquidityMiningMulti', liqAddr);
  await setLiqMiningAllocationYT(
    env.penv,
    env.xJoeLiquidityMining.address,
    [teConsts.T0_XJ.add(env.pconsts.misc.SIX_MONTH)],
    [env.liqParams.TOTAL_NUMERATOR]
  );

  await approve(alice, [env.pendle], [env.xJoeLiquidityMining]);
  await approveAll([env.xJoeMarket], [env.xJoeLiquidityMining]);

  await fundLiqMiningYT(env.penv, env.xJoeLiquidityMining.address, env.liqParams.REWARDS_PER_EPOCH2);
  let lpBalanceXJoeMarket = await env.xJoeMarket.balanceOf(alice.address);
  for (var person of [bob, charlie, dave]) {
    await env.xJoeMarket.transfer(person.address, lpBalanceXJoeMarket.div(10));
  }
}

async function deployWonderlandLiq(env: TestEnv) {
  if (checkDisabled(Mode.WONDERLAND)) return;
  const [alice, bob, charlie, dave, eve] = wallets;
  let wonderlandXyt = env.wonderlandFutureYieldToken;

  await env.router.bootstrapMarket(
    env.pconsts.common.GENERIC_MARKET_FACTORY_ID,
    wonderlandXyt.address,
    env.testToken.address,
    amount.mul(10),
    amount.mul(10),
    teConsts.HG
  );

  const liqAddr = await newLiqMiningYT(env.penv, env.wonderlandMarket.address, env.liqParams.START_TIME);
  env.wonderlandLiquidityMining = await getContract('PendleGenericLiquidityMiningMulti', liqAddr);
  await setLiqMiningAllocationYT(
    env.penv,
    env.wonderlandLiquidityMining.address,
    [teConsts.T0_WM.add(env.pconsts.misc.SIX_MONTH)],
    [env.liqParams.TOTAL_NUMERATOR]
  );

  await approve(alice, [env.pendle], [env.wonderlandLiquidityMining]);
  await approveAll([env.wonderlandMarket], [env.wonderlandLiquidityMining]);

  await fundLiqMiningYT(env.penv, env.wonderlandLiquidityMining.address, env.liqParams.REWARDS_PER_EPOCH2);
  let lpBalanceWonderlandMarket = await env.wonderlandMarket.balanceOf(alice.address);
  for (var person of [bob, charlie, dave]) {
    await env.wonderlandMarket.transfer(person.address, lpBalanceWonderlandMarket.div(10));
  }
}

async function deploySLPLiq(env: TestEnv) {
  let [alice] = wallets;
  if (checkDisabled(Mode.SLP_LIQ)) return;
  env.sushiLiquidityMiningV2 = await deployContract('PendleSLPLiquidityMining', [
    env.govManager.address,
    env.pausingManagerLiqMiningV2.address,
    env.whitelist.address,
    env.pendle.address,
    env.ptokens.SUSHI_USDT_WETH_LP!.address,
    env.ptokens.SUSHI!.address,
    env.liqParams.START_TIME,
    env.liqParams.EPOCH_DURATION,
    env.liqParams.VESTING_EPOCHS,
    env.pconsts.sushi!.MASTERCHEF_V1,
    env.ptokens.SUSHI_USDT_WETH_LP!.address,
  ]);
  await approve(alice, [env.pendle], [env.sushiLiquidityMiningV2]);
  await env.sushiLiquidityMiningV2.fund(env.liqParams.REWARDS_PER_EPOCH);
}

async function deployJLPLiq(env: TestEnv) {
  let [alice] = wallets;
  if (checkDisabled(Mode.JLP_LIQ)) return;

  let liqAddr = await newLiqMiningJLP(
    env.penv,
    env.ptokens.JOE_WAVAX_DAI_LP!,
    [env.ptokens.JOE!.address, env.ptokens.WNATIVE.address],
    env.liqParams.START_TIME
  );

  env.joeLiquidityMiningV2 = await getContract('PendleJoeLPLiquidityMining', liqAddr);
  await approve(alice, [env.pendle], [env.joeLiquidityMiningV2]);
  await env.joeLiquidityMiningV2.fund(env.liqParams.REWARDS_PER_EPOCH2);
}
