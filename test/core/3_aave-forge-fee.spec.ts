import { expect } from 'chai';
import { BigNumber as BN } from 'ethers';
import {
  amountToWei,
  approxBigNumber,
  consts,
  errMsg,
  evm_revert,
  evm_snapshot,
  mintAaveV2Token,
  randomBN,
  redeemDueInterests,
  setTimeNextBlock,
  Token,
  tokenizeYield,
  tokens,
} from '../helpers';
import { Mode, parseTestEnvRouterFixture, routerFixture, RouterFixture, TestEnv } from './fixtures';

import { waffle } from 'hardhat';
const { loadFixture, provider } = waffle;

describe('aave-forge-fee', async () => {
  const wallets = provider.getWallets();
  const [alice, bob, charlie, dave] = wallets;
  const forgeFee = randomBN(consts.RONE.div(10));

  let fixture: RouterFixture;
  let snapshotId: string;
  let globalSnapshotId: string;
  let USDT: Token;
  let REF_AMOUNT: BN;
  let env: TestEnv = {} as TestEnv;

  async function buildTestEnv() {
    fixture = await loadFixture(routerFixture);
    await parseTestEnvRouterFixture(alice, Mode.AAVE_V2, env, fixture);
    USDT = tokens.USDT;
    env.TEST_DELTA = BN.from(10000);
  }

  before(async () => {
    await buildTestEnv();
    globalSnapshotId = await evm_snapshot();
    await env.data.setForgeFee(forgeFee);
    snapshotId = await evm_snapshot();
  });

  after(async () => {
    await evm_revert(globalSnapshotId);
  });

  beforeEach(async () => {
    await evm_revert(snapshotId);
    snapshotId = await evm_snapshot();
    REF_AMOUNT = amountToWei(env.INITIAL_YIELD_TOKEN_AMOUNT, 6);
    await mintAaveV2Token(USDT, alice, REF_AMOUNT.mul(10).div(10 ** USDT.decimal));
  });

  // Bob has REF_AMOUNT of XYTs
  // Charlie has equivalent amount of aUSDT
  // When bob redeem due interests, Bob should get the interest gotten by Charlie - fee portion
  it('User should get back interest minus forge fees', async () => {
    await env.yToken.transfer(charlie.address, REF_AMOUNT);
    await tokenizeYield(env, alice, REF_AMOUNT, bob.address);

    await setTimeNextBlock(env.T0.add(consts.ONE_MONTH));
    await redeemDueInterests(env, bob);
    const bobInterest = await env.yToken.balanceOf(bob.address);
    const charlieInterest = (await env.yToken.balanceOf(charlie.address)).sub(REF_AMOUNT);
    approxBigNumber(charlieInterest.mul(consts.RONE.sub(forgeFee)).div(consts.RONE), bobInterest, BN.from(200));

    const totalFee = await env.forge.totalFee(USDT.address, env.EXPIRY);
    approxBigNumber(charlieInterest.sub(bobInterest), totalFee, BN.from(200));
  });

  it('Governance address should be able to withdraw forge fees', async () => {
    await tokenizeYield(env, alice, REF_AMOUNT, bob.address);

    await setTimeNextBlock(env.T0.add(consts.ONE_MONTH));
    await redeemDueInterests(env, bob);

    const totalFee = await env.forge.totalFee(USDT.address, env.EXPIRY);
    await env.forge.withdrawForgeFee(USDT.address, env.EXPIRY);
    const treasuryAddress = await env.data.treasury();
    const treasuryBalance = await env.yToken.balanceOf(treasuryAddress);
    approxBigNumber(totalFee, treasuryBalance, BN.from(100));
    const forgeFeeLeft = await env.forge.totalFee(USDT.address, env.EXPIRY);
    approxBigNumber(forgeFeeLeft, BN.from(0), BN.from(100));
  });
  it('Non-governance address should not be able to withdraw forge fees', async () => {
    await tokenizeYield(env, alice, REF_AMOUNT, bob.address);

    await setTimeNextBlock(env.T0.add(consts.ONE_MONTH));
    await redeemDueInterests(env, bob);

    await expect(env.forge.connect(bob).withdrawForgeFee(USDT.address, env.EXPIRY)).to.be.revertedWith(
      errMsg.ONLY_GOVERNANCE
    );
  });
});
