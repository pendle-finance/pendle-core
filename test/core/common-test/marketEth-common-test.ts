import chai, { expect } from 'chai';
import { solidity } from 'ethereum-waffle';
import { BigNumber as BN, Contract } from 'ethers';
import ERC20 from '../../../build/artifacts/@openzeppelin/contracts/token/ERC20/ERC20.sol/ERC20.json';
import { marketFixture, MarketFixture, Mode, parseTestEnvMarketFixture, TestEnv } from '../../fixtures';
import {
  addMarketLiquidityDual,
  addMarketLiquiditySingle,
  advanceTime,
  amountToWei,
  approxBigNumber,
  bootstrapMarket,
  consts,
  evm_revert,
  evm_snapshot,
  getMarketRateExactIn,
  getMarketRateExactOut,
  removeMarketLiquidityDual,
  removeMarketLiquiditySingle,
  swapExactInTokenToXyt,
  swapExactInXytToToken,
  swapExactOutTokenToXyt,
  swapExactOutXytToToken,
  tokens,
} from '../../helpers';
const { waffle } = require('hardhat');
chai.use(solidity);

const { loadFixture, provider } = waffle;

export function runTest(mode: Mode) {
  describe('', async () => {
    const wallets = provider.getWallets();
    const [alice, bob] = wallets;
    let snapshotId: string;
    let globalSnapshotId: string;
    let env: TestEnv = {} as TestEnv;

    const REF_AMOUNT_XYT: BN = amountToWei(BN.from(100), 6);
    const REF_AMOUNT_TOKEN: BN = amountToWei(BN.from(100), 18);

    async function buildTestEnv() {
      let fixture: MarketFixture = await loadFixture(marketFixture);
      await parseTestEnvMarketFixture(alice, mode, env, fixture);

      env.testToken = new Contract(tokens.WETH.address, ERC20.abi, alice);
      env.ETH_TEST = true;
      env.market = env.marketEth;
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
      await bootstrapMarket(env, alice, REF_AMOUNT_XYT, REF_AMOUNT_TOKEN);
      let xytBal = await env.xyt.balanceOf(env.market.address);
      let tokenBal = await env.testToken.balanceOf(env.market.address);

      expect(xytBal).to.be.equal(REF_AMOUNT_XYT);
      expect(tokenBal).to.be.equal(REF_AMOUNT_TOKEN);
    });

    it('addMarketLiquidityDual', async () => {
      await bootstrapMarket(env, alice, REF_AMOUNT_XYT, REF_AMOUNT_TOKEN);
      const totalSupplyLP = await env.market.totalSupply();

      let preEthBalance = await provider.getBalance(bob.address);
      await addMarketLiquidityDual(env, bob, REF_AMOUNT_XYT, REF_AMOUNT_TOKEN.mul(100));

      let xytBal = await env.xyt.balanceOf(env.market.address);
      let tokenBal = await env.testToken.balanceOf(env.market.address);
      let postEthBalance = await provider.getBalance(bob.address);
      let tokenAmountReceived = tokenBal.sub(REF_AMOUNT_TOKEN);

      approxBigNumber(postEthBalance.add(tokenAmountReceived), preEthBalance, consts.ONE_E_18); // difference less than 1 ETH
      expect(xytBal).to.be.equal(REF_AMOUNT_XYT.mul(2));
      expect(tokenBal).to.be.equal(REF_AMOUNT_TOKEN.mul(2));
      expect(await env.market.totalSupply()).to.be.equal(totalSupplyLP.mul(2));
    });

    it('swapExactOutTokenToXyt', async () => {
      await bootstrapMarket(env, alice, REF_AMOUNT_XYT, REF_AMOUNT_TOKEN);

      let preEthBalance = await provider.getBalance(bob.address);
      let xytBalBefore = await env.xyt.balanceOf(env.market.address);
      let amountOut = amountToWei(BN.from(10), 6);

      let result: any[] = await getMarketRateExactOut(env, env.testToken.address, env.xyt.address, amountOut);
      await swapExactOutTokenToXyt(env, bob, amountOut, REF_AMOUNT_TOKEN.mul(100));

      let postEthBalance = await provider.getBalance(bob.address);
      let tokenBal = await env.testToken.balanceOf(env.market.address);

      approxBigNumber(await env.xyt.balanceOf(env.market.address), xytBalBefore.sub(amountOut), 0);
      approxBigNumber(tokenBal, REF_AMOUNT_TOKEN.add(result[1]), consts.ONE_E_18);
      approxBigNumber(postEthBalance.add(result[1]), preEthBalance, consts.ONE_E_18); // difference less than 1 ETH
    });

    it('swapExactOutXytToToken', async () => {
      await bootstrapMarket(env, alice, REF_AMOUNT_XYT, REF_AMOUNT_TOKEN);

      let preEthBalance = await provider.getBalance(bob.address);
      let xytBalBefore = await env.xyt.balanceOf(env.market.address);
      let amountOut = amountToWei(BN.from(10), 18);

      let result: any[] = await getMarketRateExactOut(env, env.xyt.address, env.testToken.address, amountOut);
      await swapExactOutXytToToken(env, bob, amountOut);

      let postEthBalance = await provider.getBalance(bob.address);
      let tokenBal = await env.testToken.balanceOf(env.market.address);

      approxBigNumber(await env.xyt.balanceOf(env.market.address), xytBalBefore.add(result[1]), 200);
      approxBigNumber(tokenBal, REF_AMOUNT_TOKEN.sub(amountOut), 0);
      approxBigNumber(postEthBalance.sub(amountOut), preEthBalance, consts.ONE_E_18); // difference less than 1 ETH
    });

    it('swapExactInTokenToXyt', async () => {
      await bootstrapMarket(env, alice, REF_AMOUNT_XYT, REF_AMOUNT_TOKEN);

      let preEthBalance = await provider.getBalance(bob.address);
      let xytBalBefore = await env.xyt.balanceOf(env.market.address);
      let amountIn = amountToWei(BN.from(10), 18);

      let result: any[] = await getMarketRateExactIn(env, env.testToken.address, env.xyt.address, amountIn);
      await swapExactInTokenToXyt(env, bob, amountIn);

      let postEthBalance = await provider.getBalance(bob.address);
      let tokenBal = await env.testToken.balanceOf(env.market.address);

      approxBigNumber(await env.xyt.balanceOf(env.market.address), xytBalBefore.sub(result[1]), 200);
      approxBigNumber(tokenBal, REF_AMOUNT_TOKEN.add(amountIn), 0);
      approxBigNumber(postEthBalance.add(amountIn), preEthBalance, consts.ONE_E_18); // difference less than 1 ETH
    });

    it('swapExactInXytToToken', async () => {
      await bootstrapMarket(env, alice, REF_AMOUNT_XYT, REF_AMOUNT_TOKEN);

      let preEthBalance = await provider.getBalance(bob.address);
      let xytBalBefore = await env.xyt.balanceOf(env.market.address);
      let amountIn = amountToWei(BN.from(10), 6);

      let result: any[] = await getMarketRateExactIn(env, env.xyt.address, env.testToken.address, amountIn);
      await swapExactInXytToToken(env, bob, amountIn);

      let postEthBalance = await provider.getBalance(bob.address);
      let tokenBal = await env.testToken.balanceOf(env.market.address);

      approxBigNumber(await env.xyt.balanceOf(env.market.address), xytBalBefore.add(amountIn), 0);
      approxBigNumber(tokenBal, REF_AMOUNT_TOKEN.sub(result[1]), consts.ONE_E_18);
      approxBigNumber(postEthBalance.sub(result[1]), preEthBalance, consts.ONE_E_18); // difference less than 1 ETH
    });

    it('removeMarketLiquidityDual', async () => {
      await bootstrapMarket(env, alice, REF_AMOUNT_XYT, REF_AMOUNT_TOKEN);
      await advanceTime(consts.ONE_MONTH);
      const totalSupply = await env.market.totalSupply();

      let preEthBalance = await provider.getBalance(alice.address);
      await removeMarketLiquidityDual(env, alice, totalSupply.div(10));

      let xytBal = await env.xyt.balanceOf(env.market.address);
      let tokenBal = await env.testToken.balanceOf(env.market.address);
      let postEthBalance = await provider.getBalance(alice.address);

      approxBigNumber(xytBal, REF_AMOUNT_XYT.sub(REF_AMOUNT_XYT.div(10)), 0);
      approxBigNumber(tokenBal, REF_AMOUNT_TOKEN.sub(REF_AMOUNT_TOKEN.div(10)), 0);
      approxBigNumber(postEthBalance.sub(REF_AMOUNT_TOKEN.div(10)), preEthBalance, consts.ONE_E_18); // difference less than 1 ETH
    });

    it('addMarketLiquiditySingle by token', async () => {
      await bootstrapMarket(env, alice, REF_AMOUNT_XYT, REF_AMOUNT_TOKEN);

      let preEthBalance = await provider.getBalance(bob.address);
      let amountIn = REF_AMOUNT_TOKEN;
      await addMarketLiquiditySingle(env, bob, amountIn, false);

      let xytBal = await env.xyt.balanceOf(env.market.address);
      let tokenBal = await env.testToken.balanceOf(env.market.address);
      let postEthBalance = await provider.getBalance(bob.address);

      approxBigNumber(postEthBalance.add(amountIn), preEthBalance, consts.ONE_E_18); // difference less than 1 ETH
      expect(xytBal).to.be.equal(REF_AMOUNT_XYT);
      expect(tokenBal).to.be.equal(REF_AMOUNT_TOKEN.add(amountIn));
    });

    it('removeMarketLiquiditySingle by token', async () => {
      await bootstrapMarket(env, alice, REF_AMOUNT_XYT, REF_AMOUNT_TOKEN);
      const totalSupply = await env.market.totalSupply();

      let preEthBalance = await provider.getBalance(alice.address);
      await removeMarketLiquiditySingle(env, alice, totalSupply.div(10), false);

      let xytBal = await env.xyt.balanceOf(env.market.address);
      let tokenBal = await env.testToken.balanceOf(env.market.address);
      let postEthBalance = await provider.getBalance(alice.address);

      // we simply check the user receives all the WETH the market transfers out
      let outAmount = REF_AMOUNT_TOKEN.sub(tokenBal);
      approxBigNumber(xytBal, REF_AMOUNT_XYT, 0);
      approxBigNumber(postEthBalance.sub(outAmount), preEthBalance, consts.ONE_E_18); // difference less than 1 ETH
    });
  });
}
