import { BigNumber as BN, Wallet } from 'ethers';
import { checkDisabled, marketFixture, MarketFixture, Mode, parseTestEnvMarketFixture, TestEnv } from '../fixtures';
import * as scenario from '../fixtures/lpFormulaScenario.fixture';
import { TestAddLiq, TestRemoveLiq } from '../fixtures/lpFormulaScenario.fixture';
import {
  addMarketLiquidityDualXyt,
  addMarketLiquiditySingle,
  amountToWei,
  approxBigNumber,
  bootstrapMarket,
  consts,
  evm_revert,
  evm_snapshot,
  mintXytAave,
  removeMarketLiquidityDual,
  removeMarketLiquiditySingle,
  setTimeNextBlock,
  toFixedPoint,
  tokens,
} from '../helpers';
const { waffle } = require('hardhat');

const { loadFixture, provider } = waffle;

export async function runTest(mode: Mode) {
  describe('', async () => {
    const wallets = provider.getWallets();
    const [alice, bob, charlie] = wallets;
    let snapshotId: string;
    let globalSnapshotId: string;
    let env: TestEnv = {} as TestEnv;

    const MINIMUM_LIQUIDITY: BN = BN.from(1000);

    async function buildTestEnv() {
      let fixture: MarketFixture = await loadFixture(marketFixture);
      await parseTestEnvMarketFixture(alice, Mode.AAVE_V2, env, fixture);
      env.TEST_DELTA = BN.from(10000);
    }

    before(async () => {
      const fixture = await loadFixture(marketFixture);
      globalSnapshotId = await evm_snapshot();

      await buildTestEnv();
      await env.data.setMarketFees(toFixedPoint('0.0035'), 0); // 0.35%
      for (var person of [alice, bob, charlie]) {
        await mintXytAave(tokens.USDT, person, BN.from(10).pow(10), fixture.routerFix, env.T0.add(consts.SIX_MONTH));
      }
      snapshotId = await evm_snapshot();
    });

    after(async () => {
      await evm_revert(globalSnapshotId);
    });

    beforeEach(async () => {
      await evm_revert(snapshotId);
      snapshotId = await evm_snapshot();
    });

    async function checkLpBalance(user: Wallet, expected: BN) {
      approxBigNumber(await env.market.balanceOf(user.address), expected, env.TEST_DELTA);
    }

    async function runTestAddLiqSingleToken(test: TestAddLiq) {
      const T1 = env.T0.add(test.timeOffset);
      const T2 = T1.add(consts.ONE_DAY);
      await bootstrapMarket(env, alice, amountToWei(test.initXytAmount, 6), amountToWei(test.initTokenAmount, 6));
      await setTimeNextBlock(T1);

      let initialTokenBalance: BN = await env.testToken.balanceOf(bob.address);
      let initialXytBalance: BN = await env.xyt.balanceOf(bob.address);

      await addMarketLiquiditySingle(env, bob, amountToWei(test.amountTokenChange, 6), false);
      await checkLpBalance(bob, test.expectedLpBal1);

      await setTimeNextBlock(T2);

      await addMarketLiquiditySingle(env, bob, amountToWei(test.amountXytChange, 6), true);
      await checkLpBalance(bob, test.expectedLpBal1.add(test.expectedLpBal2));

      let finalTokenBalance: BN = await env.testToken.balanceOf(bob.address);
      let finalXytBalance: BN = await env.xyt.balanceOf(bob.address);

      approxBigNumber(
        amountToWei(test.amountTokenChange, 6),
        initialTokenBalance.sub(finalTokenBalance),
        env.TEST_DELTA
      );
      approxBigNumber(amountToWei(test.amountXytChange, 6), initialXytBalance.sub(finalXytBalance), env.TEST_DELTA);
    }

    async function runTestRemoveLiqSingleToken(test: TestRemoveLiq) {
      const T1 = env.T0.add(test.timeOffset);
      const T2 = T1.add(consts.ONE_DAY);
      await bootstrapMarket(env, alice, amountToWei(test.initXytAmount, 6), amountToWei(test.initTokenAmount, 6));

      let lpBalanceAlice: BN = await env.market.balanceOf(alice.address);
      let totalLpAmountRemoved: BN = BN.from(0);
      let amountToRemove: BN = lpBalanceAlice.mul(test.ratioLpForToken).div(100);
      totalLpAmountRemoved = totalLpAmountRemoved.add(amountToRemove);

      await setTimeNextBlock(T1);
      let balanceDiff: BN = await removeMarketLiquiditySingle(env, alice, amountToRemove, false);
      approxBigNumber(balanceDiff, test.expectedTokenDiff, env.TEST_DELTA);

      await setTimeNextBlock(T2);
      amountToRemove = lpBalanceAlice.mul(test.ratioLpForXyt).div(100);
      totalLpAmountRemoved = totalLpAmountRemoved.add(amountToRemove);

      balanceDiff = await removeMarketLiquiditySingle(env, alice, amountToRemove, true);
      approxBigNumber(test.expectedXytDiff, balanceDiff, env.TEST_DELTA);
      approxBigNumber(lpBalanceAlice.sub(totalLpAmountRemoved), await env.market.balanceOf(alice.address), BN.from(1)); // should remove the exact amount
    }

    it('add liquidity with single token test 1', async () => {
      await runTestAddLiqSingleToken(scenario.scenarioAdd01());
    });

    it('add liquidity with single token test 2', async () => {
      await runTestAddLiqSingleToken(scenario.scenarioAdd02());
    });

    it('add liquidity with single token test 3', async () => {
      await runTestAddLiqSingleToken(scenario.scenarioAdd03());
    });

    it('add liquidity with single token test 4', async () => {
      await runTestAddLiqSingleToken(scenario.scenarioAdd04());
    });

    it('add liquidity with single token test 5', async () => {
      await runTestAddLiqSingleToken(scenario.scenarioAdd05());
    });

    it('remove liquidity with single token test 1', async () => {
      await runTestRemoveLiqSingleToken(scenario.scenarioRemove01());
    });

    it('remove liquidity with single token test 2', async () => {
      await runTestRemoveLiqSingleToken(scenario.scenarioRemove02());
    });

    it('remove liquidity with single token test 3', async () => {
      await runTestRemoveLiqSingleToken(scenario.scenarioRemove03());
    });

    it('remove liquidity with single token test 4', async () => {
      await runTestRemoveLiqSingleToken(scenario.scenarioRemove04());
    });

    it('remove liquidity with single token test 5', async () => {
      await runTestRemoveLiqSingleToken(scenario.scenarioRemove04());
    });

    it('add liquidity dual token test 1', async () => {
      const amountOfXyt = amountToWei(BN.from(331), 6);
      const amountOfToken = amountToWei(BN.from(891), 6);
      await bootstrapMarket(env, alice, amountOfXyt, amountOfToken);

      const totalSupply: BN = await env.market.totalSupply();
      // weights: Token: 660606624370, XYT: 438905003406

      let initialXytBalance: BN = await env.xyt.balanceOf(bob.address);
      let initialTokenBalance: BN = await env.testToken.balanceOf(bob.address);

      await addMarketLiquidityDualXyt(env, bob, amountOfXyt.mul(3));

      let finalXytBalance = await env.xyt.balanceOf(bob.address);
      let finalTokenBalance = await env.testToken.balanceOf(bob.address);
      let amountXytUsed = initialXytBalance.sub(finalXytBalance);
      let amountTokenUsed = initialTokenBalance.sub(finalTokenBalance);

      await checkLpBalance(bob, totalSupply.mul(3));
      approxBigNumber(amountXytUsed, amountOfXyt.mul(3), env.TEST_DELTA);
      approxBigNumber(amountTokenUsed, amountOfToken.mul(3), env.TEST_DELTA);

      approxBigNumber(await env.xyt.balanceOf(env.market.address), amountOfXyt.mul(4), BN.from(0));
      approxBigNumber(await env.testToken.balanceOf(env.market.address), amountOfToken.mul(4), BN.from(0));
      approxBigNumber(await env.market.totalSupply(), totalSupply.mul(4), BN.from(0));
    });

    it('remove liquidity dual token test 1', async () => {
      const amountOfXyt = amountToWei(BN.from(331), 6);
      const amountOfToken = amountToWei(BN.from(891), 6);
      await bootstrapMarket(env, alice, amountOfXyt, amountOfToken);

      const lpBalanceAlice: BN = await env.market.balanceOf(alice.address);
      // weights: Token: 660606624370, XYT: 438905003406

      let initialXytBalance: BN = await env.xyt.balanceOf(alice.address);
      let initialTokenBalance: BN = await env.testToken.balanceOf(alice.address);

      await removeMarketLiquidityDual(env, alice, lpBalanceAlice);

      await checkLpBalance(alice, BN.from(0));

      let finalXytBalance = await env.xyt.balanceOf(alice.address);
      let finalTokenBalance = await env.testToken.balanceOf(alice.address);
      let amountXytReceived = finalXytBalance.sub(initialXytBalance);
      let amountTokenReceived = finalTokenBalance.sub(initialTokenBalance);

      approxBigNumber(amountXytReceived, amountOfXyt, env.TEST_DELTA);
      approxBigNumber(amountTokenReceived, amountOfToken, env.TEST_DELTA);

      approxBigNumber(await env.xyt.balanceOf(env.market.address), 0, env.TEST_DELTA);
      approxBigNumber(await env.testToken.balanceOf(env.market.address), 0, env.TEST_DELTA);
      approxBigNumber(await env.market.totalSupply(), MINIMUM_LIQUIDITY, 0);
    });
  });
}

describe('lp-formula', function () {
  if (checkDisabled(Mode.GENERAL_TEST)) return;
  runTest(Mode.GENERAL_TEST);
});
