import { Erc20Token, MiscConsts } from '@pendle/constants';
import chai, { expect } from 'chai';
import { loadFixture, solidity } from 'ethereum-waffle';
import { BigNumber as BN } from 'ethers';
import { Mode, parseTestEnvRouterFixture, routerFixture, TestEnv, wallets } from '../../fixtures';
import {
  approxBigNumber,
  approxByPercent,
  errMsg,
  evm_revert,
  evm_snapshot,
  mint,
  mintAaveV2Token,
  mintCompoundToken,
  mintQiToken,
  mintSushiswapLpFixed,
  mintTraderJoeLpFixed,
  mintXJoe,
  redeemDueInterests,
  setTimeNextBlock,
  teConsts,
  tokenizeYield,
} from '../../helpers';
import { amountToWei } from '../../../pendle-deployment-scripts';

chai.use(solidity);

export function runTest(mode: Mode) {
  describe('', async () => {
    const [alice, bob, charlie, dave] = wallets;
    const forgeFee = MiscConsts.RONE.div(20);

    let snapshotId: string;
    let globalSnapshotId: string;
    let underlyingAsset: Erc20Token;
    let REF_AMOUNT: BN;
    let env: TestEnv = {} as TestEnv;

    async function buildTestEnv() {
      env = await loadFixture(routerFixture);
      await parseTestEnvRouterFixture(env, mode);
      env.TEST_DELTA = BN.from(10000);
    }

    before(async () => {
      await buildTestEnv();
      globalSnapshotId = await evm_snapshot();
      await env.data.setForgeFee(forgeFee, teConsts.HG);
      snapshotId = await evm_snapshot();
    });

    after(async () => {
      await evm_revert(globalSnapshotId);
    });

    beforeEach(async () => {
      await evm_revert(snapshotId);
      snapshotId = await evm_snapshot();
      if (mode == Mode.AAVE_V2) {
        underlyingAsset = env.ptokens.USDT!;
        REF_AMOUNT = amountToWei(env.INITIAL_YIELD_TOKEN_AMOUNT, 6);
        await mintAaveV2Token(env, underlyingAsset, alice, REF_AMOUNT.mul(10).div(10 ** underlyingAsset.decimal));
      } else if (mode == Mode.SUSHISWAP_COMPLEX || mode == Mode.SUSHISWAP_SIMPLE) {
        await mintSushiswapLpFixed(env, alice);
        REF_AMOUNT = BN.from(10000000);
        underlyingAsset = { address: env.ptokens.SUSHI_USDT_WETH_LP!.address, decimal: 12 };
      } else if (mode == Mode.COMPOUND_V2) {
        underlyingAsset = env.underlyingAsset;
        REF_AMOUNT = BN.from(10000000);
        await mintCompoundToken(env, underlyingAsset, alice, REF_AMOUNT.mul(10).div(10 ** underlyingAsset.decimal));
      } else if (mode == Mode.BENQI) {
        underlyingAsset = env.underlyingAsset;
        REF_AMOUNT = BN.from(1000000000);
        await mintQiToken(env, underlyingAsset, alice, env.INITIAL_YIELD_TOKEN_AMOUNT);
      } else if (mode == Mode.TRADER_JOE) {
        await mintTraderJoeLpFixed(env, alice);
        REF_AMOUNT = BN.from(100000000);
        underlyingAsset = { address: env.ptokens.JOE_WAVAX_DAI_LP!.address, decimal: 18 };
      } else if (mode == Mode.XJOE) {
        await mintXJoe(env, env.xJoe, alice, env.INITIAL_YIELD_TOKEN_AMOUNT);
        REF_AMOUNT = BN.from(100000000);
        underlyingAsset = env.underlyingAsset;
      } else if (mode == Mode.WONDERLAND) {
        await mint(env, env.ptokens.wMEMO!, alice, BN.from(0));
        REF_AMOUNT = BN.from(100000000000000);
        underlyingAsset = env.underlyingAsset;
      }
    });

    // Bob has REF_AMOUNT of XYTs
    // Charlie has equivalent amount of aUSDT
    // When bob redeem due interests, Bob should get the interest gotten by Charlie - fee portion
    it('User should get back interest minus forge fees', async () => {
      await env.yToken.transfer(charlie.address, REF_AMOUNT, teConsts.HG);
      await tokenizeYield(env, alice, REF_AMOUNT, bob.address);
      let charlieInterest: BN = BN.from(0);

      if (
        mode == Mode.BENQI ||
        mode == Mode.SUSHISWAP_COMPLEX ||
        mode == Mode.SUSHISWAP_SIMPLE ||
        mode == Mode.COMPOUND_V2 ||
        mode == Mode.TRADER_JOE ||
        mode == Mode.XJOE ||
        mode == Mode.WONDERLAND
      ) {
        const lastExchangeRate: BN = await env.forge.callStatic.getExchangeRate(underlyingAsset.address);
        await env.addGenericForgeFakeIncome(env);
        const nowExchangeRate: BN = await env.forge.callStatic.getExchangeRate(underlyingAsset.address);
        charlieInterest = REF_AMOUNT.sub(REF_AMOUNT.mul(lastExchangeRate).div(nowExchangeRate));
        await redeemDueInterests(env, bob);
      } else {
        await setTimeNextBlock(env.T0.add(MiscConsts.ONE_MONTH));
        await redeemDueInterests(env, bob);
        charlieInterest = (await env.yToken.balanceOf(charlie.address)).sub(REF_AMOUNT);
      }
      const bobInterest = await env.yToken.balanceOf(bob.address);

      if (mode == Mode.WONDERLAND) {
        approxByPercent(charlieInterest.mul(MiscConsts.RONE.sub(forgeFee)).div(MiscConsts.RONE), bobInterest, 1000);
      } else {
        approxBigNumber(
          charlieInterest.mul(MiscConsts.RONE.sub(forgeFee)).div(MiscConsts.RONE),
          bobInterest,
          BN.from(200)
        );
      }

      const totalFee = await env.forge.totalFee(underlyingAsset.address, env.EXPIRY);
      if (mode == Mode.WONDERLAND) {
        approxByPercent(charlieInterest.sub(bobInterest), totalFee, 1000);
      } else {
        approxBigNumber(charlieInterest.sub(bobInterest), totalFee, BN.from(200));
      }
    });

    it('Governance address should be able to withdraw forge fees', async () => {
      await tokenizeYield(env, alice, REF_AMOUNT, bob.address);
      await setTimeNextBlock(env.T0.add(MiscConsts.ONE_MONTH));

      if (
        mode == Mode.BENQI ||
        mode == Mode.SUSHISWAP_COMPLEX ||
        mode == Mode.SUSHISWAP_SIMPLE ||
        mode == Mode.COMPOUND_V2 ||
        mode == Mode.TRADER_JOE ||
        mode == Mode.XJOE ||
        mode == Mode.WONDERLAND
      ) {
        await env.addGenericForgeFakeIncome(env);
      }

      await redeemDueInterests(env, bob);

      const treasuryAddress = await env.data.treasury();
      const preTreasuryBalance = await env.yToken.balanceOf(treasuryAddress);

      const totalFee = await env.forge.totalFee(underlyingAsset.address, env.EXPIRY);
      await env.forge.withdrawForgeFee(underlyingAsset.address, env.EXPIRY, teConsts.HG);

      const postTreasuryBalance = await env.yToken.balanceOf(treasuryAddress);

      approxBigNumber(totalFee, postTreasuryBalance.sub(preTreasuryBalance), 100);
      const forgeFeeLeft = await env.forge.totalFee(underlyingAsset.address, env.EXPIRY);
      approxBigNumber(forgeFeeLeft, BN.from(0), 100);
    });

    it('Non-governance address should not be able to withdraw forge fees', async () => {
      await tokenizeYield(env, alice, REF_AMOUNT, bob.address);
      await setTimeNextBlock(env.T0.add(MiscConsts.ONE_MONTH));
      await redeemDueInterests(env, bob);
      await expect(env.forge.connect(bob).withdrawForgeFee(underlyingAsset.address, env.EXPIRY)).to.be.revertedWith(
        errMsg.ONLY_GOVERNANCE
      );
    });
  });
}
