import { expect } from 'chai';
import { BigNumber as BN, Contract } from 'ethers';
import ERC20 from '../../build/artifacts/@openzeppelin/contracts/token/ERC20/ERC20.sol/ERC20.json';
import { consts, errMsg, evm_revert, evm_snapshot, Token, tokens } from '../helpers';
import { marketFixture, MarketFixture, Mode, parseTestEnvMarketFixture, TestEnv } from './fixtures';

import { waffle } from 'hardhat';
const { loadFixture, provider } = waffle;

describe('permission-test', async () => {
  const wallets = provider.getWallets();
  const [alice, bob] = wallets;
  let snapshotId: string;
  let globalSnapshotId: string;
  const amount: BN = BN.from(10).pow(6);
  let env: TestEnv = {} as TestEnv;
  let USDT: Token;

  async function buildTestEnv() {
    let fixture: MarketFixture = await loadFixture(marketFixture);
    parseTestEnvMarketFixture(alice, Mode.AAVE_V1, env, fixture);
    USDT = tokens.USDT;
    env.TEST_DELTA = BN.from(60000);
  }

  before(async () => {
    globalSnapshotId = await evm_snapshot();
    await buildTestEnv();
    snapshotId = await evm_snapshot();
  });

  after(async () => {
    await evm_revert(globalSnapshotId);
  });

  beforeEach(async () => {
    await evm_revert(snapshotId);
    snapshotId = await evm_snapshot();
  });

  it('PendleMarketBase', async () => {
    await env.router.bootstrapMarket(
      consts.MARKET_FACTORY_AAVE,
      env.xyt.address,
      env.testToken.address,
      amount,
      amount,
      consts.HIGH_GAS_OVERRIDE
    );

    await expect(env.market.bootstrap(alice.address, amount, amount)).to.be.revertedWith(errMsg.ONLY_ROUTER);

    await expect(env.market.addMarketLiquidityDual(alice.address, amount, amount, amount, amount)).to.be.revertedWith(
      errMsg.ONLY_ROUTER
    );

    await expect(
      env.market.addMarketLiquiditySingle(alice.address, consts.ZERO_ADDRESS, amount, amount)
    ).to.be.revertedWith(errMsg.ONLY_ROUTER);

    await expect(env.market.removeMarketLiquidityDual(alice.address, amount, amount, amount)).to.be.revertedWith(
      errMsg.ONLY_ROUTER
    );

    await expect(
      env.market.removeMarketLiquiditySingle(alice.address, consts.RANDOM_ADDRESS, amount, amount)
    ).to.be.revertedWith(errMsg.ONLY_ROUTER);

    await expect(
      env.market.swapExactIn(consts.RANDOM_ADDRESS, amount, consts.RANDOM_ADDRESS, amount)
    ).to.be.revertedWith(errMsg.ONLY_ROUTER);

    await expect(
      env.market.swapExactOut(consts.RANDOM_ADDRESS, amount, consts.RANDOM_ADDRESS, amount)
    ).to.be.revertedWith(errMsg.ONLY_ROUTER);

    await expect(env.market.redeemLpInterests(consts.RANDOM_ADDRESS)).to.be.revertedWith(errMsg.ONLY_ROUTER);
  });

  it('PendleRouter', async () => {
    await expect(
      env.data.connect(bob).addMarketFactory(consts.MARKET_FACTORY_AAVE, consts.RANDOM_ADDRESS)
    ).to.be.revertedWith(errMsg.ONLY_GOVERNANCE);

    await expect(env.data.connect(bob).addForge(consts.FORGE_AAVE, consts.RANDOM_ADDRESS)).to.be.revertedWith(
      errMsg.ONLY_GOVERNANCE
    );
  });
});
