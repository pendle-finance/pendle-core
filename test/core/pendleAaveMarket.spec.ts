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
  getAContract,
  Token,
  tokens
} from "../helpers";
import { AMMTest } from "./AmmFormula";
import { pendleMarketFixture } from "./fixtures";

const { waffle } = require("hardhat");
const { deployContract, provider } = waffle;

describe("PendleAaveMarket", async () => {
  const wallets = provider.getWallets();
  const loadFixture = createFixtureLoader(wallets, provider);
  const [alice, bob] = wallets;
  let pendleRouter: Contract;
  let pendleTreasury: Contract;
  let pendleMarketFactory: Contract;
  let pendleData: Contract;
  let pendleAOwnershipToken: Contract;
  let pendleXyt: Contract;
  let pendleXyt2: Contract;
  let lendingPoolCore: Contract;
  let pendleAaveForge: Contract;
  let pendleStdMarket: Contract;
  let pendleEthMarket: Contract;
  let testToken: Contract;
  let aUSDT: Contract;
  let snapshotId: string;
  let globalSnapshotId: string;
  let WETH: Contract;
  let tokenUSDT: Token;

  before(async () => {
    globalSnapshotId = await evm_snapshot();

    const fixture = await loadFixture(pendleMarketFixture);
    pendleRouter = fixture.core.pendleRouter;
    pendleTreasury = fixture.core.pendleTreasury;
    pendleMarketFactory = fixture.core.pendleAMarketFactory;
    pendleData = fixture.core.pendleData;
    pendleAOwnershipToken = fixture.aForge.pendleAOwnershipToken;
    pendleXyt = fixture.aForge.pendleAFutureYieldToken;
    pendleXyt2 = fixture.aForge.pendleAFutureYieldToken2;
    pendleAaveForge = fixture.aForge.pendleAaveForge;
    lendingPoolCore = fixture.aave.lendingPoolCore;
    testToken = fixture.testToken;
    pendleStdMarket = fixture.pendleAMarket;
    pendleEthMarket = fixture.pendleEthMarket;
    tokenUSDT = tokens.USDT;
    aUSDT = await getAContract(alice, lendingPoolCore, tokenUSDT);
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
    await pendleRouter.bootstrapMarket(
      consts.MARKET_FACTORY_AAVE,
      pendleXyt.address,
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
    await pendleRouter.bootstrapMarket(
      consts.MARKET_FACTORY_AAVE,
      pendleXyt.address,
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
    Tests for swapping tokens can be found in AmmFormula.ts
  */

  it("should be able to join a bootstrapped market with a single standard token_sample", async () => {
    const amount = amountToWei(tokenUSDT, BN.from(100));

    await bootstrapSampleMarket(amount);

    let totalSupply = await pendleStdMarket.totalSupply();
    let initalWalletBalance = await pendleStdMarket.balanceOf(alice.address);
    await pendleRouter.addMarketLiquiditySingle(
      consts.MARKET_FACTORY_AAVE,
      pendleXyt.address,
      testToken.address,
      false,
      amount.div(10),
      totalSupply.div(21),
      consts.HIGH_GAS_OVERRIDE
    );
    let currentWalletBalance = await pendleStdMarket.balanceOf(alice.address);
    expect(currentWalletBalance).to.be.gt(initalWalletBalance);
  });
  it("should be able to bootstrap", async () => {
    const amount = amountToWei(tokenUSDT, BN.from(100));

    await bootstrapSampleMarket(amount);
    let yieldTokenBalance = await pendleXyt.balanceOf(pendleStdMarket.address);
    let testTokenBalance = await testToken.balanceOf(pendleStdMarket.address);

    expect(yieldTokenBalance).to.be.equal(amount);
    expect(testTokenBalance).to.be.equal(amount);
  });

  it("should be able to join a bootstrapped pool by dual tokens_sample", async () => {
    const amount = amountToWei(tokenUSDT, BN.from(10));

    await bootstrapSampleMarket(amount);

    const totalSupply = await pendleStdMarket.totalSupply();

    await pendleRouter
      .connect(bob)
      .addMarketLiquidityAll(
        consts.MARKET_FACTORY_AAVE,
        pendleXyt.address,
        testToken.address,
        amount,
        amount,
        totalSupply,
        consts.HIGH_GAS_OVERRIDE
      );

    let yieldTokenBalance = await pendleXyt.balanceOf(pendleStdMarket.address);
    let testTokenBalance = await testToken.balanceOf(pendleStdMarket.address);
    let totalSupplyBalance = await pendleStdMarket.totalSupply();

    expect(yieldTokenBalance).to.be.equal(amount.mul(2));
    expect(testTokenBalance).to.be.equal(amount.mul(2));
    expect(totalSupplyBalance).to.be.equal(totalSupply.mul(2));
  });

  it("should be able to swap amount out_sample", async () => {
    const amount = amountToWei(tokenUSDT, BN.from(100));

    await bootstrapSampleMarket(amount);

    let yieldTokenBalanceBefore = await pendleXyt.balanceOf(
      pendleStdMarket.address
    );

    let result = await pendleRouter.getMarketRateExactOut(
      pendleXyt.address,
      testToken.address,
      amountToWei(tokenUSDT, BN.from(10)),
      consts.MARKET_FACTORY_AAVE
    );

    await pendleRouter
      .connect(bob)
      .swapExactOut(
        pendleXyt.address,
        testToken.address,
        amountToWei(tokenUSDT, BN.from(10)),
        amountToWei(tokenUSDT, BN.from(100)),
        consts.MAX_ALLOWANCE,
        consts.MARKET_FACTORY_AAVE,
        consts.HIGH_GAS_OVERRIDE
      );

    let yieldTokenBalance = await pendleXyt.balanceOf(pendleStdMarket.address);
    let testTokenBalance = await testToken.balanceOf(pendleStdMarket.address);

    expect(yieldTokenBalance.toNumber()).to.be.approximately(
      yieldTokenBalanceBefore.add(BN.from(result[1])).toNumber(),
      20
    );
    expect(testTokenBalance).to.be.equal(amount.sub(amount.div(10)));
  });

  it("should be able to swap amount in_sample", async () => {
    const amount = amountToWei(tokenUSDT, BN.from(100));

    await bootstrapSampleMarket(amount);

    await pendleRouter
      .connect(bob)
      .swapExactIn(
        pendleXyt.address,
        testToken.address,
        amountToWei(tokenUSDT, BN.from(10)),
        BN.from(0),
        consts.MAX_ALLOWANCE,
        consts.MARKET_FACTORY_AAVE,
        consts.HIGH_GAS_OVERRIDE
      );

    let yieldTokenBalance = await pendleXyt.balanceOf(pendleStdMarket.address);
    let testTokenBalance = await testToken.balanceOf(pendleStdMarket.address);

    expect(yieldTokenBalance.toNumber()).to.be.approximately(
      amount.add(amount.div(10)).toNumber(),
      30
    );

    expect(testTokenBalance.toNumber()).to.be.approximately(
      amount.sub(amount.div(10)).toNumber(),
      amount.div(100).toNumber()
    );
  });

  it("should be able to get spot price", async () => {
    const amount = amountToWei(tokenUSDT, BN.from(100));

    await bootstrapSampleMarket(amount);

    let spotPrice = await pendleStdMarket.spotPrice(
      testToken.address,
      pendleXyt.address
    );

    expect(spotPrice.toNumber()).to.be.approximately(
      1000000000000,
      100000000000
    );
  });

  it("should be able to exit a pool by dual tokens_sample", async () => {
    const amount = amountToWei(tokenUSDT, BN.from(100));
    await bootstrapSampleMarket(amount);
    await advanceTime(provider, consts.ONE_MONTH);
    const totalSupply = await pendleStdMarket.totalSupply();

    await pendleRouter.removeMarketLiquidityAll(
      consts.MARKET_FACTORY_AAVE,
      pendleXyt.address,
      testToken.address,
      totalSupply.div(10),
      BN.from(0),
      BN.from(0),
      consts.HIGH_GAS_OVERRIDE
    );

    let yieldTokenBalance = await pendleXyt.balanceOf(pendleStdMarket.address);
    let testTokenBalance = await testToken.balanceOf(pendleStdMarket.address);

    expect(yieldTokenBalance).to.be.equal(amount.sub(amount.div(10)));
    expect(testTokenBalance).to.be.equal(amount.sub(amount.div(10)));
  });

  it("shouldn't be able to add liquidity by dual tokens after xyt has expired", async () => {
    const amount = amountToWei(tokenUSDT, BN.from(10));
    await bootstrapSampleMarket(amount);
    const totalSupply = await pendleStdMarket.totalSupply();

    advanceTime(provider, consts.ONE_YEAR);
    await expect(
      pendleRouter
        .connect(bob)
        .addMarketLiquidityAll(
          consts.MARKET_FACTORY_AAVE,
          pendleXyt.address,
          testToken.address,
          amount,
          amount,
          totalSupply,
          consts.HIGH_GAS_OVERRIDE
        )
    ).to.be.revertedWith(errMsg.MARKET_LOCKED);
  });

  it("shouldn't be able to add liquidity by xyt after xyt has expired", async () => {
    const amount = amountToWei(tokenUSDT, BN.from(10));

    await bootstrapSampleMarket(amount);

    let totalSupply = await pendleStdMarket.totalSupply();
    await advanceTime(provider, consts.ONE_YEAR);
    await expect(
      pendleRouter.addMarketLiquiditySingle(
        // will fail but by an unintended error
        consts.MARKET_FACTORY_AAVE,
        pendleXyt.address,
        testToken.address,
        false,
        amount.div(10),
        totalSupply.div(21),
        consts.HIGH_GAS_OVERRIDE
      )
    ).to.be.revertedWith(errMsg.MARKET_LOCKED);
  });

  it("shouldn't be able to exit market by baseToken after the market has expired", async () => {
    const amount = amountToWei(tokenUSDT, BN.from(100));
    await bootstrapSampleMarket(amount);

    const totalSupply = await pendleStdMarket.totalSupply();

    await advanceTime(provider, consts.ONE_YEAR);

    await expect(
      pendleRouter.removeMarketLiquiditySingle(
        consts.MARKET_FACTORY_AAVE,
        pendleXyt.address,
        testToken.address,
        false,
        totalSupply.div(4),
        amount.div(6),
        consts.HIGH_GAS_OVERRIDE
      )
    ).to.be.revertedWith(errMsg.MARKET_LOCKED);

    await expect(
      pendleRouter.removeMarketLiquiditySingle(
        consts.MARKET_FACTORY_AAVE,
        pendleXyt.address,
        testToken.address,
        true,
        totalSupply.div(4),
        amount.div(6),
        consts.HIGH_GAS_OVERRIDE
      )
    ).to.be.revertedWith(errMsg.MARKET_LOCKED);
  });

  it("should be able to exit a pool by dual tokens after xyt has expired", async () => {
    const amount = amountToWei(tokenUSDT, BN.from(100));
    await bootstrapSampleMarket(amount);
    await advanceTime(provider, consts.ONE_YEAR);
    const totalSupply = await pendleStdMarket.totalSupply();

    await pendleRouter.removeMarketLiquidityAll(
      consts.MARKET_FACTORY_AAVE,
      pendleXyt.address,
      testToken.address,
      totalSupply.div(10),
      amount.div(10),
      amount.div(10),
      consts.HIGH_GAS_OVERRIDE
    );

    let yieldTokenBalance = await pendleXyt.balanceOf(pendleStdMarket.address);
    let testTokenBalance = await testToken.balanceOf(pendleStdMarket.address);

    expect(yieldTokenBalance).to.be.equal(amount.sub(amount.div(10)));
    expect(testTokenBalance).to.be.equal(amount.sub(amount.div(10)));
  });

  it("should be able to getReserves", async () => {
    const amount = amountToWei(tokenUSDT, BN.from(100));

    await bootstrapSampleMarket(amount);

    let [
      xytReserve,
      tokenReserve,
      blockTimestamp,
    ] = await pendleStdMarket.getReserves();
    expect(xytReserve).to.be.equal(amount);
    expect(tokenReserve).to.be.equal(amount);
  });

  it("should be able to getMarketReserve", async () => {
    const amount = amountToWei(tokenUSDT, BN.from(100));

    await bootstrapSampleMarket(amount);

    let [
      xytReserve,
      tokenReserve,
      currentTime,
    ] = await pendleRouter.getMarketReserves(
      consts.MARKET_FACTORY_AAVE,
      pendleXyt.address,
      testToken.address
    );
    expect(xytReserve).to.be.equal(amount);
    expect(tokenReserve).to.be.equal(amount);
  });

  it("should be able to getMarketRateExactOut", async () => {
    const amount = amountToWei(tokenUSDT, BN.from(100));

    await bootstrapSampleMarket(amount);

    let result = await pendleRouter.getMarketRateExactOut(
      pendleXyt.address,
      testToken.address,
      amountToWei(tokenUSDT, BN.from(10)),
      consts.MARKET_FACTORY_AAVE
    );

    expect(result[1].toNumber()).to.be.approximately(11111111, 100);
  });

  it("should be able to getMarketRateExactIn", async () => {
    const amount = amountToWei(tokenUSDT, BN.from(100));

    await bootstrapSampleMarket(amount);

    let result = await pendleRouter.getMarketRateExactIn(
      testToken.address,
      pendleXyt.address,
      amountToWei(tokenUSDT, BN.from(10)),
      consts.MARKET_FACTORY_AAVE
    );

    expect(result[1].toNumber()).to.be.approximately(9090909, 100);
  });

  it("should be able to add market liquidity for a token_sample", async () => {
    const amount = amountToWei(tokenUSDT, BN.from(10));

    await bootstrapSampleMarket(amount);
    await testToken.approve(pendleStdMarket.address, consts.MAX_ALLOWANCE);

    let initalLpTokenBal = await pendleStdMarket.balanceOf(alice.address);
    let initalXytBal = await pendleXyt.balanceOf(alice.address);
    let initalTestTokenBal = await testToken.balanceOf(alice.address);

    let totalSupply = await pendleStdMarket.totalSupply();
    await pendleRouter.addMarketLiquiditySingle(
      consts.MARKET_FACTORY_AAVE,
      pendleXyt.address,
      testToken.address,
      false,
      amount.div(10),
      totalSupply.div(21),
      consts.HIGH_GAS_OVERRIDE
    );

    let currentLpTokenBal = await pendleStdMarket.balanceOf(alice.address);
    let currentXytBal = await pendleXyt.balanceOf(alice.address);
    let currentTestTokenBal = await testToken.balanceOf(alice.address);

    expect(currentLpTokenBal).to.be.gt(initalLpTokenBal);
    expect(currentTestTokenBal).to.be.lt(initalTestTokenBal);
    expect(currentXytBal).to.be.equal(initalXytBal);
  });

  it("should be able to add XYT market liquidity_sample", async () => {
    const amount = amountToWei(tokenUSDT, BN.from(10));

    await bootstrapSampleMarket(amount);
    await testToken.approve(pendleStdMarket.address, consts.MAX_ALLOWANCE);

    let initalLpTokenBal = await pendleStdMarket.balanceOf(alice.address);
    let initalXytBal = await pendleXyt.balanceOf(alice.address);
    let initalTestTokenBal = await testToken.balanceOf(alice.address);

    let totalSupply = await pendleStdMarket.totalSupply();
    await pendleRouter.addMarketLiquiditySingle(
      consts.MARKET_FACTORY_AAVE,
      pendleXyt.address,
      testToken.address,
      true,
      amount.div(10),
      totalSupply.div(21),
      consts.HIGH_GAS_OVERRIDE
    );

    let currentLpTokenBal = await pendleStdMarket.balanceOf(alice.address);
    let currentXytBal = await pendleXyt.balanceOf(alice.address);
    let currentTestTokenBal = await testToken.balanceOf(alice.address);

    expect(currentLpTokenBal).to.be.gt(initalLpTokenBal);
    expect(currentTestTokenBal).to.be.equal(initalTestTokenBal);
    expect(currentXytBal).to.be.lt(initalXytBal);
  });

  it("should be able to getMarketTokenAddresses", async () => {
    let { token, xyt } = await pendleRouter.getMarketTokenAddresses(
      pendleStdMarket.address
    );
    expect(token).to.be.equal(testToken.address);
    expect(xyt).to.be.equal(pendleXyt.address);
  });

  it("shouldn't be able to create duplicated markets", async () => {
    await expect(
      pendleRouter.createMarket(
        consts.MARKET_FACTORY_AAVE,
        pendleXyt.address,
        testToken.address,
        consts.HIGH_GAS_OVERRIDE
      )
    ).to.be.revertedWith("EXISTED_MARKET");
  });

  it("should be able to swapPathExactIn", async () => {
    const amount = amountToWei(tokenUSDT, BN.from(100));

    await bootstrapSampleMarket(amount);
    await bootstrapSampleMarketEth(amount);

    await pendleRouter.swapPathExactIn(
      [
        [
          {
            market: pendleStdMarket.address,
            tokenIn: testToken.address,
            tokenOut: pendleXyt.address,
            swapAmount: amount,
            limitReturnAmount: BN.from(0), // TODO: change to some reasonable amount?
            maxPrice: consts.MAX_ALLOWANCE,
          },
          {
            market: pendleEthMarket.address,
            tokenIn: pendleXyt.address,
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

    let initialXytBalance: BN = await pendleXyt.balanceOf(alice.address);
    await pendleRouter.swapExactIn(
      testToken.address,
      pendleXyt.address,
      amount,
      BN.from(0),
      consts.MAX_ALLOWANCE,
      consts.MARKET_FACTORY_AAVE
    );
    let postXytBalance: BN = await pendleXyt.balanceOf(alice.address);
    await pendleRouter.swapExactIn(
      pendleXyt.address,
      WETH.address,
      postXytBalance.sub(initialXytBalance),
      BN.from(0),
      consts.MAX_ALLOWANCE,
      consts.MARKET_FACTORY_AAVE
    );

    let tokenBalance2: BN = await testToken.balanceOf(alice.address);
    let wethBalance2: BN = await WETH.balanceOf(alice.address);

    approxBigNumber(tokenBalance2, tokenBalance1, consts.TEST_TOKEN_DELTA);
    approxBigNumber(wethBalance2, wethBalance1, consts.TEST_TOKEN_DELTA);
  });

  // Enable this test after the bug is fixed.
  xit("shouldn't be able to swapPathExactIn with invalid params", async () => {
    const amount = amountToWei(tokenUSDT, BN.from(100));

    await bootstrapSampleMarket(amount);
    await bootstrapSampleMarketEth(amount);

    await expect(
      pendleRouter.swapPathExactIn(
        [
          [
            {
              market: pendleStdMarket.address,
              tokenIn: testToken.address,
              tokenOut: pendleXyt.address,
              swapAmount: amount,
              limitReturnAmount: BN.from(0),
              maxPrice: consts.MAX_ALLOWANCE,
            },
            {
              market: pendleEthMarket.address,
              tokenIn: pendleXyt.address,
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
        BN.from(0)
      )
    ).to.be.reverted;
  });

  it("shouldn't be able to create market with XYT as quote pair", async () => {
    await expect(
      pendleRouter.createMarket(
        consts.MARKET_FACTORY_AAVE,
        pendleXyt.address,
        pendleXyt2.address,
        consts.HIGH_GAS_OVERRIDE
      )
    ).to.be.revertedWith("XYT_QUOTE_PAIR_FORBIDDEN");
  });

  it("Aave-ETH should be able to bootstrap", async () => {
    const amount = amountToWei(tokenUSDT, BN.from(100));
    await bootstrapSampleMarketEth(amount);
  });

  it("Aave-ETH should be able to join a bootstrapped market with a single standard token_sample", async () => {
    const amount = amountToWei(tokenUSDT, BN.from(100));

    await bootstrapSampleMarketEth(amount);

    let totalSupply = await pendleEthMarket.totalSupply();
    let initalWalletBalance = await pendleEthMarket.balanceOf(alice.address);
    await pendleRouter.addMarketLiquiditySingle(
      consts.MARKET_FACTORY_AAVE,
      pendleXyt.address,
      consts.ETH_ADDRESS,
      false,
      amount.div(10),
      totalSupply.div(21),
      wrapEth(consts.HIGH_GAS_OVERRIDE, amount.div(10))
    );
    let currentWalletBalance = await pendleEthMarket.balanceOf(alice.address);
    expect(currentWalletBalance).to.be.gt(initalWalletBalance);
  });

  it("Aave-ETH should be able to join a bootstrapped pool by dual tokens_sample", async () => {
    const amount = amountToWei(tokenUSDT, BN.from(10));

    await bootstrapSampleMarketEth(amount);

    const totalSupply = await pendleEthMarket.totalSupply();

    await pendleRouter
      .connect(bob)
      .addMarketLiquidityAll(
        consts.MARKET_FACTORY_AAVE,
        pendleXyt.address,
        consts.ETH_ADDRESS,
        amount,
        amount,
        totalSupply,
        wrapEth(consts.HIGH_GAS_OVERRIDE, amount)
      );

    let yieldTokenBalance = await pendleXyt.balanceOf(pendleEthMarket.address);
    let ethBalance = await WETH.balanceOf(pendleEthMarket.address);
    let totalSupplyBalance = await pendleEthMarket.totalSupply();

    expect(yieldTokenBalance).to.be.equal(amount.mul(2));
    expect(ethBalance).to.be.equal(amount.mul(2));
    expect(totalSupplyBalance).to.be.equal(totalSupply.mul(2));
  });

  it("Aave-ETH should be able to swap amount out_sample", async () => {
    const amount = amountToWei(tokenUSDT, BN.from(100));

    await bootstrapSampleMarketEth(amount);

    let yieldTokenBalanceBefore = await pendleXyt.balanceOf(
      pendleEthMarket.address
    );

    let result = await pendleRouter.getMarketRateExactOut(
      pendleXyt.address,
      WETH.address,
      amountToWei(tokenUSDT, BN.from(10)),
      consts.MARKET_FACTORY_AAVE
    );

    await pendleRouter
      .connect(bob)
      .swapExactOut(
        pendleXyt.address,
        consts.ETH_ADDRESS,
        amountToWei(tokenUSDT, BN.from(10)),
        amountToWei(tokenUSDT, BN.from(100)),
        consts.MAX_ALLOWANCE,
        consts.MARKET_FACTORY_AAVE,
        consts.HIGH_GAS_OVERRIDE
      );

    let yieldTokenBalance = await pendleXyt.balanceOf(pendleEthMarket.address);
    let ethBalance = await WETH.balanceOf(pendleEthMarket.address);

    expect(yieldTokenBalance.toNumber()).to.be.approximately(
      yieldTokenBalanceBefore.add(BN.from(result[1])).toNumber(),
      20
    );
    expect(ethBalance).to.be.equal(amount.sub(amount.div(10)));
  });

  it("Aave-ETH should be able to swap amount in_sample", async () => {
    const amount = amountToWei(tokenUSDT, BN.from(100));

    await bootstrapSampleMarketEth(amount);

    await pendleRouter
      .connect(bob)
      .swapExactIn(
        pendleXyt.address,
        consts.ETH_ADDRESS,
        amountToWei(tokenUSDT, BN.from(10)),
        BN.from(0),
        consts.MAX_ALLOWANCE,
        consts.MARKET_FACTORY_AAVE,
        consts.HIGH_GAS_OVERRIDE
      );

    let yieldTokenBalance = await pendleXyt.balanceOf(pendleEthMarket.address);
    let ethBalance = await WETH.balanceOf(pendleEthMarket.address);

    expect(yieldTokenBalance.toNumber()).to.be.approximately(
      amount.add(amount.div(10)).toNumber(),
      30
    );

    expect(ethBalance.toNumber()).to.be.approximately(
      amount.sub(amount.div(10)).toNumber(),
      amount.div(100).toNumber()
    );
  });

  it("Aave-ETH should be able to get spot price", async () => {
    const amount = amountToWei(tokenUSDT, BN.from(100));

    await bootstrapSampleMarketEth(amount);

    let spotPrice = await pendleEthMarket.spotPrice(
      WETH.address,
      pendleXyt.address
    );

    expect(spotPrice.toNumber()).to.be.approximately(
      1000000000000,
      100000000000
    );
  });

  it("Aave-ETH should be able to exit a pool by dual tokens_sample", async () => {
    const amount = amountToWei(tokenUSDT, BN.from(100));
    await bootstrapSampleMarketEth(amount);
    await advanceTime(provider, consts.ONE_MONTH);
    const totalSupply = await pendleEthMarket.totalSupply();

    await pendleRouter.removeMarketLiquidityAll(
      consts.MARKET_FACTORY_AAVE,
      pendleXyt.address,
      consts.ETH_ADDRESS,
      totalSupply.div(10),
      BN.from(0),
      BN.from(0),
      consts.HIGH_GAS_OVERRIDE
    );

    let yieldTokenBalance = await pendleXyt.balanceOf(pendleEthMarket.address);
    let testTokenBalance = await WETH.balanceOf(pendleEthMarket.address);

    expect(yieldTokenBalance).to.be.equal(amount.sub(amount.div(10)));
    expect(testTokenBalance).to.be.equal(amount.sub(amount.div(10)));
  });

  it("Aave-ETH should be able to getReserves", async () => {
    const amount = amountToWei(tokenUSDT, BN.from(100));

    await bootstrapSampleMarketEth(amount);

    let [xytReserve, tokenReserve] = await pendleEthMarket.getReserves();
    expect(xytReserve).to.be.equal(amount);
    expect(tokenReserve).to.be.equal(amount);
  });

  it("Aave-ETH should be able to getMarketReserve", async () => {
    const amount = amountToWei(tokenUSDT, BN.from(100));

    await bootstrapSampleMarketEth(amount);

    let [
      xytReserve,
      tokenReserve,
      currentTime,
    ] = await pendleRouter.getMarketReserves(
      consts.MARKET_FACTORY_AAVE,
      pendleXyt.address,
      WETH.address
    );
    expect(xytReserve).to.be.equal(amount);
    expect(tokenReserve).to.be.equal(amount);
  });

  it("Aave-ETH should be able to getMarketRateExactOut", async () => {
    const amount = amountToWei(tokenUSDT, BN.from(100));

    await bootstrapSampleMarketEth(amount);

    let result = await pendleRouter.getMarketRateExactOut(
      pendleXyt.address,
      WETH.address,
      amountToWei(tokenUSDT, BN.from(10)),
      consts.MARKET_FACTORY_AAVE
    );

    expect(result[1].toNumber()).to.be.approximately(11111111, 100);
  });

  it("Aave-ETH should be able to getMarketRateExactIn", async () => {
    const amount = amountToWei(tokenUSDT, BN.from(100));

    await bootstrapSampleMarketEth(amount);

    let result = await pendleRouter.getMarketRateExactIn(
      WETH.address,
      pendleXyt.address,
      amountToWei(tokenUSDT, BN.from(10)),
      consts.MARKET_FACTORY_AAVE
    );

    expect(result[1].toNumber()).to.be.approximately(9090909, 100);
  });

  it("Aave-ETH should be able to add market liquidity for a token_sample", async () => {
    const amount = amountToWei(tokenUSDT, BN.from(10));

    await bootstrapSampleMarketEth(amount);

    let initalLpTokenBal = await pendleEthMarket.balanceOf(alice.address);
    let initalXytBal = await pendleXyt.balanceOf(alice.address);
    let initalTokenBal = await provider.getBalance(alice.address);

    let totalSupply = await pendleEthMarket.totalSupply();
    await pendleRouter.addMarketLiquiditySingle(
      consts.MARKET_FACTORY_AAVE,
      pendleXyt.address,
      consts.ETH_ADDRESS,
      false,
      amount.div(10),
      totalSupply.div(21),
      wrapEth(consts.HIGH_GAS_OVERRIDE, amount.div(10))
    );

    let currentLpTokenBal = await pendleEthMarket.balanceOf(alice.address);
    let currentXytBal = await pendleXyt.balanceOf(alice.address);
    let currentTokenBal = await provider.getBalance(alice.address);

    expect(currentLpTokenBal).to.be.gt(initalLpTokenBal);
    expect(currentTokenBal).to.be.lt(initalTokenBal);
    expect(currentXytBal).to.be.equal(initalXytBal);
  });

  it("Aave-ETH should be able to add XYT market liquidity_sample", async () => {
    const amount = amountToWei(tokenUSDT, BN.from(10));

    await bootstrapSampleMarketEth(amount);

    let initalLpTokenBal = await pendleEthMarket.balanceOf(alice.address);
    let initalXytBal = await pendleXyt.balanceOf(alice.address);
    let initalTokenBal = await WETH.balanceOf(alice.address);

    let totalSupply = await pendleEthMarket.totalSupply();
    await pendleRouter.addMarketLiquiditySingle(
      consts.MARKET_FACTORY_AAVE,
      pendleXyt.address,
      consts.ETH_ADDRESS,
      true,
      amount.div(10),
      totalSupply.div(21),
      consts.HIGH_GAS_OVERRIDE
    );

    let currentLpTokenBal = await pendleEthMarket.balanceOf(alice.address);
    let currentXytBal = await pendleXyt.balanceOf(alice.address);
    let currentTokenBal = await WETH.balanceOf(alice.address);

    expect(currentLpTokenBal).to.be.gt(initalLpTokenBal);
    expect(currentTokenBal).to.be.equal(initalTokenBal);
    expect(currentXytBal).to.be.lt(initalXytBal);
  });

  it("AMM's formula should be correct for swapExactIn", async () => {
    await AMMTest(
      pendleRouter,
      pendleStdMarket,
      tokenUSDT,
      testToken,
      pendleXyt,
      bootstrapSampleMarket,
      true
    );
  });
  it("AMM's formula should be correct for swapExactOut", async () => {
    await AMMTest(
      pendleRouter,
      pendleStdMarket,
      tokenUSDT,
      testToken,
      pendleXyt,
      bootstrapSampleMarket,
      false
    );
  });
});
