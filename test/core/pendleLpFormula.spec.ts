import { assert, expect } from "chai";
import { Contract, BigNumber as BN, Wallet } from "ethers";
import { createFixtureLoader } from "ethereum-waffle";

import { pendleMarketFixture } from "./fixtures";
import {
  consts,
  tokens,
  amountToWei,
  getAContract,
  evm_snapshot,
  evm_revert,
  Token,
  toFixedPoint,
  approxBigNumber,
  setTimeNextBlock,
} from "../helpers";
import { AMMTest } from "./AmmFormula";
const { waffle } = require("hardhat");
const { deployContract, provider } = waffle;
const LP_TEST_DELTA: BN = BN.from(2 * 10 ** 9);
const ERR_DELTA_TOO_LARGE =
  "fails due to delta between expected answer and actual answer is greater than allowed deta";

// TODO: add tests that check for transfering unused tokens back to users
describe("pendleLpFormula", async () => {
  const wallets = provider.getWallets();
  const loadFixture = createFixtureLoader(wallets, provider);
  const [alice, bob, charlie] = wallets;
  let pendleRouter: Contract;
  let pendleData: Contract;
  let pendleXyt: Contract;
  let pendleMarket: Contract;
  let testToken: Contract;
  let snapshotId: string;
  let globalSnapshotId: string;
  let tokenUSDT: Token;

  before(async () => {
    globalSnapshotId = await evm_snapshot();

    const fixture = await loadFixture(pendleMarketFixture);
    pendleRouter = fixture.core.pendleRouter;
    pendleData = fixture.core.pendleData;
    pendleXyt = fixture.forge.pendleFutureYieldToken;
    testToken = fixture.testToken;
    pendleMarket = fixture.pendleMarket;
    tokenUSDT = tokens.USDT;
    snapshotId = await evm_snapshot();
  });

  after(async () => {
    await evm_revert(globalSnapshotId);
  });

  beforeEach(async () => {
    await evm_revert(snapshotId);
    snapshotId = await evm_snapshot();
    await pendleData.setMarketFees(toFixedPoint("0.0035"), 0); // 0.35%
  });

  async function bootstrapMarket(amountOfXyt: BN, amountOfToken: BN) {
    await pendleRouter
      .connect(alice)
      .bootstrapMarket(
        consts.FORGE_AAVE,
        consts.MARKET_FACTORY_AAVE,
        pendleXyt.address,
        testToken.address,
        amountOfXyt,
        amountOfToken,
        consts.HIGH_GAS_OVERRIDE
      );
  }

  async function swapTokenToXyt(amount: BN) {
    // TODO: merge this function and the same function in AmmFormula
    await pendleRouter.swapExactIn(
      testToken.address,
      pendleXyt.address,
      amount,
      BN.from(0),
      consts.MAX_ALLOWANCE
    );
  }

  async function printMarketData() {
    console.log(
      `USDT weight: ${await pendleMarket.getWeight(
        testToken.address
      )} USDT balance: ${await pendleMarket.getBalance(
        testToken.address
      )} XYT weight: ${await pendleMarket.getWeight(
        pendleXyt.address
      )} XYT balance: ${await pendleMarket.getBalance(
        pendleXyt.address
      )} totalLp: ${await pendleMarket.totalSupply()}`
    );
  }

  async function addLiquidity(user: Wallet, tokenAddress: string, amount: BN) {
    // add by Bob since he is not having any Lp now
    if (tokenAddress == testToken.address) {
      await pendleRouter
        .connect(user)
        .addMarketLiquidityToken(
          consts.FORGE_AAVE,
          consts.MARKET_FACTORY_AAVE,
          pendleXyt.address,
          testToken.address,
          amount,
          BN.from(0)
        );
    } else if (tokenAddress == pendleXyt.address) {
      await pendleRouter
        .connect(user)
        .addMarketLiquidityXyt(
          consts.FORGE_AAVE,
          consts.MARKET_FACTORY_AAVE,
          pendleXyt.address,
          testToken.address,
          amount,
          BN.from(0)
        );
    }
  }

  async function checkBalance(user: Wallet, expected: BN) {
    expect(
      approxBigNumber(
        await pendleMarket.balanceOf(user.address),
        expected,
        LP_TEST_DELTA
      ),
      ERR_DELTA_TOO_LARGE
    ).to.be.true;
  }

  // TODO: Investigate why market can handle a large amount of token swapping in
  it("test 1", async () => {
    const amountOfXyt = amountToWei(tokenUSDT, BN.from(331));
    const amountOfToken = amountToWei(tokenUSDT, BN.from(891));
    await bootstrapMarket(amountOfXyt, amountOfToken);

    await setTimeNextBlock(provider, consts.T0.add(consts.THREE_MONTH));
    await swapTokenToXyt(amountToWei(tokenUSDT, BN.from(1000)));

    await addLiquidity(
      bob,
      testToken.address,
      amountToWei(tokenUSDT, BN.from(50))
    );
    await checkBalance(bob, BN.from("15781471012099146"));

    // await swapTokenToXyt(amountToWei(tokenUSDT, BN.from(1)));
    await printMarketData();

    await addLiquidity(
      charlie,
      pendleXyt.address,
      amountToWei(tokenUSDT, BN.from(57))
    );
    await checkBalance(charlie, BN.from("188530794007041984"));
  });

  it("test 2", async () => {
    const amountOfXyt = amountToWei(tokenUSDT, BN.from(167));
    const amountOfToken = amountToWei(tokenUSDT, BN.from(381));
    await bootstrapMarket(amountOfXyt, amountOfToken);

    await setTimeNextBlock(provider, consts.T0.add(consts.ONE_MONTH));
    await swapTokenToXyt(amountToWei(tokenUSDT, BN.from(1)));
    await addLiquidity(
      bob,
      testToken.address,
      amountToWei(tokenUSDT, BN.from(157))
    );
    await checkBalance(bob, BN.from("197803881410821184"));
    await printMarketData();

    await addLiquidity(
      charlie,
      pendleXyt.address,
      amountToWei(tokenUSDT, BN.from(36))
    );
    await checkBalance(charlie, BN.from("116503683068610384"));
  });

  it("test 3", async () => {
    const amountOfXyt = amountToWei(tokenUSDT, BN.from(45));
    const amountOfToken = amountToWei(tokenUSDT, BN.from(951));
    await bootstrapMarket(amountOfXyt, amountOfToken);

    await setTimeNextBlock(provider, consts.T0.add(consts.ONE_MONTH.mul(5)));
    await swapTokenToXyt(amountToWei(tokenUSDT, BN.from(1)));
    await addLiquidity(
      bob,
      testToken.address,
      amountToWei(tokenUSDT, BN.from(729))
    );
    await checkBalance(bob, BN.from("550165108272933056"));
    await printMarketData();

    await addLiquidity(
      charlie,
      pendleXyt.address,
      amountToWei(tokenUSDT, BN.from(12))
    );
    await checkBalance(charlie, BN.from("86120215370550144"));
  });

  // it.only("test 3", async () => {
  //   const amountOfXyt = amountToWei(tokenUSDT, BN.from(458));
  //   const amountOfToken = amountToWei(tokenUSDT, BN.from(445));
  //   await bootstrapMarket(amountOfXyt, amountOfToken);
  //   await addLiquidity(amountToWei(tokenUSDT, BN.from(700))); // TODO: check why cannot add in 700
  //   // await swapTokenToXyt(amountToWei(tokenUSDT, BN.from(1)));
  //   console.log(await pendleMarket.getWeight(testToken.address));
  //   console.log(await pendleMarket.balanceOf(bob.address));
  // });
});
