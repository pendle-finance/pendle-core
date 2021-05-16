import { expect } from 'chai';
import { BigNumber as BN, Contract } from 'ethers';
import ERC20 from '../../build/artifacts/@openzeppelin/contracts/token/ERC20/ERC20.sol/ERC20.json';
import { consts, errMsg, evm_revert, evm_snapshot, Token, tokens } from '../helpers';
import { marketFixture } from './fixtures';

import { waffle } from 'hardhat';
const { loadFixture, provider } = waffle;

describe('permission-test', async () => {
  const wallets = provider.getWallets();
  const [alice, bob] = wallets;
  let router: Contract;
  let marketReader: Contract;
  let xyt: Contract;
  let xyt2: Contract;
  let market: Contract;
  let marketEth: Contract;
  let testToken: Contract;
  let snapshotId: string;
  let globalSnapshotId: string;
  let WETH: Contract;
  let tokenUSDT: Token;
  const amount: BN = BN.from(10).pow(6);
  before(async () => {
    globalSnapshotId = await evm_snapshot();
    const fixture = await loadFixture(marketFixture);
    router = fixture.core.router;
    marketReader = fixture.core.marketReader;
    xyt = fixture.aForge.aFutureYieldToken;
    xyt2 = fixture.aForge.aFutureYieldToken2;
    testToken = fixture.testToken;
    market = fixture.aMarket;
    tokenUSDT = tokens.USDT;
    WETH = new Contract(tokens.WETH.address, ERC20.abi, alice);
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
    await router.bootstrapMarket(
      consts.MARKET_FACTORY_AAVE,
      xyt.address,
      testToken.address,
      amount,
      amount,
      consts.HIGH_GAS_OVERRIDE
    );

    await expect(market.bootstrap(alice.address, amount, amount)).to.be.revertedWith(errMsg.ONLY_ROUTER);

    await expect(market.addMarketLiquidityDual(alice.address, amount, amount, amount, amount)).to.be.revertedWith(
      errMsg.ONLY_ROUTER
    );

    await expect(
      market.addMarketLiquiditySingle(alice.address, consts.ZERO_ADDRESS, amount, amount)
    ).to.be.revertedWith(errMsg.ONLY_ROUTER);

    await expect(market.removeMarketLiquidityDual(alice.address, amount, amount, amount)).to.be.revertedWith(
      errMsg.ONLY_ROUTER
    );

    await expect(
      market.removeMarketLiquiditySingle(alice.address, consts.RANDOM_ADDRESS, amount, amount)
    ).to.be.revertedWith(errMsg.ONLY_ROUTER);

    await expect(market.swapExactIn(consts.RANDOM_ADDRESS, amount, consts.RANDOM_ADDRESS, amount)).to.be.revertedWith(
      errMsg.ONLY_ROUTER
    );

    await expect(market.swapExactOut(consts.RANDOM_ADDRESS, amount, consts.RANDOM_ADDRESS, amount)).to.be.revertedWith(
      errMsg.ONLY_ROUTER
    );

    await expect(market.redeemLpInterests(consts.RANDOM_ADDRESS)).to.be.revertedWith(errMsg.ONLY_ROUTER);
  });

  it('PendleRouter', async () => {
    await expect(
      data.connect(bob).addMarketFactory(consts.MARKET_FACTORY_AAVE, consts.RANDOM_ADDRESS)
    ).to.be.revertedWith(errMsg.ONLY_GOVERNANCE);

    await expect(data.connect(bob).addForge(consts.FORGE_AAVE, consts.RANDOM_ADDRESS)).to.be.revertedWith(
      errMsg.ONLY_GOVERNANCE
    );
  });
});
