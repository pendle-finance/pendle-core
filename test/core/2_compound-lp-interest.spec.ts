import { BigNumber as BN, Contract, Wallet } from 'ethers';
import {
  advanceTime,
  amountToWei,
  approxBigNumber,
  consts,
  emptyToken,
  evm_revert,
  evm_snapshot,
  getCContract,
  getERC20Contract,
  mint,
  mintOtAndXyt,
  Token,
  tokens,
} from '../helpers';
import { marketFixture, MarketFixture } from './fixtures';
import hre from 'hardhat';
const { waffle } = hre;
const { loadFixture, provider } = waffle;

describe('compound-lp-interest', async () => {
  const wallets = provider.getWallets();
  const [alice, bob, charlie, dave, eve] = wallets;
  let router: Contract;
  let xyt: Contract;
  let ot: Contract;
  let market: Contract;
  let testToken: Contract;
  let snapshotId: string;
  let globalSnapshotId: string;
  let aaveForge: Contract;
  let aaveV2Forge: Contract;
  let cUSDT: Contract;
  let tokenUSDT: Token;
  const amountUSDTRef = BN.from(10).pow(8);
  let amountXytRef: BN;
  let amountCTokenRef: BN;
  const TEST_DELTA = BN.from(3000000);
  const FAKE_INCOME_AMOUNT = consts.INITIAL_COMPOUND_TOKEN_AMOUNT;
  let fixture: MarketFixture;

  before(async () => {
    fixture = await loadFixture(marketFixture);
    globalSnapshotId = await evm_snapshot();
    router = fixture.core.router;
    ot = fixture.cForge.cOwnershipToken;
    xyt = fixture.cForge.cFutureYieldToken;
    testToken = fixture.testToken;
    market = fixture.cMarket;
    tokenUSDT = tokens.USDT;
    aaveForge = fixture.aForge.aaveForge;
    aaveV2Forge = fixture.a2Forge.aaveV2Forge;
    cUSDT = await getCContract(alice, tokenUSDT);

    for (let user of [alice, bob, charlie, dave, eve]) {
      await router.redeemDueInterests(
        consts.FORGE_COMPOUND,
        tokenUSDT.address,
        consts.T0_C.add(consts.SIX_MONTH),
        user.address,
        consts.HIGH_GAS_OVERRIDE
      );
      await emptyToken(ot, user);
      await emptyToken(xyt, user);
      await emptyToken(cUSDT, user);
    }

    let res = await mintOtAndXytUSDT(alice, amountUSDTRef.div(10 ** 6).mul(4));
    amountCTokenRef = res.CTokenMinted.div(4);

    amountXytRef = (await xyt.balanceOf(alice.address)).div(4);
    for (let user of [bob, charlie, dave]) {
      await ot.transfer(user.address, amountXytRef);
      await xyt.transfer(user.address, amountXytRef);
    }

    for (let user of [alice, bob, charlie, dave, eve]) {
      await emptyToken(cUSDT, user);
    }

    await fixture.core.data.setInterestUpdateRateDeltaForMarket(BN.from(0));

    snapshotId = await evm_snapshot();
  });

  after(async () => {
    await evm_revert(globalSnapshotId);
  });

  beforeEach(async () => {
    await evm_revert(snapshotId);
    snapshotId = await evm_snapshot();
  });

  async function bootstrapSampleMarket(amount: BN) {
    await router.bootstrapMarket(
      consts.MARKET_FACTORY_COMPOUND,
      xyt.address,
      testToken.address,
      amount,
      (await testToken.balanceOf(alice.address)).div(1000),
      consts.HIGH_GAS_OVERRIDE
    );
  }

  async function addMarketLiquidityDualByXyt(user: Wallet, amountXyt: BN) {
    await router
      .connect(user)
      .addMarketLiquidityDual(
        consts.MARKET_FACTORY_COMPOUND,
        xyt.address,
        testToken.address,
        amountXyt,
        consts.INF,
        amountXyt,
        BN.from(0),
        consts.HIGH_GAS_OVERRIDE
      );
  }

  async function addMarketLiquidityToken(user: Wallet, amount: BN) {
    await router
      .connect(user)
      .addMarketLiquiditySingle(
        consts.MARKET_FACTORY_COMPOUND,
        xyt.address,
        testToken.address,
        false,
        amount,
        BN.from(0),
        consts.HIGH_GAS_OVERRIDE
      );
  }

  async function addMarketLiquidityXyt(user: Wallet, amount: BN) {
    await router
      .connect(user)
      .addMarketLiquiditySingle(
        consts.MARKET_FACTORY_COMPOUND,
        xyt.address,
        testToken.address,
        true,
        amount,
        BN.from(0),
        consts.HIGH_GAS_OVERRIDE
      );
  }

  async function removeMarketLiquidityDual(user: Wallet, amount: BN) {
    await router
      .connect(user)
      .removeMarketLiquidityDual(
        consts.MARKET_FACTORY_COMPOUND,
        xyt.address,
        testToken.address,
        amount,
        BN.from(0),
        BN.from(0),
        consts.HIGH_GAS_OVERRIDE
      );
  }

  async function removeMarketLiquiditySingle(user: Wallet, amount: BN) {
    await router
      .connect(user)
      .removeMarketLiquiditySingle(
        consts.MARKET_FACTORY_COMPOUND,
        xyt.address,
        testToken.address,
        true,
        amount,
        BN.from(0),
        consts.HIGH_GAS_OVERRIDE
      );
  }

  async function removeMarketLiquidityToken(user: Wallet, amount: BN) {
    await router
      .connect(user)
      .removeMarketLiquiditySingle(
        consts.MARKET_FACTORY_COMPOUND,
        xyt.address,
        testToken.address,
        false,
        amount,
        BN.from(0),
        consts.HIGH_GAS_OVERRIDE
      );
  }

  async function mintOtAndXytUSDT(
    user: Wallet,
    amount: BN
  ): Promise<{ ATokenMinted: BN; A2TokenMinted: BN; CTokenMinted: BN }> {
    return await mintOtAndXyt(tokenUSDT, user, amount, fixture.routerFix);
  }

  async function swapExactInXytToToken(user: Wallet, inAmount: BN) {
    await router
      .connect(user)
      .swapExactIn(
        xyt.address,
        testToken.address,
        inAmount,
        BN.from(0),
        consts.MARKET_FACTORY_COMPOUND,
        consts.HIGH_GAS_OVERRIDE
      );
  }

  async function addFakeIncome(token: Token, user: Wallet, amount: BN) {
    await mint(token, user, amount);
    let USDTcontract = await getERC20Contract(user, token);
    USDTcontract.connect(user).transfer(cUSDT.address, amountToWei(amount, token.decimal));
    await cUSDT.balanceOfUnderlying(user.address); // interact with compound so that it updates all info

    // to have the most accurate result since the interest is only updated every DELTA seconds
  }

  async function claimAll() {
    for (let user of [alice, bob, charlie, dave]) {
      await router.redeemLpInterests(market.address, user.address, consts.HIGH_GAS_OVERRIDE);
      await router.redeemDueInterests(
        consts.FORGE_COMPOUND,
        tokenUSDT.address,
        consts.T0_C.add(consts.SIX_MONTH),
        user.address,
        consts.HIGH_GAS_OVERRIDE
      );
    }
  }

  async function checkCUSDTBalance(expectedResult: number[]) {
    for (let id = 0; id < 4; id++) {
      approxBigNumber(await cUSDT.balanceOf(wallets[id].address), BN.from(expectedResult[id]), TEST_DELTA);
    }
  }

  async function getLPBalance(user: Wallet) {
    return await market.balanceOf(user.address);
  }

  it('test 1', async () => {
    await mintOtAndXytUSDT(eve, BN.from(10).pow(5));

    await bootstrapSampleMarket(BN.from(10).pow(10));
    await addFakeIncome(tokenUSDT, eve, FAKE_INCOME_AMOUNT);

    await advanceTime(consts.FIFTEEN_DAY);
    await addMarketLiquidityDualByXyt(bob, amountXytRef.div(10));
    await swapExactInXytToToken(eve, BN.from(10).pow(9));
    await addFakeIncome(tokenUSDT, eve, FAKE_INCOME_AMOUNT);

    await advanceTime(consts.FIFTEEN_DAY);
    await addMarketLiquidityDualByXyt(charlie, amountXytRef.div(5));
    await swapExactInXytToToken(eve, BN.from(10).pow(9));
    await addFakeIncome(tokenUSDT, eve, FAKE_INCOME_AMOUNT);

    await advanceTime(consts.FIFTEEN_DAY);
    await addMarketLiquidityDualByXyt(dave, amountXytRef.div(2));
    await addFakeIncome(tokenUSDT, eve, FAKE_INCOME_AMOUNT);

    await advanceTime(consts.ONE_MONTH);
    await addMarketLiquidityDualByXyt(dave, amountXytRef.div(3));
    await swapExactInXytToToken(eve, BN.from(10).pow(10));
    await addMarketLiquidityDualByXyt(bob, amountXytRef.div(6));
    await addFakeIncome(tokenUSDT, eve, FAKE_INCOME_AMOUNT);

    await advanceTime(consts.ONE_MONTH);
    await addMarketLiquidityDualByXyt(charlie, amountXytRef.div(3));
    await swapExactInXytToToken(eve, BN.from(10).pow(10));
    await addMarketLiquidityDualByXyt(charlie, amountXytRef.div(3));
    await addFakeIncome(tokenUSDT, eve, FAKE_INCOME_AMOUNT);

    await advanceTime(consts.ONE_MONTH);
    await swapExactInXytToToken(eve, BN.from(10).pow(10));
    await addMarketLiquidityDualByXyt(bob, amountXytRef.div(2));
    await addFakeIncome(tokenUSDT, eve, FAKE_INCOME_AMOUNT);

    await advanceTime(consts.ONE_MONTH);
    await swapExactInXytToToken(eve, BN.from(10).pow(10));
    await addMarketLiquidityDualByXyt(bob, amountXytRef.div(5));
    await addFakeIncome(tokenUSDT, eve, FAKE_INCOME_AMOUNT);

    await advanceTime(consts.ONE_DAY);
    await claimAll();

    // for (let user of [alice, bob, charlie, dave]) {
    //   console.log((await cUSDT.balanceOf(user.address)).toString());
    // }
    const expectedResult: number[] = [6298426144, 6329284079, 6346687878, 6385226675];
    await checkCUSDTBalance(expectedResult);
  });

  it('test 2', async () => {
    await mintOtAndXytUSDT(eve, BN.from(10).pow(5));

    await bootstrapSampleMarket(BN.from(10).pow(10));
    await addFakeIncome(tokenUSDT, eve, FAKE_INCOME_AMOUNT);

    await advanceTime(consts.FIFTEEN_DAY);
    await addMarketLiquidityXyt(bob, amountXytRef.div(10));
    await addFakeIncome(tokenUSDT, eve, FAKE_INCOME_AMOUNT);
    await swapExactInXytToToken(eve, BN.from(10).pow(9));

    await advanceTime(consts.FIFTEEN_DAY);
    await addFakeIncome(tokenUSDT, eve, FAKE_INCOME_AMOUNT);
    await addMarketLiquidityXyt(charlie, amountXytRef.div(5));
    await swapExactInXytToToken(eve, BN.from(10).pow(9));

    await advanceTime(consts.FIFTEEN_DAY);
    await addMarketLiquidityXyt(dave, amountXytRef.div(2));
    await addFakeIncome(tokenUSDT, eve, FAKE_INCOME_AMOUNT);

    await advanceTime(consts.ONE_MONTH);
    await addMarketLiquidityXyt(dave, amountXytRef.div(3));
    await addFakeIncome(tokenUSDT, eve, FAKE_INCOME_AMOUNT);
    await swapExactInXytToToken(eve, BN.from(10).pow(10));
    await addFakeIncome(tokenUSDT, eve, FAKE_INCOME_AMOUNT);
    await addMarketLiquidityXyt(bob, amountXytRef.div(6));

    await advanceTime(consts.ONE_MONTH);
    await addMarketLiquidityXyt(charlie, amountXytRef.div(3));
    await swapExactInXytToToken(eve, BN.from(10).pow(10));
    await addFakeIncome(tokenUSDT, eve, FAKE_INCOME_AMOUNT);
    await addMarketLiquidityXyt(charlie, amountXytRef.div(3));

    await advanceTime(consts.ONE_MONTH);
    await swapExactInXytToToken(eve, BN.from(10).pow(10));
    await addFakeIncome(tokenUSDT, eve, FAKE_INCOME_AMOUNT);
    await addMarketLiquidityXyt(bob, amountXytRef.div(2));

    await advanceTime(consts.ONE_MONTH);
    await addFakeIncome(tokenUSDT, eve, FAKE_INCOME_AMOUNT);
    await swapExactInXytToToken(eve, BN.from(10).pow(10));
    await addFakeIncome(tokenUSDT, eve, FAKE_INCOME_AMOUNT);
    await addMarketLiquidityXyt(bob, amountXytRef.div(5));

    await advanceTime(consts.ONE_DAY);
    await claimAll();

    // for (let user of [alice, bob, charlie, dave]) {
    //   console.log((await cUSDT.balanceOf(user.address)).toString());
    // }
    const expectedResult: number[] = [9004048190, 8170338541, 7453587736, 6971317641];
    await checkCUSDTBalance(expectedResult);
  });

  it('test 3', async () => {
    await mintOtAndXytUSDT(eve, BN.from(10).pow(5));

    await bootstrapSampleMarket(BN.from(10).pow(10));
    await addFakeIncome(tokenUSDT, eve, FAKE_INCOME_AMOUNT);

    await advanceTime(consts.ONE_DAY.mul(5));
    await addFakeIncome(tokenUSDT, eve, FAKE_INCOME_AMOUNT);
    await removeMarketLiquidityDual(alice, (await getLPBalance(alice)).div(2));
    await addFakeIncome(tokenUSDT, eve, FAKE_INCOME_AMOUNT);

    await advanceTime(consts.FIFTEEN_DAY);
    await addFakeIncome(tokenUSDT, eve, FAKE_INCOME_AMOUNT);
    await addMarketLiquidityXyt(bob, amountXytRef.div(10));
    await swapExactInXytToToken(eve, BN.from(10).pow(9));
    await addFakeIncome(tokenUSDT, eve, FAKE_INCOME_AMOUNT);

    await advanceTime(consts.FIFTEEN_DAY);
    await addFakeIncome(tokenUSDT, eve, FAKE_INCOME_AMOUNT);
    await removeMarketLiquiditySingle(bob, await getLPBalance(bob));
    await addMarketLiquidityDualByXyt(charlie, amountXytRef.div(5));
    await addFakeIncome(tokenUSDT, eve, FAKE_INCOME_AMOUNT);
    await swapExactInXytToToken(eve, BN.from(10).pow(9));
    await addMarketLiquidityDualByXyt(alice, await xyt.balanceOf(alice.address));

    await advanceTime(consts.FIFTEEN_DAY);
    await addFakeIncome(tokenUSDT, eve, FAKE_INCOME_AMOUNT);
    await addMarketLiquidityXyt(dave, amountXytRef.div(2));
    await addFakeIncome(tokenUSDT, eve, FAKE_INCOME_AMOUNT);
    await removeMarketLiquidityToken(charlie, (await getLPBalance(charlie)).div(3));

    await advanceTime(consts.ONE_MONTH);
    await addMarketLiquidityXyt(dave, amountXytRef.div(3));
    await addFakeIncome(tokenUSDT, eve, FAKE_INCOME_AMOUNT);
    await swapExactInXytToToken(eve, BN.from(10).pow(10));
    await addFakeIncome(tokenUSDT, eve, FAKE_INCOME_AMOUNT);
    await addMarketLiquidityXyt(bob, amountXytRef.div(6));

    await advanceTime(consts.ONE_MONTH);
    await removeMarketLiquiditySingle(dave, (await getLPBalance(dave)).div(3));
    await addMarketLiquidityXyt(charlie, amountXytRef.div(3));
    await addFakeIncome(tokenUSDT, eve, FAKE_INCOME_AMOUNT);
    await swapExactInXytToToken(eve, BN.from(10).pow(10));
    await addFakeIncome(tokenUSDT, eve, FAKE_INCOME_AMOUNT);
    await addMarketLiquidityDualByXyt(charlie, amountXytRef.div(3));

    await advanceTime(consts.ONE_MONTH);
    await swapExactInXytToToken(eve, BN.from(10).pow(10));
    await addFakeIncome(tokenUSDT, eve, FAKE_INCOME_AMOUNT);
    await addMarketLiquidityXyt(bob, amountXytRef.div(2));
    await swapExactInXytToToken(eve, BN.from(10).pow(10));
    await addFakeIncome(tokenUSDT, eve, FAKE_INCOME_AMOUNT);
    await addMarketLiquidityXyt(bob, amountXytRef.div(5));
    await advanceTime(consts.ONE_MONTH);

    await advanceTime(consts.ONE_DAY);
    for (let user of [dave, charlie, bob, alice]) {
      await router.redeemLpInterests(market.address, user.address, consts.HIGH_GAS_OVERRIDE);
      await router.redeemDueInterests(
        consts.FORGE_COMPOUND,
        tokenUSDT.address,
        consts.T0_C.add(consts.SIX_MONTH),
        user.address,
        consts.HIGH_GAS_OVERRIDE
      );
    }

    // for (let user of [alice, bob, charlie, dave]) {
    //   console.log((await cUSDT.balanceOf(user.address)).toString());
    // }
    const expectedResult: number[] = [14132885215, 11089436798, 11134332033, 10506380313];
    await checkCUSDTBalance(expectedResult);
  });

  it('test 4', async () => {
    await mintOtAndXytUSDT(eve, BN.from(10).pow(5));

    await bootstrapSampleMarket(BN.from(10).pow(10));

    await advanceTime(consts.FIFTEEN_DAY);
    await addFakeIncome(tokenUSDT, eve, FAKE_INCOME_AMOUNT);
    await addMarketLiquidityDualByXyt(bob, amountXytRef.div(10));

    await advanceTime(consts.FIFTEEN_DAY);
    await addFakeIncome(tokenUSDT, eve, FAKE_INCOME_AMOUNT);
    await addMarketLiquidityDualByXyt(charlie, amountXytRef.div(5));

    await advanceTime(consts.FIFTEEN_DAY);
    await addFakeIncome(tokenUSDT, eve, FAKE_INCOME_AMOUNT);
    await addMarketLiquidityDualByXyt(dave, amountXytRef.div(2));

    await advanceTime(consts.FIFTEEN_DAY);
    await addFakeIncome(tokenUSDT, eve, FAKE_INCOME_AMOUNT);
    await addMarketLiquidityDualByXyt(dave, amountXytRef.div(3));
    await addMarketLiquidityDualByXyt(bob, amountXytRef.div(6));

    await advanceTime(consts.FIFTEEN_DAY);
    await addFakeIncome(tokenUSDT, eve, FAKE_INCOME_AMOUNT);
    await addMarketLiquidityDualByXyt(charlie, amountXytRef.div(3));
    await addMarketLiquidityDualByXyt(charlie, amountXytRef.div(3));

    await advanceTime(consts.FIFTEEN_DAY);
    await addFakeIncome(tokenUSDT, eve, FAKE_INCOME_AMOUNT);
    await addMarketLiquidityDualByXyt(bob, amountXytRef.div(2));

    await advanceTime(consts.FIFTEEN_DAY);
    await addFakeIncome(tokenUSDT, eve, FAKE_INCOME_AMOUNT);
    await addMarketLiquidityDualByXyt(bob, amountXytRef.div(5));

    await advanceTime(consts.ONE_DAY);
    await claimAll();

    const aliceCUSDTBalance = await cUSDT.balanceOf(alice.address);
    for (let user of [bob, charlie, dave]) {
      const USDTBalance = await cUSDT.balanceOf(user.address);
      approxBigNumber(USDTBalance, aliceCUSDTBalance, TEST_DELTA);
    }
  });

  it('test 5', async () => {
    await mintOtAndXytUSDT(eve, BN.from(10).pow(5));

    await bootstrapSampleMarket(BN.from(10).pow(10));

    await advanceTime(consts.FIFTEEN_DAY);
    await addFakeIncome(tokenUSDT, eve, FAKE_INCOME_AMOUNT);
    await addMarketLiquidityDualByXyt(bob, amountXytRef.div(5));

    await advanceTime(consts.FIFTEEN_DAY);
    await addFakeIncome(tokenUSDT, eve, FAKE_INCOME_AMOUNT);
    await addMarketLiquidityDualByXyt(charlie, amountXytRef.div(2));

    await advanceTime(consts.FIFTEEN_DAY);
    await addFakeIncome(tokenUSDT, eve, FAKE_INCOME_AMOUNT);
    await addMarketLiquidityDualByXyt(dave, amountXytRef.div(3));

    await advanceTime(consts.FIFTEEN_DAY);
    await addFakeIncome(tokenUSDT, eve, FAKE_INCOME_AMOUNT);
    await addMarketLiquidityDualByXyt(dave, amountXytRef.div(3));
    await addMarketLiquidityDualByXyt(bob, amountXytRef.div(5));

    await advanceTime(consts.FIFTEEN_DAY);
    await addFakeIncome(tokenUSDT, eve, FAKE_INCOME_AMOUNT);
    await addMarketLiquidityDualByXyt(charlie, amountXytRef.div(6));
    await addMarketLiquidityDualByXyt(charlie, amountXytRef.div(6));

    await advanceTime(consts.FIFTEEN_DAY);
    await addFakeIncome(tokenUSDT, eve, FAKE_INCOME_AMOUNT);
    await addMarketLiquidityDualByXyt(bob, amountXytRef.div(2));

    await advanceTime(consts.FIFTEEN_DAY);
    await addFakeIncome(tokenUSDT, eve, FAKE_INCOME_AMOUNT);

    await advanceTime(consts.ONE_DAY);
    await claimAll();

    const aliceCUSDTBalance = await cUSDT.balanceOf(alice.address);
    for (let user of [bob, charlie, dave]) {
      const USDTBalance = await cUSDT.balanceOf(user.address);
      approxBigNumber(USDTBalance, aliceCUSDTBalance, TEST_DELTA);
    }
  });

  it('test 6', async () => {
    await mintOtAndXytUSDT(eve, BN.from(10).pow(5));

    await bootstrapSampleMarket(BN.from(10).pow(10));

    await advanceTime(consts.FIFTEEN_DAY);
    await addFakeIncome(tokenUSDT, eve, FAKE_INCOME_AMOUNT);
    await addMarketLiquidityDualByXyt(bob, amountXytRef.div(5));

    await advanceTime(consts.FIFTEEN_DAY);
    await addFakeIncome(tokenUSDT, eve, FAKE_INCOME_AMOUNT);
    await addMarketLiquidityDualByXyt(charlie, amountXytRef.div(2));

    await advanceTime(consts.FIFTEEN_DAY);
    await addFakeIncome(tokenUSDT, eve, FAKE_INCOME_AMOUNT);
    await addMarketLiquidityDualByXyt(dave, amountXytRef.div(3));

    await advanceTime(consts.FIFTEEN_DAY);
    await addFakeIncome(tokenUSDT, eve, FAKE_INCOME_AMOUNT);
    await addMarketLiquidityDualByXyt(dave, amountXytRef.div(3));
    await addMarketLiquidityDualByXyt(bob, amountXytRef.div(5));

    await advanceTime(consts.FIFTEEN_DAY);
    await addFakeIncome(tokenUSDT, eve, FAKE_INCOME_AMOUNT);
    await addMarketLiquidityDualByXyt(charlie, amountXytRef.div(6));
    await addMarketLiquidityDualByXyt(charlie, amountXytRef.div(6));

    await advanceTime(consts.FIFTEEN_DAY);
    await addFakeIncome(tokenUSDT, eve, FAKE_INCOME_AMOUNT);
    await addMarketLiquidityDualByXyt(bob, amountXytRef.div(2));

    await advanceTime(consts.FIFTEEN_DAY);
    await addFakeIncome(tokenUSDT, eve, FAKE_INCOME_AMOUNT);

    for (let i = 0; i < 6; i++) {
      await addFakeIncome(tokenUSDT, eve, FAKE_INCOME_AMOUNT);
      await advanceTime(consts.SIX_MONTH);
    }

    await claimAll();
    for (let user of [alice, bob, charlie, dave]) {
      if ((await getLPBalance(user)).gt(0)) {
        await removeMarketLiquidityDual(user, await getLPBalance(user));
      }
      if ((await ot.balanceOf(user.address)).gt(0)) {
        await router
          .connect(user)
          .redeemAfterExpiry(consts.FORGE_COMPOUND, tokenUSDT.address, consts.T0_C.add(consts.SIX_MONTH));
      }
    }

    for (let user of [alice, bob, charlie, dave]) {
      approxBigNumber(await cUSDT.balanceOf(user.address), amountCTokenRef, TEST_DELTA);
    }
  });
});
