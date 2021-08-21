import chai, { expect } from 'chai';
import { solidity } from 'ethereum-waffle';
import { BigNumber as BN } from 'ethers';
import { Mode, parseTestEnvRouterFixture, routerFixture, RouterFixture, TestEnv } from '../../fixtures';
import {
  addFakeIncomeCompoundUSDT,
  addFakeIncomeSushi,
  amountToWei,
  approxBigNumber,
  consts,
  errMsg,
  evm_revert,
  evm_snapshot,
  mintAaveV2Token,
  mintCompoundToken,
  mintSushiswapLpFixed,
  randomBN,
  redeemDueInterests,
  setTimeNextBlock,
  Token,
  tokenizeYield,
  tokens,
} from '../../helpers';
const { waffle } = require('hardhat');
chai.use(solidity);

const { loadFixture, provider } = waffle;

export function runTest(mode: Mode) {
  describe('', async () => {
    const wallets = provider.getWallets();
    const [alice, bob, charlie, dave] = wallets;
    const forgeFee = randomBN(consts.RONE.div(10));

    let fixture: RouterFixture;
    let snapshotId: string;
    let globalSnapshotId: string;
    let underlyingAsset: Token;
    let REF_AMOUNT: BN;
    let env: TestEnv = {} as TestEnv;

    async function buildTestEnv() {
      fixture = await loadFixture(routerFixture);
      await parseTestEnvRouterFixture(alice, mode, env, fixture);
      env.TEST_DELTA = BN.from(10000);
    }

    before(async () => {
      await buildTestEnv();
      globalSnapshotId = await evm_snapshot();
      await env.data.setForgeFee(forgeFee, consts.HG);
      snapshotId = await evm_snapshot();
    });

    after(async () => {
      await evm_revert(globalSnapshotId);
    });

    beforeEach(async () => {
      await evm_revert(snapshotId);
      snapshotId = await evm_snapshot();
      if (mode == Mode.AAVE_V2) {
        underlyingAsset = tokens.USDT;
        REF_AMOUNT = amountToWei(env.INITIAL_YIELD_TOKEN_AMOUNT, 6);
        await mintAaveV2Token(underlyingAsset, alice, REF_AMOUNT.mul(10).div(10 ** underlyingAsset.decimal));
      } else if (mode == Mode.SUSHISWAP_COMPLEX || mode == Mode.SUSHISWAP_SIMPLE) {
        await mintSushiswapLpFixed(alice);
        REF_AMOUNT = BN.from(10000000);
        underlyingAsset = tokens.SUSHI_USDT_WETH_LP;
      } else if (mode == Mode.COMPOUND_V2) {
        underlyingAsset = env.underlyingAsset;
        REF_AMOUNT = BN.from(10000000);
        await mintCompoundToken(underlyingAsset, alice, REF_AMOUNT.mul(10).div(10 ** underlyingAsset.decimal));
      }
    });

    // Bob has REF_AMOUNT of XYTs
    // Charlie has equivalent amount of aUSDT
    // When bob redeem due interests, Bob should get the interest gotten by Charlie - fee portion
    it('User should get back interest minus forge fees', async () => {
      await env.yToken.transfer(charlie.address, REF_AMOUNT, consts.HG);
      await tokenizeYield(env, alice, REF_AMOUNT, bob.address);
      let charlieInterest: BN = BN.from(0);
      if (mode == Mode.SUSHISWAP_COMPLEX || mode == Mode.SUSHISWAP_SIMPLE) {
        const lastExchangeRate: BN = await env.forge.callStatic.getExchangeRate(underlyingAsset.address);
        await addFakeIncomeSushi(env, alice);
        const nowExchangeRate: BN = await env.forge.callStatic.getExchangeRate(underlyingAsset.address);
        charlieInterest = REF_AMOUNT.mul(nowExchangeRate).div(lastExchangeRate).sub(REF_AMOUNT);
        await redeemDueInterests(env, bob);
      } else if (mode == Mode.COMPOUND_V2) {
        const lastExchangeRate: BN = await env.forge.callStatic.getExchangeRate(underlyingAsset.address);
        await addFakeIncomeCompoundUSDT(env, alice);
        const nowExchangeRate: BN = await env.forge.callStatic.getExchangeRate(underlyingAsset.address);
        charlieInterest = REF_AMOUNT.mul(nowExchangeRate).div(lastExchangeRate).sub(REF_AMOUNT);
        await redeemDueInterests(env, bob);
      } else {
        await setTimeNextBlock(env.T0.add(consts.ONE_MONTH));
        await redeemDueInterests(env, bob);
        charlieInterest = (await env.yToken.balanceOf(charlie.address)).sub(REF_AMOUNT);
      }

      const bobInterest = await env.yToken.balanceOf(bob.address);
      approxBigNumber(charlieInterest.mul(consts.RONE.sub(forgeFee)).div(consts.RONE), bobInterest, BN.from(200));
      const totalFee = await env.forge.totalFee(underlyingAsset.address, env.EXPIRY);
      approxBigNumber(charlieInterest.sub(bobInterest), totalFee, BN.from(200));
    });

    it('Governance address should be able to withdraw forge fees', async () => {
      await tokenizeYield(env, alice, REF_AMOUNT, bob.address);

      if (mode == Mode.SUSHISWAP_COMPLEX || mode == Mode.SUSHISWAP_SIMPLE) {
        await addFakeIncomeSushi(env, alice);
      } else if (mode == Mode.AAVE_V2) {
        await setTimeNextBlock(env.T0.add(consts.ONE_MONTH));
      } else if (mode == Mode.COMPOUND_V2) {
        await addFakeIncomeCompoundUSDT(env, alice);
      }

      await redeemDueInterests(env, bob);

      const totalFee = await env.forge.totalFee(underlyingAsset.address, env.EXPIRY);
      await env.forge.withdrawForgeFee(underlyingAsset.address, env.EXPIRY, consts.HG);
      const treasuryAddress = await env.data.treasury();
      const treasuryBalance = await env.yToken.balanceOf(treasuryAddress);
      approxBigNumber(totalFee, treasuryBalance, BN.from(100));
      const forgeFeeLeft = await env.forge.totalFee(underlyingAsset.address, env.EXPIRY);
      approxBigNumber(forgeFeeLeft, BN.from(0), BN.from(100));
    });
    it('Non-governance address should not be able to withdraw forge fees', async () => {
      await tokenizeYield(env, alice, REF_AMOUNT, bob.address);

      await setTimeNextBlock(env.T0.add(consts.ONE_MONTH));
      await redeemDueInterests(env, bob);

      await expect(env.forge.connect(bob).withdrawForgeFee(underlyingAsset.address, env.EXPIRY)).to.be.revertedWith(
        errMsg.ONLY_GOVERNANCE
      );
    });
  });
}
