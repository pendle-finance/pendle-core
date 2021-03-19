import { expect } from "chai";
import { createFixtureLoader } from "ethereum-waffle";
import { BigNumber as BN, Contract } from "ethers";
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
} from "../helpers";
import { AMMTest } from "./ammFormulaTest";
import { marketFixture } from "./fixtures";

const { waffle } = require("hardhat");
const { provider } = waffle;

describe("PendleAaveMarket", async () => {
  const wallets = provider.getWallets();
  const loadFixture = createFixtureLoader(wallets, provider);
  const [alice, bob] = wallets;
  let router: Contract;
  let marketReader: Contract;
  let xyt: Contract;
  let xyt2: Contract;
  let stdMarket: Contract;
  let ethMarket: Contract;
  let testToken: Contract;
  let snapshotId: string;
  let globalSnapshotId: string;
  let WETH: Contract;
  let tokenUSDT: Token;

  before(async () => {
    globalSnapshotId = await evm_snapshot();

    const fixture = await loadFixture(marketFixture);
    router = fixture.core.router;
    marketReader = fixture.core.marketReader;
    xyt = fixture.aForge.aFutureYieldToken;
    xyt2 = fixture.aForge.aFutureYieldToken2;
    testToken = fixture.testToken;
    stdMarket = fixture.aMarket;
    ethMarket = fixture.ethMarket;
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

  async function bootstrapSampleMarket(amount: BN) {
    await router.bootstrapMarket(
      consts.MARKET_FACTORY_AAVE,
      xyt.address,
      testToken.address,
      amount,
      amount,
      consts.HIGH_GAS_OVERRIDE
    );
  }

  function wrapEth(object: any, weiAmount: BN): any {
    const cloneObj = JSON.parse(JSON.stringify(object));
    cloneObj.value = weiAmount;
    return cloneObj;
  }

  async function bootstrapSampleMarketEth(amount: BN) {
    await router.bootstrapMarket(
      consts.MARKET_FACTORY_AAVE,
      xyt.address,
      consts.ETH_ADDRESS,
      amount,
      amount,
      wrapEth(consts.HIGH_GAS_OVERRIDE, amount)
    );
  }

  /*
  READ ME!!!
  All tests with "_sample" suffix are legacy tests. It's improved version is in other test files
    Tests for adding/removing liquidity can be found in pendleLpFormula.spec.ts
    Tests for swapping tokens can be found in ammFormulaTest.ts
  */

  it("should be able to join a bootstrapped market with a single standard token_sample", async () => {
    const amount = amountToWei(BN.from(100), 6);

    await bootstrapSampleMarket(amount);

    let totalSupply = await stdMarket.totalSupply();
    let initalWalletBalance = await stdMarket.balanceOf(alice.address);
    await router.addMarketLiquiditySingle(
      consts.MARKET_FACTORY_AAVE,
      xyt.address,
      testToken.address,
      false,
      amount.div(10),
      totalSupply.div(21),
      consts.HIGH_GAS_OVERRIDE
    );
    let currentWalletBalance = await stdMarket.balanceOf(alice.address);
    expect(currentWalletBalance).to.be.gt(initalWalletBalance);
  });
  it("should be able to bootstrap", async () => {
    const amount = amountToWei(BN.from(100), 6);

    await bootstrapSampleMarket(amount);
    let xytBalance = await xyt.balanceOf(stdMarket.address);
    let testTokenBalance = await testToken.balanceOf(stdMarket.address);

    expect(xytBalance).to.be.equal(amount);
    expect(testTokenBalance).to.be.equal(amount);
  });

  it("should be able to join a bootstrapped pool by dual tokens_sample", async () => {
    const amount = amountToWei(BN.from(10), 6);

    await bootstrapSampleMarket(amount);

    const totalSupply = await stdMarket.totalSupply();

    await router
      .connect(bob)
      .addMarketLiquidityAll(
        consts.MARKET_FACTORY_AAVE,
        xyt.address,
        testToken.address,
        amount,
        amount,
        totalSupply,
        consts.HIGH_GAS_OVERRIDE
      );

    let xytBalance = await xyt.balanceOf(stdMarket.address);
    let testTokenBalance = await testToken.balanceOf(stdMarket.address);
    let totalSupplyBalance = await stdMarket.totalSupply();

    expect(xytBalance).to.be.equal(amount.mul(2));
    expect(testTokenBalance).to.be.equal(amount.mul(2));
    expect(totalSupplyBalance).to.be.equal(totalSupply.mul(2));
  });

  it("should be able to swap amount out_sample", async () => {
    const amount = amountToWei(BN.from(100), 6);

    await bootstrapSampleMarket(amount);

    let xytBalanceBefore = await xyt.balanceOf(stdMarket.address);

    let result = await marketReader.getMarketRateExactOut(
      xyt.address,
      testToken.address,
      amountToWei(BN.from(10), 6),
      consts.MARKET_FACTORY_AAVE
    );

    await router
      .connect(bob)
      .swapExactOut(
        xyt.address,
        testToken.address,
        amountToWei(BN.from(10), 6),
        amountToWei(BN.from(100), 6),
        consts.MAX_ALLOWANCE,
        consts.MARKET_FACTORY_AAVE,
        consts.HIGH_GAS_OVERRIDE
      );

    let xytBalance = await xyt.balanceOf(stdMarket.address);
    let testTokenBalance = await testToken.balanceOf(stdMarket.address);

    expect(xytBalance.toNumber()).to.be.approximately(
      xytBalanceBefore.add(BN.from(result[1])).toNumber(),
      20
    );
    expect(testTokenBalance).to.be.equal(amount.sub(amount.div(10)));
  });

  it("should be able to swap amount in_sample", async () => {
    const amount = amountToWei(BN.from(100), 6);

    await bootstrapSampleMarket(amount);

    await router
      .connect(bob)
      .swapExactIn(
        xyt.address,
        testToken.address,
        amountToWei(BN.from(10), 6),
        BN.from(0),
        consts.MAX_ALLOWANCE,
        consts.MARKET_FACTORY_AAVE,
        consts.HIGH_GAS_OVERRIDE
      );

    let xytBalance = await xyt.balanceOf(stdMarket.address);
    let testTokenBalance = await testToken.balanceOf(stdMarket.address);

    expect(xytBalance.toNumber()).to.be.approximately(
      amount.add(amount.div(10)).toNumber(),
      30
    );

    expect(testTokenBalance.toNumber()).to.be.approximately(
      amount.sub(amount.div(10)).toNumber(),
      amount.div(100).toNumber()
    );
  });

  it("should be able to get spot price", async () => {
    const amount = amountToWei(BN.from(100), 6);

    await bootstrapSampleMarket(amount);

    let spotPrice = await stdMarket.spotPrice(testToken.address, xyt.address);

    expect(spotPrice.toNumber()).to.be.approximately(
      1000000000000,
      100000000000
    );
  });

  it("should be able to exit a pool by dual tokens_sample", async () => {
    const amount = amountToWei(BN.from(100), 6);
    await bootstrapSampleMarket(amount);
    await advanceTime(provider, consts.ONE_MONTH);
    const totalSupply = await stdMarket.totalSupply();

    await router.removeMarketLiquidityAll(
      consts.MARKET_FACTORY_AAVE,
      xyt.address,
      testToken.address,
      totalSupply.div(10),
      BN.from(0),
      BN.from(0),
      consts.HIGH_GAS_OVERRIDE
    );

    let xytBalance = await xyt.balanceOf(stdMarket.address);
    let testTokenBalance = await testToken.balanceOf(stdMarket.address);

    expect(xytBalance).to.be.equal(amount.sub(amount.div(10)));
    expect(testTokenBalance).to.be.equal(amount.sub(amount.div(10)));
  });

  it("shouldn't be able to add liquidity by dual tokens after xyt has expired", async () => {
    const amount = amountToWei(BN.from(10), 6);
    await bootstrapSampleMarket(amount);
    const totalSupply = await stdMarket.totalSupply();

    advanceTime(provider, consts.ONE_YEAR);
    await expect(
      router
        .connect(bob)
        .addMarketLiquidityAll(
          consts.MARKET_FACTORY_AAVE,
          xyt.address,
          testToken.address,
          amount,
          amount,
          totalSupply,
          consts.HIGH_GAS_OVERRIDE
        )
    ).to.be.revertedWith(errMsg.MARKET_LOCKED);
  });

  it("shouldn't be able to add liquidity by xyt after xyt has expired", async () => {
    const amount = amountToWei(BN.from(10), 6);

    await bootstrapSampleMarket(amount);

    let totalSupply = await stdMarket.totalSupply();
    await advanceTime(provider, consts.ONE_YEAR);
    await expect(
      router.addMarketLiquiditySingle(
        consts.MARKET_FACTORY_AAVE,
        xyt.address,
        testToken.address,
        false,
        amount.div(10),
        totalSupply.div(21),
        consts.HIGH_GAS_OVERRIDE
      )
    ).to.be.revertedWith(errMsg.MARKET_LOCKED);
  });

  it("shouldn't be able to exit market by baseToken after the market has expired", async () => {
    const amount = amountToWei(BN.from(100), 6);
    await bootstrapSampleMarket(amount);

    const totalSupply = await stdMarket.totalSupply();

    await advanceTime(provider, consts.ONE_YEAR);

    await expect(
      router.removeMarketLiquiditySingle(
        consts.MARKET_FACTORY_AAVE,
        xyt.address,
        testToken.address,
        false,
        totalSupply.div(4),
        amount.div(6),
        consts.HIGH_GAS_OVERRIDE
      )
    ).to.be.revertedWith(errMsg.MARKET_LOCKED);

    await expect(
      router.removeMarketLiquiditySingle(
        consts.MARKET_FACTORY_AAVE,
        xyt.address,
        testToken.address,
        true,
        totalSupply.div(4),
        amount.div(6),
        consts.HIGH_GAS_OVERRIDE
      )
    ).to.be.revertedWith(errMsg.MARKET_LOCKED);
  });

  it("should be able to exit a pool by dual tokens after xyt has expired", async () => {
    const amount = amountToWei(BN.from(100), 6);
    await bootstrapSampleMarket(amount);
    await advanceTime(provider, consts.ONE_YEAR);
    const totalSupply = await stdMarket.totalSupply();

    await router.removeMarketLiquidityAll(
      consts.MARKET_FACTORY_AAVE,
      xyt.address,
      testToken.address,
      totalSupply.div(10),
      amount.div(10),
      amount.div(10),
      consts.HIGH_GAS_OVERRIDE
    );

    let xytBalance = await xyt.balanceOf(stdMarket.address);
    let testTokenBalance = await testToken.balanceOf(stdMarket.address);

    expect(xytBalance).to.be.equal(amount.sub(amount.div(10)));
    expect(testTokenBalance).to.be.equal(amount.sub(amount.div(10)));
  });

  it("should be able to getReserves", async () => {
    const amount = amountToWei(BN.from(100), 6);

    await bootstrapSampleMarket(amount);

    let [
      xytReserve,
      tokenReserve,
      blockTimestamp,
    ] = await stdMarket.getReserves();
    expect(xytReserve).to.be.equal(amount);
    expect(tokenReserve).to.be.equal(amount);
  });

  it("should be able to getMarketReserve", async () => {
    const amount = amountToWei(BN.from(100), 6);

    await bootstrapSampleMarket(amount);

    let [
      xytReserve,
      tokenReserve,
      currentTime,
    ] = await marketReader.getMarketReserves(
      consts.MARKET_FACTORY_AAVE,
      xyt.address,
      testToken.address
    );
    expect(xytReserve).to.be.equal(amount);
    expect(tokenReserve).to.be.equal(amount);
  });

  it("should be able to getMarketRateExactOut", async () => {
    const amount = amountToWei(BN.from(100), 6);

    await bootstrapSampleMarket(amount);

    let result = await marketReader.getMarketRateExactOut(
      xyt.address,
      testToken.address,
      amountToWei(BN.from(10), 6),
      consts.MARKET_FACTORY_AAVE
    );

    expect(result[1].toNumber()).to.be.approximately(11111111, 100);
  });

  it("should be able to getMarketRateExactIn", async () => {
    const amount = amountToWei(BN.from(100), 6);

    await bootstrapSampleMarket(amount);

    let result = await marketReader.getMarketRateExactIn(
      testToken.address,
      xyt.address,
      amountToWei(BN.from(10), 6),
      consts.MARKET_FACTORY_AAVE
    );

    expect(result[1].toNumber()).to.be.approximately(9090909, 100);
  });

  it("should be able to add market liquidity for a token_sample", async () => {
    const amount = amountToWei(BN.from(10), 6);

    await bootstrapSampleMarket(amount);
    await testToken.approve(stdMarket.address, consts.MAX_ALLOWANCE);

    let initalLpTokenBal = await stdMarket.balanceOf(alice.address);
    let initalXytBal = await xyt.balanceOf(alice.address);
    let initalTestTokenBal = await testToken.balanceOf(alice.address);

    let totalSupply = await stdMarket.totalSupply();
    await router.addMarketLiquiditySingle(
      consts.MARKET_FACTORY_AAVE,
      xyt.address,
      testToken.address,
      false,
      amount.div(10),
      totalSupply.div(21),
      consts.HIGH_GAS_OVERRIDE
    );

    let currentLpTokenBal = await stdMarket.balanceOf(alice.address);
    let currentXytBal = await xyt.balanceOf(alice.address);
    let currentTestTokenBal = await testToken.balanceOf(alice.address);

    expect(currentLpTokenBal).to.be.gt(initalLpTokenBal);
    expect(currentTestTokenBal).to.be.lt(initalTestTokenBal);
    expect(currentXytBal).to.be.equal(initalXytBal);
  });

  it("should be able to add XYT market liquidity_sample", async () => {
    const amount = amountToWei(BN.from(10), 6);

    await bootstrapSampleMarket(amount);
    await testToken.approve(stdMarket.address, consts.MAX_ALLOWANCE);

    let initalLpTokenBal = await stdMarket.balanceOf(alice.address);
    let initalXytBal = await xyt.balanceOf(alice.address);
    let initalTestTokenBal = await testToken.balanceOf(alice.address);

    let totalSupply = await stdMarket.totalSupply();
    await router.addMarketLiquiditySingle(
      consts.MARKET_FACTORY_AAVE,
      xyt.address,
      testToken.address,
      true,
      amount.div(10),
      totalSupply.div(21),
      consts.HIGH_GAS_OVERRIDE
    );

    let currentLpTokenBal = await stdMarket.balanceOf(alice.address);
    let currentXytBal = await xyt.balanceOf(alice.address);
    let currentTestTokenBal = await testToken.balanceOf(alice.address);

    expect(currentLpTokenBal).to.be.gt(initalLpTokenBal);
    expect(currentTestTokenBal).to.be.equal(initalTestTokenBal);
    expect(currentXytBal).to.be.lt(initalXytBal);
  });

  it("should be able to getMarketTokenAddresses", async () => {
    let {
      token: receivedToken,
      xyt: receivedXyt,
    } = await marketReader.getMarketTokenAddresses(stdMarket.address);
    expect(receivedToken).to.be.equal(testToken.address);
    expect(receivedXyt).to.be.equal(xyt.address);
  });

  it("shouldn't be able to create duplicated markets", async () => {
    await expect(
      router.createMarket(
        consts.MARKET_FACTORY_AAVE,
        xyt.address,
        testToken.address,
        consts.HIGH_GAS_OVERRIDE
      )
    ).to.be.revertedWith("EXISTED_MARKET");
  });

  it("should be able to swapPathExactIn", async () => {
    const amount = amountToWei(BN.from(100), 6);

    await bootstrapSampleMarket(amount);
    await bootstrapSampleMarketEth(amount);

    await router.swapPathExactIn(
      [
        [
          {
            market: stdMarket.address,
            tokenIn: testToken.address,
            tokenOut: xyt.address,
            swapAmount: amount,
            limitReturnAmount: BN.from(0),
            maxPrice: consts.MAX_ALLOWANCE,
          },
          {
            market: ethMarket.address,
            tokenIn: xyt.address,
            tokenOut: WETH.address,
            swapAmount: BN.from(0),
            limitReturnAmount: BN.from(0),
            maxPrice: consts.MAX_ALLOWANCE,
          },
        ],
      ],
      testToken.address,
      WETH.address,
      amount,
      BN.from(0),
      consts.HIGH_GAS_OVERRIDE
    );

    let tokenBalance1: BN = await testToken.balanceOf(alice.address);
    let wethBalance1: BN = await WETH.balanceOf(alice.address);

    await evm_revert(snapshotId);
    snapshotId = await evm_snapshot();

    await bootstrapSampleMarket(amount);
    await bootstrapSampleMarketEth(amount);

    let initialXytBalance: BN = await xyt.balanceOf(alice.address);
    await router.swapExactIn(
      testToken.address,
      xyt.address,
      amount,
      BN.from(0),
      consts.MAX_ALLOWANCE,
      consts.MARKET_FACTORY_AAVE,
      consts.HIGH_GAS_OVERRIDE
    );
    let postXytBalance: BN = await xyt.balanceOf(alice.address);
    await router.swapExactIn(
      xyt.address,
      WETH.address,
      postXytBalance.sub(initialXytBalance),
      BN.from(0),
      consts.MAX_ALLOWANCE,
      consts.MARKET_FACTORY_AAVE,
      consts.HIGH_GAS_OVERRIDE
    );

    let tokenBalance2: BN = await testToken.balanceOf(alice.address);
    let wethBalance2: BN = await WETH.balanceOf(alice.address);

    approxBigNumber(tokenBalance2, tokenBalance1, consts.TEST_TOKEN_DELTA);
    approxBigNumber(wethBalance2, wethBalance1, consts.TEST_TOKEN_DELTA);
  });

  it("should be able to swapPathExactOut", async () => {
    const amount = amountToWei(BN.from(100), 6);
    const swapAmount = amount.div(BN.from(10));

    await bootstrapSampleMarket(amount);
    await bootstrapSampleMarketEth(amount);

    await router.swapPathExactOut(
      [
        [
          {
            market: stdMarket.address,
            tokenIn: testToken.address,
            tokenOut: xyt.address,
            swapAmount: BN.from(0),
            limitReturnAmount: consts.MAX_ALLOWANCE, // TODO: change to some reasonable amount?
            maxPrice: consts.MAX_ALLOWANCE,
          },
          {
            market: ethMarket.address,
            tokenIn: xyt.address,
            tokenOut: WETH.address,
            swapAmount: swapAmount,
            limitReturnAmount: consts.MAX_ALLOWANCE,
            maxPrice: consts.MAX_ALLOWANCE,
          },
        ],
      ],
      testToken.address,
      WETH.address,
      consts.MAX_ALLOWANCE,
      consts.HIGH_GAS_OVERRIDE
    );

    let tokenBalance1: BN = await testToken.balanceOf(alice.address);
    let wethBalance1: BN = await WETH.balanceOf(alice.address);

    await evm_revert(snapshotId);
    snapshotId = await evm_snapshot();

    await bootstrapSampleMarket(amount);
    await bootstrapSampleMarketEth(amount);

    let initialXytBalance: BN = await xyt.balanceOf(alice.address);

    console.log("XYT", xyt.address);
    await router.swapExactOut(
      xyt.address,
      WETH.address,
      swapAmount,
      consts.MAX_ALLOWANCE,
      consts.MAX_ALLOWANCE,
      consts.MARKET_FACTORY_AAVE,
      consts.HIGH_GAS_OVERRIDE
    );
    let postXytBalance: BN = await xyt.balanceOf(alice.address);
    await router.swapExactOut(
      testToken.address,
      xyt.address,
      initialXytBalance.sub(postXytBalance),
      consts.MAX_ALLOWANCE,
      consts.MAX_ALLOWANCE,
      consts.MARKET_FACTORY_AAVE,
      consts.HIGH_GAS_OVERRIDE
    );

    let tokenBalance2: BN = await testToken.balanceOf(alice.address);
    let wethBalance2: BN = await WETH.balanceOf(alice.address);

    approxBigNumber(tokenBalance2, tokenBalance1, consts.TEST_TOKEN_DELTA);
    approxBigNumber(wethBalance2, wethBalance1, consts.TEST_TOKEN_DELTA);
  });

  it("shouldn't be able to swapPathExactIn with invalid params", async () => {
    const amount = amountToWei(BN.from(100), 6);

    await bootstrapSampleMarket(amount);
    await bootstrapSampleMarketEth(amount);

    await expect(
      router.swapPathExactIn(
        [
          [
            {
              market: stdMarket.address,
              tokenIn: testToken.address,
              tokenOut: xyt.address,
              swapAmount: amount,
              limitReturnAmount: BN.from(0),
              maxPrice: consts.MAX_ALLOWANCE,
            },
            {
              market: ethMarket.address,
              tokenIn: xyt.address,
              tokenOut: WETH.address,
              swapAmount: BN.from(0),
              limitReturnAmount: BN.from(0),
              maxPrice: consts.MAX_ALLOWANCE,
            },
          ],
        ],
        testToken.address,
        WETH.address,
        amount.mul(2),
        BN.from(0),
        consts.HIGH_GAS_OVERRIDE
      )
    ).to.be.revertedWith(errMsg.INVALID_AMOUNTS);
  });

  it("shouldn't be able to create market with XYT as quote pair", async () => {
    await expect(
      router.createMarket(
        consts.MARKET_FACTORY_AAVE,
        xyt.address,
        xyt2.address,
        consts.HIGH_GAS_OVERRIDE
      )
    ).to.be.revertedWith("XYT_QUOTE_PAIR_FORBIDDEN");
  });

  it("Aave-ETH should be able to bootstrap", async () => {
    const amount = amountToWei(BN.from(100), 6);
    await bootstrapSampleMarketEth(amount);
  });

  it("Aave-ETH should be able to join a bootstrapped market with a single standard token_sample", async () => {
    const amount = amountToWei(BN.from(100), 6);

    await bootstrapSampleMarketEth(amount);

    let totalSupply = await ethMarket.totalSupply();
    let initalWalletBalance = await ethMarket.balanceOf(alice.address);
    await router.addMarketLiquiditySingle(
      consts.MARKET_FACTORY_AAVE,
      xyt.address,
      consts.ETH_ADDRESS,
      false,
      amount.div(10),
      totalSupply.div(21),
      wrapEth(consts.HIGH_GAS_OVERRIDE, amount.div(10))
    );
    let currentWalletBalance = await ethMarket.balanceOf(alice.address);
    expect(currentWalletBalance).to.be.gt(initalWalletBalance);
  });

  it("Aave-ETH should be able to join a bootstrapped pool by dual tokens_sample", async () => {
    const amount = amountToWei(BN.from(10), 6);

    await bootstrapSampleMarketEth(amount);

    const totalSupply = await ethMarket.totalSupply();

    await router
      .connect(bob)
      .addMarketLiquidityAll(
        consts.MARKET_FACTORY_AAVE,
        xyt.address,
        consts.ETH_ADDRESS,
        amount,
        amount,
        totalSupply,
        wrapEth(consts.HIGH_GAS_OVERRIDE, amount)
      );

    let xytBalance = await xyt.balanceOf(ethMarket.address);
    let ethBalance = await WETH.balanceOf(ethMarket.address);
    let totalSupplyBalance = await ethMarket.totalSupply();

    expect(xytBalance).to.be.equal(amount.mul(2));
    expect(ethBalance).to.be.equal(amount.mul(2));
    expect(totalSupplyBalance).to.be.equal(totalSupply.mul(2));
  });

  it("Aave-ETH should be able to swap amount out_sample", async () => {
    const amount = amountToWei(BN.from(100), 6);

    await bootstrapSampleMarketEth(amount);

    let xytBalanceBefore = await xyt.balanceOf(ethMarket.address);

    let result = await marketReader.getMarketRateExactOut(
      xyt.address,
      WETH.address,
      amountToWei(BN.from(10), 6),
      consts.MARKET_FACTORY_AAVE
    );

    await router
      .connect(bob)
      .swapExactOut(
        xyt.address,
        consts.ETH_ADDRESS,
        amountToWei(BN.from(10), 6),
        amountToWei(BN.from(100), 6),
        consts.MAX_ALLOWANCE,
        consts.MARKET_FACTORY_AAVE,
        consts.HIGH_GAS_OVERRIDE
      );

    let xytBalance = await xyt.balanceOf(ethMarket.address);
    let ethBalance = await WETH.balanceOf(ethMarket.address);

    expect(xytBalance.toNumber()).to.be.approximately(
      xytBalanceBefore.add(BN.from(result[1])).toNumber(),
      20
    );
    expect(ethBalance).to.be.equal(amount.sub(amount.div(10)));
  });

  it("Aave-ETH should be able to swap amount in_sample", async () => {
    const amount = amountToWei(BN.from(100), 6);

    await bootstrapSampleMarketEth(amount);

    await router
      .connect(bob)
      .swapExactIn(
        xyt.address,
        consts.ETH_ADDRESS,
        amountToWei(BN.from(10), 6),
        BN.from(0),
        consts.MAX_ALLOWANCE,
        consts.MARKET_FACTORY_AAVE,
        consts.HIGH_GAS_OVERRIDE
      );

    let xytBalance = await xyt.balanceOf(ethMarket.address);
    let ethBalance = await WETH.balanceOf(ethMarket.address);

    expect(xytBalance.toNumber()).to.be.approximately(
      amount.add(amount.div(10)).toNumber(),
      30
    );

    expect(ethBalance.toNumber()).to.be.approximately(
      amount.sub(amount.div(10)).toNumber(),
      amount.div(100).toNumber()
    );
  });

  it("Aave-ETH should be able to get spot price", async () => {
    const amount = amountToWei(BN.from(100), 6);

    await bootstrapSampleMarketEth(amount);

    let spotPrice = await ethMarket.spotPrice(WETH.address, xyt.address);

    expect(spotPrice.toNumber()).to.be.approximately(
      1000000000000,
      100000000000
    );
  });

  it("Aave-ETH should be able to exit a pool by dual tokens_sample", async () => {
    const amount = amountToWei(BN.from(100), 6);
    await bootstrapSampleMarketEth(amount);
    await advanceTime(provider, consts.ONE_MONTH);
    const totalSupply = await ethMarket.totalSupply();

    await router.removeMarketLiquidityAll(
      consts.MARKET_FACTORY_AAVE,
      xyt.address,
      consts.ETH_ADDRESS,
      totalSupply.div(10),
      BN.from(0),
      BN.from(0),
      consts.HIGH_GAS_OVERRIDE
    );

    let xytBalance = await xyt.balanceOf(ethMarket.address);
    let testTokenBalance = await WETH.balanceOf(ethMarket.address);

    expect(xytBalance).to.be.equal(amount.sub(amount.div(10)));
    expect(testTokenBalance).to.be.equal(amount.sub(amount.div(10)));
  });

  it("Aave-ETH should be able to getReserves", async () => {
    const amount = amountToWei(BN.from(100), 6);

    await bootstrapSampleMarketEth(amount);

    let [xytReserve, tokenReserve] = await ethMarket.getReserves();
    expect(xytReserve).to.be.equal(amount);
    expect(tokenReserve).to.be.equal(amount);
  });

  it("Aave-ETH should be able to getMarketReserve", async () => {
    const amount = amountToWei(BN.from(100), 6);

    await bootstrapSampleMarketEth(amount);

    let [
      xytReserve,
      tokenReserve,
      currentTime,
    ] = await marketReader.getMarketReserves(
      consts.MARKET_FACTORY_AAVE,
      xyt.address,
      WETH.address
    );
    expect(xytReserve).to.be.equal(amount);
    expect(tokenReserve).to.be.equal(amount);
  });

  it("Aave-ETH should be able to getMarketRateExactOut", async () => {
    const amount = amountToWei(BN.from(100), 6);

    await bootstrapSampleMarketEth(amount);

    let result = await marketReader.getMarketRateExactOut(
      xyt.address,
      WETH.address,
      amountToWei(BN.from(10), 6),
      consts.MARKET_FACTORY_AAVE
    );

    expect(result[1].toNumber()).to.be.approximately(
      11111111,
      consts.TEST_TOKEN_DELTA.toNumber()
    );
  });

  it("Aave-ETH should be able to getMarketRateExactIn", async () => {
    const amount = amountToWei(BN.from(100), 6);

    await bootstrapSampleMarketEth(amount);

    let result = await marketReader.getMarketRateExactIn(
      WETH.address,
      xyt.address,
      amountToWei(BN.from(10), 6),
      consts.MARKET_FACTORY_AAVE
    );

    expect(result[1].toNumber()).to.be.approximately(
      9090909,
      consts.TEST_TOKEN_DELTA.toNumber()
    );
  });

  it("Aave-ETH should be able to add market liquidity for a token_sample", async () => {
    const amount = amountToWei(BN.from(10), 6);

    await bootstrapSampleMarketEth(amount);

    let initalLpTokenBal = await ethMarket.balanceOf(alice.address);
    let initalXytBal = await xyt.balanceOf(alice.address);
    let initalTokenBal = await provider.getBalance(alice.address);

    let totalSupply = await ethMarket.totalSupply();
    await router.addMarketLiquiditySingle(
      consts.MARKET_FACTORY_AAVE,
      xyt.address,
      consts.ETH_ADDRESS,
      false,
      amount.div(10),
      totalSupply.div(21),
      wrapEth(consts.HIGH_GAS_OVERRIDE, amount.div(10))
    );

    let currentLpTokenBal = await ethMarket.balanceOf(alice.address);
    let currentXytBal = await xyt.balanceOf(alice.address);
    let currentTokenBal = await provider.getBalance(alice.address);

    expect(currentLpTokenBal).to.be.gt(initalLpTokenBal);
    expect(currentTokenBal).to.be.lt(initalTokenBal);
    expect(currentXytBal).to.be.equal(initalXytBal);
  });

  it("Aave-ETH should be able to add XYT market liquidity_sample", async () => {
    const amount = amountToWei(BN.from(10), 6);

    await bootstrapSampleMarketEth(amount);

    let initalLpTokenBal = await ethMarket.balanceOf(alice.address);
    let initalXytBal = await xyt.balanceOf(alice.address);
    let initalTokenBal = await WETH.balanceOf(alice.address);

    let totalSupply = await ethMarket.totalSupply();
    await router.addMarketLiquiditySingle(
      consts.MARKET_FACTORY_AAVE,
      xyt.address,
      consts.ETH_ADDRESS,
      true,
      amount.div(10),
      totalSupply.div(21),
      consts.HIGH_GAS_OVERRIDE
    );

    let currentLpTokenBal = await ethMarket.balanceOf(alice.address);
    let currentXytBal = await xyt.balanceOf(alice.address);
    let currentTokenBal = await WETH.balanceOf(alice.address);

    expect(currentLpTokenBal).to.be.gt(initalLpTokenBal);
    expect(currentTokenBal).to.be.equal(initalTokenBal);
    expect(currentXytBal).to.be.lt(initalXytBal);
  });

  it("AMM's formula should be correct for swapExactIn", async () => {
    await AMMTest(
      router,
      stdMarket,
      tokenUSDT,
      testToken,
      xyt,
      bootstrapSampleMarket,
      true
    );
  });
  it("AMM's formula should be correct for swapExactOut", async () => {
    await AMMTest(
      router,
      stdMarket,
      tokenUSDT,
      testToken,
      xyt,
      bootstrapSampleMarket,
      false
    );
  });
});
