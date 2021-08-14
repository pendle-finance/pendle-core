import { BigNumber as BN } from 'ethers';
import { Mode, parseTestEnvRouterFixture, routerFixture, RouterFixture, TestEnv } from '../../fixtures';
import {
  approxBigNumber,
  consts,
  emptyToken,
  evm_revert,
  evm_snapshot,
  getSushiLpValue,
  mintAaveV2Token,
  mintCompoundToken,
  mintSushiswapLpFixed,
  tokenizeYield,
} from '../../helpers';

const { waffle } = require('hardhat');
const { loadFixture, provider } = waffle;

export async function runTest(mode: Mode) {
  describe('', async () => {
    const wallets = provider.getWallets();
    const [alice, bob, charlie, dave, eve] = wallets;

    let snapshotId: string;
    let globalSnapshotId: string;
    let env: TestEnv = {} as TestEnv;

    async function buildTestEnv() {
      let fixture: RouterFixture = await loadFixture(routerFixture);
      await parseTestEnvRouterFixture(alice, mode, env, fixture);
    }

    before(async () => {
      await buildTestEnv();
      globalSnapshotId = await evm_snapshot();
      for (var person of [bob, charlie, dave, eve]) {
        if (mode == Mode.AAVE_V2) await mintAaveV2Token(env.underlyingAsset, person, env.INITIAL_YIELD_TOKEN_AMOUNT);
        else if (mode == Mode.COMPOUND || mode == Mode.COMPOUND_V2)
          await mintCompoundToken(env.underlyingAsset, person, env.INITIAL_YIELD_TOKEN_AMOUNT);
        else if (mode == Mode.SUSHISWAP_COMPLEX || mode == Mode.SUSHISWAP_SIMPLE) await mintSushiswapLpFixed(person);
        await env.yToken.connect(person).approve(env.router.address, consts.INF);
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

    enum Action {
      TokenizeYield,
      RedeemDueInterests,
      RedeemUnderlying,
    }

    it('[Only CompoundV2]', async () => {
      if (mode != Mode.COMPOUND_V2) return;
      const amount = BN.from(1000000000);
      const rate = await env.yToken.callStatic.exchangeRateCurrent();
      const actualUnderlying = amount.mul(rate).div(consts.ONE_E_18);
      console.log(amount, rate, actualUnderlying);
      await emptyToken(env.yToken, bob);
      await tokenizeYield(env, alice, amount, bob.address);
      approxBigNumber(await env.xyt.balanceOf(bob.address), actualUnderlying, 5);
    });
    it('[Only Sushi]', async () => {
      if (mode != Mode.SUSHISWAP_COMPLEX && mode != Mode.SUSHISWAP_SIMPLE) return;
      const amount = BN.from(1000000000);
      await emptyToken(env.yToken, bob);
      await tokenizeYield(env, alice, amount, bob.address);
      approxBigNumber(
        await env.xyt.balanceOf(bob.address),
        (await getSushiLpValue(env, amount)).div(BN.from(10).pow(20)),
        5
      );
    });
  });
}
