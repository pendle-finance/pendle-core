import { MiscConsts } from '@pendle/constants';
import { loadFixture } from 'ethereum-waffle';
import { BigNumber as BN } from 'ethers';
import { Mode, parseTestEnvRouterFixture, routerFixture, TestEnv, wallets } from '../../fixtures';
import {
  approveAll,
  approxBigNumber,
  emptyToken,
  evm_revert,
  evm_snapshot,
  getSushiLpValue,
  mint,
  mintAaveV2Token,
  mintCompoundToken,
  mintQiToken,
  mintSushiswapLpFixed,
  mintXJoe,
  tokenizeYield,
} from '../../helpers';

export async function runTest(mode: Mode) {
  describe('', async () => {
    const [alice, bob, charlie, dave, eve] = wallets;

    let snapshotId: string;
    let globalSnapshotId: string;
    let env: TestEnv = {} as TestEnv;

    async function buildTestEnv() {
      env = await loadFixture(routerFixture);
      await parseTestEnvRouterFixture(env, mode);
    }

    before(async () => {
      await buildTestEnv();
      globalSnapshotId = await evm_snapshot();
      await approveAll([env.yToken], [env.router]);
      for (var person of [alice, bob, charlie, dave, eve]) {
        if (mode == Mode.AAVE_V2)
          await mintAaveV2Token(env, env.underlyingAsset, person, env.INITIAL_YIELD_TOKEN_AMOUNT);
        else if (mode == Mode.COMPOUND || mode == Mode.COMPOUND_V2)
          await mintCompoundToken(env, env.underlyingAsset, person, env.INITIAL_YIELD_TOKEN_AMOUNT);
        else if (mode == Mode.SUSHISWAP_COMPLEX || mode == Mode.SUSHISWAP_SIMPLE)
          await mintSushiswapLpFixed(env, person);
        else if (mode == Mode.BENQI)
          await mintQiToken(env, env.underlyingAsset, person, env.INITIAL_YIELD_TOKEN_AMOUNT);
        else if (mode == Mode.XJOE) await mintXJoe(env, env.xJoe, person, env.INITIAL_YIELD_TOKEN_AMOUNT);
        else if (mode == Mode.WONDERLAND) await mint(env, env.ptokens.wMEMO!, person, BN.from(0));
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

    it('[Only CompoundV2 like (Wonderland, ...) forges]', async () => {
      if (mode != Mode.COMPOUND_V2 && mode != Mode.WONDERLAND) return;
      const amount = env.INITIAL_YIELD_TOKEN_AMOUNT;
      const rate = await env.forge.callStatic.getExchangeRate(env.underlyingAsset.address);
      const actualUnderlying = amount.mul(rate).div(MiscConsts.ONE_E_18);
      await emptyToken(env, env.yToken, bob);
      await tokenizeYield(env, alice, amount, bob.address);
      approxBigNumber(await env.xyt.balanceOf(bob.address), actualUnderlying, 5);
    });

    it('[Only Sushi]', async () => {
      if (mode != Mode.SUSHISWAP_COMPLEX && mode != Mode.SUSHISWAP_SIMPLE && mode != Mode.TRADER_JOE) return;
      const amount = BN.from(1000000000);
      await emptyToken(env, env.yToken, bob);
      await tokenizeYield(env, alice, amount, bob.address);
      approxBigNumber(
        await env.xyt.balanceOf(bob.address),
        (await getSushiLpValue(env, amount)).div(BN.from(10).pow(20)),
        5
      );
    });

    it('[Only xJoe]', async () => {
      if (mode != Mode.XJOE) return;
      const amount = BN.from(1000000000);
      await emptyToken(env, env.yToken, bob);
      const actualUnderlying = amount
        .mul(await env.JOEContract.balanceOf(env.xJoe.address))
        .div(await env.xJoe.totalSupply());
      await emptyToken(env, env.yToken, bob);
      await tokenizeYield(env, alice, amount, bob.address);
      approxBigNumber(await env.xyt.balanceOf(bob.address), actualUnderlying, 5);
    });
  });
}
