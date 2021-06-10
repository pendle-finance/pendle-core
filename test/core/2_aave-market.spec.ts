import chai, { expect } from 'chai';
import { solidity } from 'ethereum-waffle';
import { BigNumber as BN } from 'ethers';
import {
  addMarketLiquidityDualXyt,
  addMarketLiquiditySingle,
  advanceTime,
  amountToWei,
  approxBigNumber,
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
} from '../helpers';
import {
  AMMCheckLPNearCloseTest,
  AMMNearCloseTest,
  AMMTest,
  marketBalanceNonZeroSwapTest,
  marketBalanceNonZeroTest,
  MarketFeesTest,
  ProtocolFeeTest,
} from './common-test/amm-formula-test';
import { MultiExpiryMarketTest } from './common-test/multi-market-common-test';
import { marketFixture, MarketFixture, Mode, parseTestEnvMarketFixture, TestEnv } from './fixtures';
const { waffle } = require('hardhat');
chai.use(solidity);

const { loadFixture, provider } = waffle;

describe('AaveV2-market', async () => {
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

    await expect(removeMarketLiquiditySingle(env, alice, BN.from(100), false)).to.be.revertedWith(errMsg.MARKET_LOCKED);

    await expect(removeMarketLiquiditySingle(env, alice, BN.from(100), true)).to.be.revertedWith(errMsg.MARKET_LOCKED);
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
    let { token: receivedToken, xyt: receivedXyt } = await env.marketReader.getMarketTokenAddresses(env.market.address);
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
});
