import { assert, expect } from "chai";
import { Contract, BigNumber as BN } from "ethers";
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
const LP_TEST_DELTA: BN = BN.from(10 ** 9);
const ERR_DELTA_TOO_LARGE = "fails due to delta between expected answer and actual answer is greater than allowed deta";

describe("pendleLpFormula", async () => {
  const wallets = provider.getWallets();
  const loadFixture = createFixtureLoader(wallets, provider);
  const [alice, bob] = wallets;
  let pendleRouter: Contract;
  let pendleTreasury: Contract;
  let pendleMarketFactory: Contract;
  let pendleData: Contract;
  let pendleOwnershipToken: Contract;
  let pendleXyt: Contract;
  let lendingPoolCore: Contract;
  let pendleAaveForge: Contract;
  let pendleMarket: Contract;
  let testToken: Contract;
  let aUSDT: Contract;
  let snapshotId: string;
  let globalSnapshotId: string;
  let tokenUSDT: Token;

  before(async () => {
    globalSnapshotId = await evm_snapshot();

    const fixture = await loadFixture(pendleMarketFixture);
    pendleRouter = fixture.core.pendleRouter;
    pendleTreasury = fixture.core.pendleTreasury;
    pendleMarketFactory = fixture.core.pendleMarketFactory;
    pendleData = fixture.core.pendleData;
    pendleOwnershipToken = fixture.forge.pendleOwnershipToken;
    pendleXyt = fixture.forge.pendleFutureYieldToken;
    pendleAaveForge = fixture.forge.pendleAaveForge;
    lendingPoolCore = fixture.aave.lendingPoolCore;
    testToken = fixture.testToken;
    pendleMarket = fixture.pendleMarket;
    tokenUSDT = tokens.USDT;
    aUSDT = await getAContract(alice, lendingPoolCore, tokenUSDT);
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

  async function addLiquidity(amount: BN) {
    await pendleRouter
      .connect(bob)
      .addMarketLiquidityToken(
        consts.FORGE_AAVE,
        consts.MARKET_FACTORY_AAVE,
        pendleXyt.address,
        testToken.address,
        amount,
        BN.from(0)
      );
  }

  // TODO: Investigate why market can handle a large amount of token swapping in
  it("test 1", async () => {
    const amountOfXyt = amountToWei(tokenUSDT, BN.from(331));
    const amountOfToken = amountToWei(tokenUSDT, BN.from(891));
    await bootstrapMarket(amountOfXyt, amountOfToken);

    await setTimeNextBlock(provider, consts.T0.add(consts.THREE_MONTH));
    await swapTokenToXyt(amountToWei(tokenUSDT, BN.from(1000)));

    console.log(
      `weight of testToken ${await pendleMarket.getWeight(testToken.address)}`
    );
    await addLiquidity(amountToWei(tokenUSDT, BN.from(50)));
    expect(
      approxBigNumber(
        await pendleMarket.balanceOf(bob.address),
        BN.from("15781471012099146"),
        LP_TEST_DELTA
      ),
      ERR_DELTA_TOO_LARGE
    ).to.be.true;
  });

  it("test 2", async () => {
    const amountOfXyt = amountToWei(tokenUSDT, BN.from(167));
    const amountOfToken = amountToWei(tokenUSDT, BN.from(381));
    await bootstrapMarket(amountOfXyt, amountOfToken);

    await setTimeNextBlock(provider, consts.T0.add(consts.ONE_MONTH));
    await swapTokenToXyt(amountToWei(tokenUSDT, BN.from(1)));

    console.log(
      `weight of testToken ${await pendleMarket.getWeight(testToken.address)}`
    );
    await addLiquidity(amountToWei(tokenUSDT, BN.from(157)));
    expect(
      approxBigNumber(
        await pendleMarket.balanceOf(bob.address),
        BN.from("197803881410821184"),
        LP_TEST_DELTA
      ),
      ERR_DELTA_TOO_LARGE
    ).to.be.true;
  });

  it("test 3", async () => {
    const amountOfXyt = amountToWei(tokenUSDT, BN.from(45));
    const amountOfToken = amountToWei(tokenUSDT, BN.from(951));
    await bootstrapMarket(amountOfXyt, amountOfToken);

    await setTimeNextBlock(provider, consts.T0.add(consts.ONE_MONTH.mul(5)));
    await swapTokenToXyt(amountToWei(tokenUSDT, BN.from(1)));
    console.log(
      `weight of testToken ${await pendleMarket.getWeight(testToken.address)}`
    );

    await addLiquidity(amountToWei(tokenUSDT, BN.from(729)));
    expect(
      approxBigNumber(
        await pendleMarket.balanceOf(bob.address),
        BN.from("550165108272933056"),
        LP_TEST_DELTA
      ),
      ERR_DELTA_TOO_LARGE
    ).to.be.true;
  });
  // it.only("test 3", async () => {
  //   const amountOfXyt = amountToWei(tokenUSDT, BN.from(458));
  //   const amountOfToken = amountToWei(tokenUSDT, BN.from(445))
  //   await bootstrapMarket(amountOfXyt, amountOfToken);
  //   await addLiquidity(amountToWei(tokenUSDT, BN.from(440))); // TODO: check why cannot add in 700
  //   await swapTokenToXyt(amountToWei(tokenUSDT, BN.from(1)));
  //   console.log((await pendleMarket.getWeight(testToken.address)));
  //   console.log(await pendleMarket.balanceOf(bob.address));
  // });

  // it.only("test 3 beta", async () => {
  //   const amountOfXyt = amountToWei(tokenUSDT, BN.from(458));
  //   const amountOfToken = amountToWei(tokenUSDT, BN.from(445))
  //   await bootstrapMarket(amountOfXyt, amountOfToken);
  //   await addLiquidity(amountToWei(tokenUSDT, BN.from(445)));

  //   // await setTimeNextBlock(provider, consts.T0.add(consts.THREE_MONTH));
  //   // await swapTokenToXyt(amountToWei(tokenUSDT, BN.from(1000)));

  //   console.log(`weight of testToken ${(await pendleMarket.getWeight(testToken.address))}`);

  //   assert(approxBigNumber(await pendleMarket.balanceOf(bob.address), BN.from("58059846184891792"), LP_TEST_DELTA));
  // });
});
