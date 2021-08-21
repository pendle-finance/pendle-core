import chai, { expect } from 'chai';
import { solidity } from 'ethereum-waffle';
import { BigNumber as BN } from 'ethers';
import {
  AMMCheckLPNearCloseTest,
  AMMNearCloseTest,
  AMMTest,
  AMMTestWhenBlockDeltaIsNonZero,
  marketAddLiquidityDualTest,
  marketBalanceNonZeroSwapTest,
  marketBalanceNonZeroTest,
  MarketFeesTest,
  ProtocolFeeTest,
} from '../core/common-test/amm-formula-test';
import { MultiExpiryMarketTest } from '../core/common-test/multi-market-common-test';
import { checkDisabled, marketFixture, MarketFixture, Mode, parseTestEnvMarketFixture, TestEnv } from '../fixtures';
import {
  addMarketLiquidityDual,
  addMarketLiquidityDualXyt,
  addMarketLiquiditySingle,
  advanceTime,
  amountToWei,
  approxBigNumber,
  approxByPercent,
  bootstrapMarket,
  consts,
  createAaveMarketWithExpiry,
  errMsg,
  evm_revert,
  evm_snapshot,
  getMarketRateExactIn,
  getMarketRateExactOut,
  removeMarketLiquidityDual,
  removeMarketLiquiditySingle,
  setTimeNextBlock,
  swapExactInXytToToken,
  swapExactOutXytToToken,
  toFixedPoint,
} from '../helpers';
const { waffle } = require('hardhat');
chai.use(solidity);

const { loadFixture, provider } = waffle;

export async function runTest(mode: Mode) {
  describe('', async () => {
    const wallets = provider.getWallets();
    const [alice, bob] = wallets;
    let snapshotId: string;
    let globalSnapshotId: string;
    let env: TestEnv = {} as TestEnv;
    const REF_AMOUNT: BN = amountToWei(BN.from(100), 6);

    async function buildTestEnv() {
      let fixture: MarketFixture = await loadFixture(marketFixture);
      await parseTestEnvMarketFixture(alice, Mode.AAVE_V2, env, fixture);
      env.TEST_DELTA = BN.from(60000);
    }

    before(async () => {
      await buildTestEnv();
      globalSnapshotId = await evm_snapshot();
      snapshotId = await evm_snapshot();
    });

    after(async () => {
      await evm_revert(globalSnapshotId);
    });

    beforeEach(async () => {
      await evm_revert(snapshotId);
      snapshotId = await evm_snapshot();
    });

    it('bootstrapMarket', async () => {
      await bootstrapMarket(env, alice, REF_AMOUNT);
      let xytBalance = await env.xyt.balanceOf(env.market.address);
      let testTokenBalance = await env.testToken.balanceOf(env.market.address);

      expect(xytBalance).to.be.equal(REF_AMOUNT);
      expect(testTokenBalance).to.be.equal(REF_AMOUNT);
    });

    it('addMarketLiquidityDual', async () => {
      await bootstrapMarket(env, alice, REF_AMOUNT);
      const totalSupply = await env.market.totalSupply();
      await addMarketLiquidityDualXyt(env, bob, REF_AMOUNT);

      let xytBalance = await env.xyt.balanceOf(env.market.address);
      let testTokenBalance = await env.testToken.balanceOf(env.market.address);
      let totalSupplyBalance = await env.market.totalSupply();

      expect(xytBalance).to.be.equal(REF_AMOUNT.mul(2));
      expect(testTokenBalance).to.be.equal(REF_AMOUNT.mul(2));
      expect(totalSupplyBalance).to.be.equal(totalSupply.mul(2));
    });

    it('swapExactOutXytToToken', async () => {
      await bootstrapMarket(env, alice, REF_AMOUNT);

      let xytBalanceBefore = await env.xyt.balanceOf(env.market.address);

      let result: any[] = await getMarketRateExactOut(
        env,
        env.xyt.address,
        env.testToken.address,
        amountToWei(BN.from(10), 6)
      );

      await swapExactOutXytToToken(env, bob, amountToWei(BN.from(10), 6));

      let xytBalance = await env.xyt.balanceOf(env.market.address);
      let testTokenBalance = await env.testToken.balanceOf(env.market.address);

      approxBigNumber(xytBalance, xytBalanceBefore.add(BN.from(result[1])), 200);
      approxBigNumber(testTokenBalance, REF_AMOUNT.sub(REF_AMOUNT.div(10)), 0);
    });

    it('swapExactInXytToToken', async () => {
      await bootstrapMarket(env, alice, REF_AMOUNT);

      await swapExactInXytToToken(env, bob, amountToWei(BN.from(10), 6));

      let xytBalance = await env.xyt.balanceOf(env.market.address);
      let testTokenBalance = await env.testToken.balanceOf(env.market.address);

      approxBigNumber(xytBalance, REF_AMOUNT.add(REF_AMOUNT.div(10)), 200);
      approxBigNumber(testTokenBalance, REF_AMOUNT.sub(REF_AMOUNT.div(10)), REF_AMOUNT.div(100));
    });

    it('removeMarketLiquidityDual', async () => {
      await bootstrapMarket(env, alice, REF_AMOUNT);
      await advanceTime(consts.ONE_MONTH);
      const totalSupply = await env.market.totalSupply();

      await removeMarketLiquidityDual(env, alice, totalSupply.div(10));

      let xytBalance = await env.xyt.balanceOf(env.market.address);
      let testTokenBalance = await env.testToken.balanceOf(env.market.address);

      expect(xytBalance).to.be.equal(REF_AMOUNT.sub(REF_AMOUNT.div(10)));
      expect(testTokenBalance).to.be.equal(REF_AMOUNT.sub(REF_AMOUNT.div(10)));
    });

    it('addMarketLiquidityDual is still possible after all liquidity has been withdrawn from the market', async () => {
      await bootstrapMarket(env, alice, REF_AMOUNT);
      let lpBalanceBefore: BN = await env.market.balanceOf(alice.address);

      await removeMarketLiquidityDual(env, alice, lpBalanceBefore);

      await addMarketLiquidityDualXyt(env, alice, REF_AMOUNT);

      let xytBalance = await env.xyt.balanceOf(env.market.address);
      let testTokenBalance = await env.testToken.balanceOf(env.market.address);

      approxBigNumber(xytBalance, REF_AMOUNT, BN.from(1000));
      approxBigNumber(testTokenBalance, REF_AMOUNT, BN.from(1000));
    });

    it('addMarketLiquidityDual is not possible after xyt has expired', async () => {
      await bootstrapMarket(env, alice, REF_AMOUNT);

      advanceTime(consts.ONE_YEAR);

      await expect(addMarketLiquidityDualXyt(env, alice, REF_AMOUNT)).to.be.revertedWith(errMsg.MARKET_LOCKED);
    });

    it('addMarketLiquiditySingle is not possible after xyt has expired', async () => {
      await bootstrapMarket(env, alice, REF_AMOUNT);

      await advanceTime(consts.ONE_YEAR);
      await expect(addMarketLiquiditySingle(env, alice, REF_AMOUNT.div(10), false)).to.be.revertedWith(
        errMsg.MARKET_LOCKED
      );
    });

    it('removeMarketLiquiditySingle is not possible after xyt has expired', async () => {
      await bootstrapMarket(env, alice, REF_AMOUNT);

      await advanceTime(consts.ONE_YEAR);

      await expect(removeMarketLiquiditySingle(env, alice, BN.from(100), false)).to.be.revertedWith(
        errMsg.MARKET_LOCKED
      );

      await expect(removeMarketLiquiditySingle(env, alice, BN.from(100), true)).to.be.revertedWith(
        errMsg.MARKET_LOCKED
      );
    });

    it('removeMarketLiquidityDual is still possible after xyt has expired', async () => {
      await bootstrapMarket(env, alice, REF_AMOUNT);
      await advanceTime(consts.ONE_YEAR);
      const totalSupply = await env.market.totalSupply();

      await removeMarketLiquidityDual(env, alice, totalSupply.div(10));

      let xytBalance = await env.xyt.balanceOf(env.market.address);
      let testTokenBalance = await env.testToken.balanceOf(env.market.address);

      expect(xytBalance).to.be.equal(REF_AMOUNT.sub(REF_AMOUNT.div(10)));
      expect(testTokenBalance).to.be.equal(REF_AMOUNT.sub(REF_AMOUNT.div(10)));
    });

    it('getReserves', async () => {
      await bootstrapMarket(env, alice, REF_AMOUNT);

      let { xytBalance, tokenBalance } = await env.market.getReserves();
      expect(xytBalance).to.be.equal(REF_AMOUNT);
      expect(tokenBalance).to.be.equal(REF_AMOUNT);
    });

    it('marketReader.getMarketReserve', async () => {
      await bootstrapMarket(env, alice, REF_AMOUNT);

      let { xytBalance, tokenBalance } = await env.marketReader.getMarketReserves(
        env.MARKET_FACTORY_ID,
        env.xyt.address,
        env.testToken.address
      );
      expect(xytBalance).to.be.equal(REF_AMOUNT);
      expect(tokenBalance).to.be.equal(REF_AMOUNT);
    });

    it('getMarketRateExactOut', async () => {
      await bootstrapMarket(env, alice, REF_AMOUNT);
      let result: any[] = await getMarketRateExactOut(
        env,
        env.xyt.address,
        env.testToken.address,
        amountToWei(BN.from(10), 6)
      );
      approxBigNumber(result[1], 11111205, 1000);
    });

    it('getMarketRateExactIn', async () => {
      await bootstrapMarket(env, alice, REF_AMOUNT);
      let result: any[] = await getMarketRateExactIn(
        env,
        env.testToken.address,
        env.xyt.address,
        amountToWei(BN.from(10), 6)
      );
      approxBigNumber(result[1], 9090839, 1000);
    });

    it('addMarketLiquiditySingle by token', async () => {
      await bootstrapMarket(env, alice, REF_AMOUNT);
      await env.testToken.approve(env.market.address, consts.INF);

      let initialLpTokenBal = await env.market.balanceOf(alice.address);
      let initialXytBal = await env.xyt.balanceOf(alice.address);
      let initialTestTokenBal = await env.testToken.balanceOf(alice.address);

      await addMarketLiquiditySingle(env, alice, REF_AMOUNT.div(10), false);

      let currentLpTokenBal = await env.market.balanceOf(alice.address);
      let currentXytBal = await env.xyt.balanceOf(alice.address);
      let currentTestTokenBal = await env.testToken.balanceOf(alice.address);

      expect(currentLpTokenBal).to.be.gt(initialLpTokenBal);
      expect(currentTestTokenBal).to.be.lt(initialTestTokenBal);
      expect(currentXytBal).to.be.equal(initialXytBal);
    });

    it('addMarketLiquiditySingle by XYT', async () => {
      await bootstrapMarket(env, alice, REF_AMOUNT);
      await env.testToken.approve(env.market.address, consts.INF);

      let initialLpTokenBal = await env.market.balanceOf(alice.address);
      let initialXytBal = await env.xyt.balanceOf(alice.address);
      let initialTestTokenBal = await env.testToken.balanceOf(alice.address);

      await addMarketLiquiditySingle(env, alice, REF_AMOUNT.div(10), true);

      let currentLpTokenBal = await env.market.balanceOf(alice.address);
      let currentXytBal = await env.xyt.balanceOf(alice.address);
      let currentTestTokenBal = await env.testToken.balanceOf(alice.address);

      expect(currentLpTokenBal).to.be.gt(initialLpTokenBal);
      expect(currentTestTokenBal).to.be.equal(initialTestTokenBal);
      expect(currentXytBal).to.be.lt(initialXytBal);
    });

    it('marketReader.getMarketTokenAddresses', async () => {
      let { token: receivedToken, xyt: receivedXyt } = await env.marketReader.getMarketTokenAddresses(
        env.market.address
      );
      expect(receivedToken).to.be.equal(env.testToken.address);
      expect(receivedXyt).to.be.equal(env.xyt.address);
    });

    it('createMarket with a duplicated pair of XYT/token is not possible', async () => {
      await expect(
        env.router.createMarket(env.MARKET_FACTORY_ID, env.xyt.address, env.testToken.address, consts.HG)
      ).to.be.revertedWith('EXISTED_MARKET');
    });

    it('createMarket using XYT as the quote pair is not possible', async () => {
      await expect(
        env.router.createMarket(env.MARKET_FACTORY_ID, env.xyt.address, env.xyt18.address, consts.HG)
      ).to.be.revertedWith('YT_QUOTE_PAIR_FORBIDDEN');
    });

    it("AMM's formulas is correct for swapExactIn", async () => {
      await AMMTest(env, true);
    });

    it("AMM's formulas is correct for swapExactIn when BLOCK_DELTA is non-zero", async () => {
      await AMMTestWhenBlockDeltaIsNonZero(env, true);
    });

    it("AMM's formulas is correct for swapExactOut when BLOCK_DELTA is non-zero", async () => {
      await AMMTestWhenBlockDeltaIsNonZero(env, false);
    });

    it("AMM's formulas is correct for swapExactOut", async () => {
      await AMMTest(env, false);
    });

    it('MarketFeesTest', async () => {
      await MarketFeesTest(env, true);
    });

    it('ProtocolFeeTest', async () => {
      await ProtocolFeeTest(env, true);
    });

    it("AMM's swap outcome is correct near the market's freeze time", async () => {
      await env.xyt.connect(bob).transfer(alice.address, await env.xyt.balanceOf(bob.address));
      await env.testToken.connect(bob).transfer(alice.address, await env.testToken.balanceOf(bob.address));
      await AMMNearCloseTest(env, false);
    });

    it("AMM's LP outcome is correct near the market's freeze time", async () => {
      await AMMCheckLPNearCloseTest(env);
    });

    it('AMM balance should always be > 0', async () => {
      await marketBalanceNonZeroTest(env);
    });

    it('AMM balance should always be > 0 after extreme swaps', async () => {
      await marketBalanceNonZeroSwapTest(env);
    });

    it('Multimarket test', async () => {
      const environments = [];
      let currentTime = BN.from(300);

      await setTimeNextBlock(env.T0.add(currentTime));
      environments.push(await createAaveMarketWithExpiry(env, env.T0.add(consts.ONE_MONTH.mul(12)), wallets));

      await setTimeNextBlock(env.T0.add(currentTime.mul(2)));
      environments.push(await createAaveMarketWithExpiry(env, env.T0.add(consts.ONE_MONTH.mul(24)), wallets));

      await setTimeNextBlock(env.T0.add(currentTime.mul(4)));
      environments.push(await createAaveMarketWithExpiry(env, env.T0.add(consts.ONE_MONTH.mul(48)), wallets));
      await MultiExpiryMarketTest(environments, wallets);
    });

    it("Market's checkNeedCurveShift should work correctly with curveShiftBlockDelta > 1", async () => {
      async function getTokenWeight(): Promise<BN> {
        const tokenReserves = await env.market.getReserves();
        return tokenReserves.tokenWeight;
      }

      await bootstrapMarket(env, alice, REF_AMOUNT, REF_AMOUNT);
      /// market weights should be the same for every (delta + 1) blocks
      const delta = 3;
      await env.data.setCurveShiftBlockDelta(delta);

      // getting weights from blocks
      let weights: BN[] = [];
      for (let i = 0; i < 20; ++i) {
        weights.push(await getTokenWeight());
        await addMarketLiquiditySingle(env, alice, BN.from(100), true);
      }

      // Compare the weights...
      for (let i = 1; i < weights.length; ++i) {
        if (!weights[i].eq(weights[i - 1])) {
          if (i + delta < weights.length) {
            approxBigNumber(weights[i], weights[i + delta], 0);
          }
        }
      }
    });

    it('Changing market feeRatio to 0% and back to 0.35% should work normally', async () => {
      async function checkLpTreausry(promise: any, shouldBeChanged: Boolean) {
        const treasuryLp: BN = await env.market.balanceOf(env.treasury.address);
        await promise;
        const newTreasuryLp: BN = await env.market.balanceOf(env.treasury.address);
        expect(treasuryLp.lt(newTreasuryLp)).to.be.equal(shouldBeChanged);
      }

      const swapFee: BN = toFixedPoint('0.0035');
      const protocolFee: BN = toFixedPoint('0.2');

      await env.data.setMarketFees(swapFee, protocolFee, consts.HG);
      await bootstrapMarket(env, alice, REF_AMOUNT, REF_AMOUNT);

      // large delta so treasury is not affected by swapping
      const delta = 20;
      await env.data.setCurveShiftBlockDelta(delta);

      // Swap exact in one time so the paramK is promisely changed
      await swapExactInXytToToken(env, alice, REF_AMOUNT);
      await env.data.setMarketFees(swapFee, 0, consts.HG);

      // Treasury should stay unchanged here and lastParamK should be updated to 0
      await checkLpTreausry(addMarketLiquidityDual(env, alice, REF_AMOUNT), false);

      await env.data.setMarketFees(swapFee, protocolFee, consts.HG);

      // as lastParamK is 0, treasury should not be updated here
      await swapExactInXytToToken(env, alice, REF_AMOUNT);
      await checkLpTreausry(addMarketLiquidityDual(env, alice, REF_AMOUNT), false);

      // Everything is back to normal here, thus treasury is updated
      await swapExactInXytToToken(env, alice, REF_AMOUNT);
      await checkLpTreausry(addMarketLiquidityDual(env, alice, REF_AMOUNT), true);
    });

    it('AddMarketLiquidityDual test', async () => {
      await marketAddLiquidityDualTest(env);
    });

    it('Market Math extreme case', async () => {
      // This test aims to test the market when close to the end only (token: USDG, xyt: WETH)
      const toUSDG: BN = amountToWei(BN.from(1), 2);
      const toWETH: BN = amountToWei(BN.from(1), 18);

      const tokenWeight: BN = BN.from(997156320982);
      const xytWeight: BN = BN.from(102355306794);
      const tokenBalance: BN = BN.from(toUSDG.mul(1000));
      const xytBalance: BN = BN.from(toWETH.mul(1000000000)); /// This is already very very extreme and likely to never happen
      const totalSupplyLp: BN = tokenBalance.mul(xytBalance);

      const token: any = {
        weight: tokenWeight,
        balance: tokenBalance,
      };

      const xyt: any = {
        weight: xytWeight,
        balance: xytBalance,
      };

      /// ========== SWAP TOKEN TO XYT ==========
      approxByPercent(await env.mockMarketMath.calcExactOut(token, xyt, 1, 0), BN.from('97415834753633712764316'));

      approxByPercent(
        await env.mockMarketMath.calcExactIn(token, xyt, BN.from('1273461827346132412312213'), 0),
        BN.from('13')
      );

      // ========== SWAP XYT TO TOKEN ==========
      approxByPercent(
        await env.mockMarketMath.calcExactOut(xyt, token, BN.from('127346331827346132412312213'), 0),
        BN.from('1223')
      );

      approxByPercent(
        await env.mockMarketMath.calcExactIn(xyt, token, BN.from('10000'), 0),
        BN.from('1791093309883636288779774305')
      );

      // ========== ADD TOKEN ==========
      approxByPercent(
        await env.mockMarketMath.calcOutAmountLp(1000, token, 0, totalSupplyLp),
        BN.from('906487793047224024828821200000')
      );

      // ========== ADD XYT ==========
      approxByPercent(
        await env.mockMarketMath.calcOutAmountLp(xytBalance.div(2), xyt, 0, totalSupplyLp),
        BN.from('3846680494591338024458126400000')
      );

      // ========== REMOVE TOKEN ==========
      approxByPercent(
        await env.mockMarketMath.calcOutAmountToken(token, totalSupplyLp, totalSupplyLp.div(10), 0),
        BN.from('10968')
      );

      // ========== REMOVE XYT ==========
      approxByPercent(
        await env.mockMarketMath.calcOutAmountToken(xyt, totalSupplyLp, totalSupplyLp.div(3), 0),
        BN.from('987164614857793524891035594')
      );
    });
  });
}

describe('AaveV2-market', function () {
  if (checkDisabled(Mode.AAVE_V2)) return;
  runTest(Mode.AAVE_V2);
});
