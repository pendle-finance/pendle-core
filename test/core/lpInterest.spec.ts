import { assert, expect } from "chai";
import { createFixtureLoader } from "ethereum-waffle";
import { BigNumber as BN, Contract, Wallet } from "ethers";
import ERC20 from "../../build/artifacts/@openzeppelin/contracts/token/ERC20/ERC20.sol/ERC20.json";
import {
  advanceTime,
  amountToWei,
  approxBigNumber,
  consts,
  errMsg,
  evm_revert,
  evm_snapshot,
  Token,
  tokens,
  mintOtAndXyt,
  emptyToken,
  mintAaveToken,
  getAContract,
  setTimeNextBlock,
  mint,
} from "../helpers";
import { marketFixture } from "./fixtures";

const { waffle } = require("hardhat");
const { provider } = waffle;

describe("lpInterest for AaveMarket", async () => {
  const wallets = provider.getWallets();
  const loadFixture = createFixtureLoader(wallets, provider);
  const [alice, bob, charlie, dave, eve] = wallets;
  let router: Contract;
  let marketReader: Contract;
  let xyt: Contract;
  let ot: Contract;
  let stdMarket: Contract;
  let testToken: Contract;
  let snapshotId: string;
  let globalSnapshotId: string;
  let lendingPoolCore: Contract;
  let aUSDT: Contract;
  let tokenUSDT: Token;
  const amountXytRef = BN.from(10).pow(10);

  before(async () => {
    globalSnapshotId = await evm_snapshot();

    const fixture = await loadFixture(marketFixture);
    router = fixture.core.router;
    marketReader = fixture.core.marketReader;
    ot = fixture.aForge.aOwnershipToken;
    xyt = fixture.aForge.aFutureYieldToken;
    testToken = fixture.testToken;
    stdMarket = fixture.aMarket;
    tokenUSDT = tokens.USDT;
    lendingPoolCore = fixture.aave.lendingPoolCore;
    aUSDT = await getAContract(alice, lendingPoolCore, tokens.USDT);
    for (let user of [alice, bob, charlie, dave, eve]) {
      await emptyToken(ot, user);
      await emptyToken(xyt, user);
    }
    for (let user of [alice, bob, charlie, dave]) {
      await mintOtAndXytUSDT(user, amountXytRef.div(10 ** 6));
    }
    for (let user of [alice, bob, charlie, dave, eve]) {
      await emptyToken(aUSDT, user);
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

  async function bootstrapSampleMarket(amount: BN) {
    await router.bootstrapMarket(
      consts.MARKET_FACTORY_AAVE,
      xyt.address,
      testToken.address,
      amount,
      await testToken.balanceOf(alice.address),
      consts.HIGH_GAS_OVERRIDE
    );
  }

  // async function addMarketLiquidityAll(user: Wallet, amount: BN) {
  //   await router.connect(user).addMarketLiquidityAll(
  //     consts.MARKET_FACTORY_AAVE,
  //     xyt.address,
  //     testToken.address,
  //     consts.MAX_ALLOWANCE,
  //     consts.MAX_ALLOWANCE,
  //     amount,
  //     consts.HIGH_GAS_OVERRIDE
  //   )
  // }

  async function addMarketLiquidityAllByXyt(user: Wallet, amountXyt: BN) {
    let amountXytMarket: BN = await xyt.balanceOf(stdMarket.address);
    let amountLPMarket: BN = await stdMarket.totalSupply();
    let amountLPToGet: BN;

    if (amountXytMarket.gt(amountXyt)) {
      amountLPToGet = amountXyt.mul(amountLPMarket).div(amountXytMarket);
    }
    else {
      amountLPToGet = amountXytMarket.mul(amountLPMarket).div(amountXyt);
    }
    // console.log(amountXytMarket.toString(), amountXyt.toString(), amountLPToGet.toString(), amountLPMarket.toString());
    await router.connect(user).addMarketLiquidityAll(
      consts.MARKET_FACTORY_AAVE,
      xyt.address,
      testToken.address,
      consts.MAX_ALLOWANCE,
      consts.MAX_ALLOWANCE,
      amountLPToGet,
      consts.HIGH_GAS_OVERRIDE
    )
  }

  async function addMarketLiquidityToken(user: Wallet, amount: BN) {
    await router.connect(user).addMarketLiquiditySingle(
      consts.MARKET_FACTORY_AAVE,
      xyt.address,
      testToken.address,
      false,
      amount,
      BN.from(0),
      consts.HIGH_GAS_OVERRIDE
    )
  }

  async function addMarketLiquidityXyt(user: Wallet, amount: BN) {
    await router.connect(user).addMarketLiquiditySingle(
      consts.MARKET_FACTORY_AAVE,
      xyt.address,
      testToken.address,
      true,
      amount,
      BN.from(0),
      consts.HIGH_GAS_OVERRIDE
    )
  }

  async function removeMarketLiquidityAll(user: Wallet, amount: BN) {
    await router.removeMarketLiquidityAll(
      consts.MARKET_FACTORY_AAVE,
      xyt.address,
      testToken.address,
      amount,
      BN.from(0),
      BN.from(0),
      consts.HIGH_GAS_OVERRIDE
    );
  }

  async function removeMarketLiquidityXyt(user: Wallet, amount: BN) {
    await router.removeMarketLiquiditySingle(
      consts.MARKET_FACTORY_AAVE,
      xyt.address,
      testToken.address,
      true,
      amount,
      BN.from(0),
      consts.HIGH_GAS_OVERRIDE
    )
  }

  async function removeMarketLiquidityToken(user: Wallet, amount: BN) {
    await router.removeMarketLiquiditySingle(
      consts.MARKET_FACTORY_AAVE,
      xyt.address,
      testToken.address,
      false,
      amount,
      BN.from(0),
      consts.HIGH_GAS_OVERRIDE
    )
  }

  async function mintOtAndXytUSDT(user: Wallet, amount: BN) {
    await mintOtAndXyt(
      provider,
      tokenUSDT,
      user,
      amount,
      router
    );
  }

  async function swapExactInTokenToXyt(user: Wallet, inAmount: BN) {
    await router.connect(user).swapExactIn(
      testToken.address,
      xyt.address,
      inAmount,
      BN.from(0),
      consts.MAX_ALLOWANCE,
      consts.MARKET_FACTORY_AAVE,
      consts.HIGH_GAS_OVERRIDE
    );
  }

  async function swapExactInXytToToken(user: Wallet, inAmount: BN) {
    await router.connect(user).swapExactIn(
      xyt.address,
      testToken.address,
      inAmount,
      BN.from(0),
      consts.MAX_ALLOWANCE,
      consts.MARKET_FACTORY_AAVE,
      consts.HIGH_GAS_OVERRIDE
    );
  }

  async function addFakeXyt(user: Wallet, amount: BN) {
    await xyt.connect(user).transfer(stdMarket.address, amount);
  }

  async function getLPBalance(user: Wallet) {
    return await stdMarket.balanceOf(user.address);
  }

  it("test 1", async () => {
    await mintOtAndXytUSDT(eve, BN.from(10).pow(5));

    await bootstrapSampleMarket(BN.from(10).pow(10));

    await advanceTime(provider, consts.FIFTEEN_DAY);
    await addMarketLiquidityAllByXyt(bob, amountXytRef.div(10));
    await swapExactInXytToToken(eve, BN.from(10).pow(9));

    await advanceTime(provider, consts.FIFTEEN_DAY);
    await addMarketLiquidityAllByXyt(charlie, amountXytRef.div(5));
    await swapExactInXytToToken(eve, BN.from(10).pow(9));

    await advanceTime(provider, consts.FIFTEEN_DAY);
    await addMarketLiquidityAllByXyt(dave, amountXytRef.div(2));

    await advanceTime(provider, consts.ONE_MONTH);
    await addMarketLiquidityAllByXyt(dave, amountXytRef.div(3));
    await swapExactInXytToToken(eve, BN.from(10).pow(10));
    await addMarketLiquidityAllByXyt(bob, amountXytRef.div(6));

    await advanceTime(provider, consts.ONE_MONTH);
    await addMarketLiquidityAllByXyt(charlie, amountXytRef.div(3));
    await swapExactInXytToToken(eve, BN.from(10).pow(10));
    await addMarketLiquidityAllByXyt(charlie, amountXytRef.div(3));

    await advanceTime(provider, consts.ONE_MONTH);
    await swapExactInXytToToken(eve, BN.from(10).pow(10));
    await addMarketLiquidityAllByXyt(bob, amountXytRef.div(2));

    await advanceTime(provider, consts.ONE_MONTH);
    await swapExactInXytToToken(eve, BN.from(10).pow(10));
    await addMarketLiquidityAllByXyt(bob, amountXytRef.div(5));

    for (let user of [alice, bob, charlie, dave]) {
      await router.connect(user).claimLpInterests([stdMarket.address], consts.HIGH_GAS_OVERRIDE);
      await router.connect(user).redeemDueInterests(consts.FORGE_AAVE, tokenUSDT.address, consts.T0.add(consts.SIX_MONTH), consts.HIGH_GAS_OVERRIDE);
    }

    for (let user of [alice, bob, charlie, dave]) {
      console.log((await aUSDT.balanceOf(user.address)).toString());
    }

    const acceptedDelta = BN.from(10000);
    approxBigNumber(await aUSDT.balanceOf(alice.address), BN.from(1309016354), acceptedDelta);
    approxBigNumber(await aUSDT.balanceOf(bob.address), BN.from(871918760), acceptedDelta);
    approxBigNumber(await aUSDT.balanceOf(charlie.address), BN.from(928448406), acceptedDelta);
    approxBigNumber(await aUSDT.balanceOf(dave.address), BN.from(1080957012), acceptedDelta);
  });

  it("test 2", async () => {
    await mintOtAndXytUSDT(eve, BN.from(10).pow(5));

    await bootstrapSampleMarket(BN.from(10).pow(10));

    await advanceTime(provider, consts.FIFTEEN_DAY);
    await addMarketLiquidityXyt(bob, amountXytRef.div(10));
    await swapExactInXytToToken(eve, BN.from(10).pow(9));

    await advanceTime(provider, consts.FIFTEEN_DAY);
    await addMarketLiquidityXyt(charlie, amountXytRef.div(5));
    await swapExactInXytToToken(eve, BN.from(10).pow(9));

    await advanceTime(provider, consts.FIFTEEN_DAY);
    await addMarketLiquidityXyt(dave, amountXytRef.div(2));

    await advanceTime(provider, consts.ONE_MONTH);
    await addMarketLiquidityXyt(dave, amountXytRef.div(3));
    await swapExactInXytToToken(eve, BN.from(10).pow(10));
    await addMarketLiquidityXyt(bob, amountXytRef.div(6));

    await advanceTime(provider, consts.ONE_MONTH);
    await addMarketLiquidityXyt(charlie, amountXytRef.div(3));
    await swapExactInXytToToken(eve, BN.from(10).pow(10));
    await addMarketLiquidityXyt(charlie, amountXytRef.div(3));

    await advanceTime(provider, consts.ONE_MONTH);
    await swapExactInXytToToken(eve, BN.from(10).pow(10));
    await addMarketLiquidityXyt(bob, amountXytRef.div(2));

    await advanceTime(provider, consts.ONE_MONTH);
    await swapExactInXytToToken(eve, BN.from(10).pow(10));
    await addMarketLiquidityXyt(bob, amountXytRef.div(5));

    for (let user of [alice, bob, charlie, dave]) {
      await router.connect(user).claimLpInterests([stdMarket.address], consts.HIGH_GAS_OVERRIDE);
      await router.connect(user).redeemDueInterests(consts.FORGE_AAVE, tokenUSDT.address, consts.T0.add(consts.SIX_MONTH), consts.HIGH_GAS_OVERRIDE);
    }

    for (let user of [alice, bob, charlie, dave]) {
      console.log((await aUSDT.balanceOf(user.address)).toString());
    }

    const acceptedDelta = BN.from(10000);
    approxBigNumber(await aUSDT.balanceOf(alice.address), BN.from(1952642702), acceptedDelta);
    approxBigNumber(await aUSDT.balanceOf(bob.address), BN.from(743422701), acceptedDelta);
    approxBigNumber(await aUSDT.balanceOf(charlie.address), BN.from(722918925), acceptedDelta);
    approxBigNumber(await aUSDT.balanceOf(dave.address), BN.from(771345798), acceptedDelta);
  });

  it("test 3", async () => {
    await mintOtAndXytUSDT(eve, BN.from(10).pow(5));

    await bootstrapSampleMarket(BN.from(10).pow(10));

    await advanceTime(provider, consts.FIFTEEN_DAY);
    await addMarketLiquidityAllByXyt(bob, amountXytRef.div(10));
    await addFakeXyt(eve, BN.from(10).pow(9));

    await advanceTime(provider, consts.FIFTEEN_DAY);
    await addMarketLiquidityAllByXyt(charlie, amountXytRef.div(5));
    await addFakeXyt(eve, BN.from(10).pow(9));

    await advanceTime(provider, consts.FIFTEEN_DAY);
    await addMarketLiquidityAllByXyt(dave, amountXytRef.div(2));

    await advanceTime(provider, consts.ONE_MONTH);
    await addMarketLiquidityAllByXyt(dave, amountXytRef.div(3));
    await addFakeXyt(eve, BN.from(10).pow(10));
    await addMarketLiquidityAllByXyt(bob, amountXytRef.div(6));

    await advanceTime(provider, consts.ONE_MONTH);
    await addMarketLiquidityAllByXyt(charlie, amountXytRef.div(3));
    await addFakeXyt(eve, BN.from(10).pow(10));
    await addMarketLiquidityAllByXyt(charlie, amountXytRef.div(3));

    await advanceTime(provider, consts.ONE_MONTH);
    await addFakeXyt(eve, BN.from(10).pow(10));
    await addMarketLiquidityAllByXyt(bob, amountXytRef.div(2));

    await advanceTime(provider, consts.ONE_MONTH);
    await addFakeXyt(eve, BN.from(10).pow(10));
    await addMarketLiquidityAllByXyt(bob, amountXytRef.div(5));

    for (let user of [alice, bob, charlie, dave]) {
      await router.connect(user).claimLpInterests([stdMarket.address], consts.HIGH_GAS_OVERRIDE);
      await router.connect(user).redeemDueInterests(consts.FORGE_AAVE, tokenUSDT.address, consts.T0.add(consts.SIX_MONTH), consts.HIGH_GAS_OVERRIDE);
    }

    for (let user of [alice, bob, charlie, dave]) {
      console.log((await aUSDT.balanceOf(user.address)).toString());
    }

    const acceptedDelta = BN.from(10000);
    approxBigNumber(await aUSDT.balanceOf(alice.address), BN.from(803722622), acceptedDelta);
    approxBigNumber(await aUSDT.balanceOf(bob.address), BN.from(803722622), acceptedDelta);
    approxBigNumber(await aUSDT.balanceOf(charlie.address), BN.from(803722622), acceptedDelta);
    approxBigNumber(await aUSDT.balanceOf(dave.address), BN.from(803722622), acceptedDelta);
  });

  it.only("test 4", async () => {
    await mintOtAndXytUSDT(eve, BN.from(10).pow(5));

    await bootstrapSampleMarket(BN.from(10).pow(10));
    await advanceTime(provider, consts.ONE_DAY.mul(5));
    await removeMarketLiquidityAll(alice, (await getLPBalance(alice)).div(2));

    await advanceTime(provider, consts.FIFTEEN_DAY);
    await addMarketLiquidityXyt(bob, amountXytRef.div(10));
    await swapExactInXytToToken(eve, BN.from(10).pow(9));

    await advanceTime(provider, consts.FIFTEEN_DAY);
    await removeMarketLiquidityXyt(bob, (await getLPBalance(bob)));
    await addMarketLiquidityAllByXyt(charlie, amountXytRef.div(5));
    await swapExactInXytToToken(eve, BN.from(10).pow(9));
    await addMarketLiquidityAllByXyt(alice, await xyt.balanceOf(alice.address));

    await advanceTime(provider, consts.FIFTEEN_DAY);
    await addMarketLiquidityXyt(dave, amountXytRef.div(2));
    await removeMarketLiquidityToken(charlie, (await getLPBalance(charlie)).div(3));

    await advanceTime(provider, consts.ONE_MONTH);
    await addMarketLiquidityXyt(dave, amountXytRef.div(3));
    await swapExactInXytToToken(eve, BN.from(10).pow(10));
    await addMarketLiquidityXyt(bob, amountXytRef.div(6));

    await advanceTime(provider, consts.ONE_MONTH);
    await removeMarketLiquidityXyt(dave, (await getLPBalance(dave)).div(3));
    await addMarketLiquidityXyt(charlie, amountXytRef.div(3));
    await swapExactInXytToToken(eve, BN.from(10).pow(10));
    await addMarketLiquidityAllByXyt(charlie, amountXytRef.div(3));

    await advanceTime(provider, consts.ONE_MONTH);
    await swapExactInXytToToken(eve, BN.from(10).pow(10));
    await addMarketLiquidityXyt(bob, amountXytRef.div(2));
    await swapExactInXytToToken(eve, BN.from(10).pow(10));
    await addMarketLiquidityXyt(bob, amountXytRef.div(5));

    await advanceTime(provider, consts.ONE_MONTH);

    for (let user of [alice, bob, charlie, dave]) {
      await router.connect(user).claimLpInterests([stdMarket.address], consts.HIGH_GAS_OVERRIDE);
      await router.connect(user).redeemDueInterests(consts.FORGE_AAVE, tokenUSDT.address, consts.T0.add(consts.SIX_MONTH), consts.HIGH_GAS_OVERRIDE);
    }

    for (let user of [alice, bob, charlie, dave]) {
      console.log((await aUSDT.balanceOf(user.address)).toString());
    }

    // const acceptedDelta = BN.from(10000);
    // approxBigNumber(await aUSDT.balanceOf(alice.address), BN.from(1952642702), acceptedDelta);
    // approxBigNumber(await aUSDT.balanceOf(bob.address), BN.from(743422701), acceptedDelta);
    // approxBigNumber(await aUSDT.balanceOf(charlie.address), BN.from(722918925), acceptedDelta);
    // approxBigNumber(await aUSDT.balanceOf(dave.address), BN.from(771345798), acceptedDelta);
  });
});
