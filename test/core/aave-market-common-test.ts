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
  tokens, bootstrapMarket
} from "../helpers";
import { AMMTest } from "./amm-formula-test";
import {
  marketFixture,
  MarketFixture,
  TestEnv,
  Mode,
  parseTestEnvMarketFixture,
} from "./fixtures";


const { waffle } = require("hardhat");
const { provider } = waffle;

export function runTest(isAaveV1: boolean) {
  describe("", async () => {
    const wallets = provider.getWallets();
    const loadFixture = createFixtureLoader(wallets, provider);
    const [alice, bob] = wallets;
    let snapshotId: string;
    let globalSnapshotId: string;
    let USDT: Token;
    let WETH: Contract;
    let env: TestEnv = {} as TestEnv;

    async function buildTestEnv() {
      let fixture: MarketFixture = await loadFixture(marketFixture);
      if (isAaveV1)
        await parseTestEnvMarketFixture(alice, Mode.AAVE_V1, env, fixture);
      else await parseTestEnvMarketFixture(alice, Mode.AAVE_V2, env, fixture);
      USDT = tokens.USDT;
      env.TEST_DELTA = BN.from(60000);
    }

    before(async () => {
      globalSnapshotId = await evm_snapshot();
      await buildTestEnv();
      USDT = tokens.USDT;
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

    function wrapEth(object: any, weiAmount: BN): any {
      const cloneObj = JSON.parse(JSON.stringify(object));
      cloneObj.value = weiAmount;
      return cloneObj;
    }

    async function bootstrapMarketEth(amount: BN) {
      await env.router.bootstrapMarket(
        consts.MARKET_FACTORY_AAVE,
        env.xyt.address,
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
      Tests for swapping tokens can be found in amm-formula-test.ts
    */

    it("should be able to join a bootstrapped market with a single standard token_sample", async () => {
      const amount = amountToWei(BN.from(100), 6);

      await bootstrapMarket(env, alice, amount);

      let totalSupply = await env.stdMarket.totalSupply();
      let initialWalletBalance = await env.stdMarket.balanceOf(alice.address);
      await env.router.addMarketLiquiditySingle(
        consts.MARKET_FACTORY_AAVE,
        env.xyt.address,
        env.testToken.address,
        false,
        amount.div(10),
        totalSupply.div(21),
        consts.HIGH_GAS_OVERRIDE
      );
      let currentWalletBalance = await env.stdMarket.balanceOf(alice.address);
      expect(currentWalletBalance).to.be.gt(initialWalletBalance);
    });
    it("should be able to bootstrap", async () => {
      const amount = amountToWei(BN.from(100), 6);

      await bootstrapMarket(env, alice, amount);
      let xytBalance = await env.xyt.balanceOf(env.stdMarket.address);
      let testTokenBalance = await env.testToken.balanceOf(env.stdMarket.address);

      expect(xytBalance).to.be.equal(amount);
      expect(testTokenBalance).to.be.equal(amount);
    });

    it("should be able to join a bootstrapped pool by dual tokens_sample", async () => {
      const amount = amountToWei(BN.from(10), 6);

      await bootstrapMarket(env, alice, amount);

      const totalSupply = await env.stdMarket.totalSupply();

      await env.router
        .connect(bob)
        .addMarketLiquidityDual(
          consts.MARKET_FACTORY_AAVE,
          env.xyt.address,
          env.testToken.address,
          amount,
          amount,
          BN.from(0),
          BN.from(0),
          consts.HIGH_GAS_OVERRIDE
        );

      let xytBalance = await env.xyt.balanceOf(env.stdMarket.address);
      let testTokenBalance = await env.testToken.balanceOf(env.stdMarket.address);
      let totalSupplyBalance = await env.stdMarket.totalSupply();

      expect(xytBalance).to.be.equal(amount.mul(2));
      expect(testTokenBalance).to.be.equal(amount.mul(2));
      expect(totalSupplyBalance).to.be.equal(totalSupply.mul(2));
    });

    it("should be able to swap amount out_sample", async () => {
      const amount = amountToWei(BN.from(100), 6);

      await bootstrapMarket(env, alice, amount);

      let xytBalanceBefore = await env.xyt.balanceOf(env.stdMarket.address);

      let result = await env.marketReader.getMarketRateExactOut(
        env.xyt.address,
        env.testToken.address,
        amountToWei(BN.from(10), 6),
        consts.MARKET_FACTORY_AAVE
      );

      await env.router
        .connect(bob)
        .swapExactOut(
          env.xyt.address,
          env.testToken.address,
          amountToWei(BN.from(10), 6),
          amountToWei(BN.from(100), 6),
          consts.MARKET_FACTORY_AAVE,
          consts.HIGH_GAS_OVERRIDE
        );

      let xytBalance = await env.xyt.balanceOf(env.stdMarket.address);
      let testTokenBalance = await env.testToken.balanceOf(env.stdMarket.address);

      expect(xytBalance.toNumber()).to.be.approximately(
        xytBalanceBefore.add(BN.from(result[1])).toNumber(),
        20
      );
      expect(testTokenBalance).to.be.equal(amount.sub(amount.div(10)));
    });

    it("should be able to swap amount in_sample", async () => {
      const amount = amountToWei(BN.from(100), 6);

      await bootstrapMarket(env, alice, amount);

      await env.router
        .connect(bob)
        .swapExactIn(
          env.xyt.address,
          env.testToken.address,
          amountToWei(BN.from(10), 6),
          BN.from(0),
          consts.MARKET_FACTORY_AAVE,
          consts.HIGH_GAS_OVERRIDE
        );

      let xytBalance = await env.xyt.balanceOf(env.stdMarket.address);
      let testTokenBalance = await env.testToken.balanceOf(env.stdMarket.address);

      expect(xytBalance.toNumber()).to.be.approximately(
        amount.add(amount.div(10)).toNumber(),
        30
      );

      expect(testTokenBalance.toNumber()).to.be.approximately(
        amount.sub(amount.div(10)).toNumber(),
        amount.div(100).toNumber()
      );
    });

    it("should be able to exit a pool by dual tokens_sample", async () => {
      const amount = amountToWei(BN.from(100), 6);
      await bootstrapMarket(env, alice, amount);
      await advanceTime(consts.ONE_MONTH);
      const totalSupply = await env.stdMarket.totalSupply();

      await env.router.removeMarketLiquidityDual(
        consts.MARKET_FACTORY_AAVE,
        env.xyt.address,
        env.testToken.address,
        totalSupply.div(10),
        BN.from(0),
        BN.from(0),
        consts.HIGH_GAS_OVERRIDE
      );

      let xytBalance = await env.xyt.balanceOf(env.stdMarket.address);
      let testTokenBalance = await env.testToken.balanceOf(env.stdMarket.address);

      expect(xytBalance).to.be.equal(amount.sub(amount.div(10)));
      expect(testTokenBalance).to.be.equal(amount.sub(amount.div(10)));
    });

    it("the market should still be usable after all liquidity has been withdrawn", async () => {
      const amount = amountToWei(BN.from(100), 6);
      await bootstrapMarket(env, alice, amount);
      let lpBalanceBefore: BN = await env.stdMarket.balanceOf(alice.address);
      await env.router.removeMarketLiquidityDual(
        consts.MARKET_FACTORY_AAVE,
        env.xyt.address,
        env.testToken.address,
        lpBalanceBefore,
        BN.from(0),
        BN.from(0),
        consts.HIGH_GAS_OVERRIDE
      );

      await env.router.addMarketLiquidityDual(
        consts.MARKET_FACTORY_AAVE,
        env.xyt.address,
        env.testToken.address,
        amount,
        consts.INF,
        BN.from(0),
        BN.from(0),
        consts.HIGH_GAS_OVERRIDE
      );

      let xytBalance = await env.xyt.balanceOf(env.stdMarket.address);
      let testTokenBalance = await env.testToken.balanceOf(env.stdMarket.address);

      approxBigNumber(xytBalance, amount, BN.from(1000));
      approxBigNumber(testTokenBalance, amount, BN.from(1000));
    });

    it("shouldn't be able to add liquidity by dual tokens after xyt has expired", async () => {
      const amount = amountToWei(BN.from(10), 6);
      await bootstrapMarket(env, alice, amount);

      advanceTime(consts.ONE_YEAR);

      await expect(
        env.router
          .connect(bob)
          .addMarketLiquidityDual(
            consts.MARKET_FACTORY_AAVE,
            env.xyt.address,
            env.testToken.address,
            amount,
            consts.INF,
            BN.from(0),
            BN.from(0),
            consts.HIGH_GAS_OVERRIDE
          )
      ).to.be.revertedWith(errMsg.MARKET_LOCKED);
    });

    it("shouldn't be able to add liquidity by xyt after xyt has expired", async () => {
      const amount = amountToWei(BN.from(10), 6);

      await bootstrapMarket(env, alice, amount);

      let totalSupply = await env.stdMarket.totalSupply();
      await advanceTime(consts.ONE_YEAR);
      await expect(
        env.router.addMarketLiquiditySingle(
          consts.MARKET_FACTORY_AAVE,
          env.xyt.address,
          env.testToken.address,
          false,
          amount.div(10),
          totalSupply.div(21),
          consts.HIGH_GAS_OVERRIDE
        )
      ).to.be.revertedWith(errMsg.MARKET_LOCKED);
    });

    it("shouldn't be able to exit market by baseToken after the market has expired", async () => {
      const amount = amountToWei(BN.from(100), 6);
      await bootstrapMarket(env, alice, amount);

      const totalSupply = await env.stdMarket.totalSupply();

      await advanceTime(consts.ONE_YEAR);

      await expect(
        env.router.removeMarketLiquiditySingle(
          consts.MARKET_FACTORY_AAVE,
          env.xyt.address,
          env.testToken.address,
          false,
          totalSupply.div(4),
          amount.div(6),
          consts.HIGH_GAS_OVERRIDE
        )
      ).to.be.revertedWith(errMsg.MARKET_LOCKED);

      await expect(
        env.router.removeMarketLiquiditySingle(
          consts.MARKET_FACTORY_AAVE,
          env.xyt.address,
          env.testToken.address,
          true,
          totalSupply.div(4),
          amount.div(6),
          consts.HIGH_GAS_OVERRIDE
        )
      ).to.be.revertedWith(errMsg.MARKET_LOCKED);
    });

    it("should be able to exit a pool by dual tokens after xyt has expired", async () => {
      const amount = amountToWei(BN.from(100), 6);
      await bootstrapMarket(env, alice, amount);
      await advanceTime(consts.ONE_YEAR);
      const totalSupply = await env.stdMarket.totalSupply();

      await env.router.removeMarketLiquidityDual(
        consts.MARKET_FACTORY_AAVE,
        env.xyt.address,
        env.testToken.address,
        totalSupply.div(10),
        amount.div(10),
        amount.div(10),
        consts.HIGH_GAS_OVERRIDE
      );

      let xytBalance = await env.xyt.balanceOf(env.stdMarket.address);
      let testTokenBalance = await env.testToken.balanceOf(env.stdMarket.address);

      expect(xytBalance).to.be.equal(amount.sub(amount.div(10)));
      expect(testTokenBalance).to.be.equal(amount.sub(amount.div(10)));
    });

    it("should be able to getReserves", async () => {
      const amount = amountToWei(BN.from(100), 6);

      await bootstrapMarket(env, alice, amount);

      let { xytBalance, tokenBalance } = await env.stdMarket.getReserves();
      expect(xytBalance).to.be.equal(amount);
      expect(tokenBalance).to.be.equal(amount);
    });

    it("should be able to getMarketReserve", async () => {
      const amount = amountToWei(BN.from(100), 6);

      await bootstrapMarket(env, alice, amount);

      let { xytBalance, tokenBalance } = await env.marketReader.getMarketReserves(
        consts.MARKET_FACTORY_AAVE,
        env.xyt.address,
        env.testToken.address
      );
      expect(xytBalance).to.be.equal(amount);
      expect(tokenBalance).to.be.equal(amount);
    });

    it("should be able to getMarketRateExactOut", async () => {
      const amount = amountToWei(BN.from(100), 6);

      await bootstrapMarket(env, alice, amount);

      let result = await env.marketReader.getMarketRateExactOut(
        env.xyt.address,
        env.testToken.address,
        amountToWei(BN.from(10), 6),
        consts.MARKET_FACTORY_AAVE
      );

      approxBigNumber(result[1], 11111205, 1000);
    });

    it("should be able to getMarketRateExactIn", async () => {
      const amount = amountToWei(BN.from(100), 6);

      await bootstrapMarket(env, alice, amount);

      let result = await env.marketReader.getMarketRateExactIn(
        env.testToken.address,
        env.xyt.address,
        amountToWei(BN.from(10), 6),
        consts.MARKET_FACTORY_AAVE
      );

      approxBigNumber(result[1], 9090839, 1000);
    });

    it("should be able to add market liquidity for a token_sample", async () => {
      const amount = amountToWei(BN.from(10), 6);

      await bootstrapMarket(env, alice, amount);
      await env.testToken.approve(env.stdMarket.address, consts.INF);

      let initialLpTokenBal = await env.stdMarket.balanceOf(alice.address);
      let initialXytBal = await env.xyt.balanceOf(alice.address);
      let initialTestTokenBal = await env.testToken.balanceOf(alice.address);

      let totalSupply = await env.stdMarket.totalSupply();
      await env.router.addMarketLiquiditySingle(
        consts.MARKET_FACTORY_AAVE,
        env.xyt.address,
        env.testToken.address,
        false,
        amount.div(10),
        totalSupply.div(21),
        consts.HIGH_GAS_OVERRIDE
      );

      let currentLpTokenBal = await env.stdMarket.balanceOf(alice.address);
      let currentXytBal = await env.xyt.balanceOf(alice.address);
      let currentTestTokenBal = await env.testToken.balanceOf(alice.address);

      expect(currentLpTokenBal).to.be.gt(initialLpTokenBal);
      expect(currentTestTokenBal).to.be.lt(initialTestTokenBal);
      expect(currentXytBal).to.be.equal(initialXytBal);
    });

    it("should be able to add XYT market liquidity_sample", async () => {
      const amount = amountToWei(BN.from(10), 6);

      await bootstrapMarket(env, alice, amount);
      await env.testToken.approve(env.stdMarket.address, consts.INF);

      let initialLpTokenBal = await env.stdMarket.balanceOf(alice.address);
      let initialXytBal = await env.xyt.balanceOf(alice.address);
      let initialTestTokenBal = await env.testToken.balanceOf(alice.address);

      let totalSupply = await env.stdMarket.totalSupply();
      await env.router.addMarketLiquiditySingle(
        consts.MARKET_FACTORY_AAVE,
        env.xyt.address,
        env.testToken.address,
        true,
        amount.div(10),
        totalSupply.div(21),
        consts.HIGH_GAS_OVERRIDE
      );

      let currentLpTokenBal = await env.stdMarket.balanceOf(alice.address);
      let currentXytBal = await env.xyt.balanceOf(alice.address);
      let currentTestTokenBal = await env.testToken.balanceOf(alice.address);

      expect(currentLpTokenBal).to.be.gt(initialLpTokenBal);
      expect(currentTestTokenBal).to.be.equal(initialTestTokenBal);
      expect(currentXytBal).to.be.lt(initialXytBal);
    });

    it("should be able to getMarketTokenAddresses", async () => {
      let {
        token: receivedToken,
        xyt: receivedXyt,
      } = await env.marketReader.getMarketTokenAddresses(env.stdMarket.address);
      expect(receivedToken).to.be.equal(env.testToken.address);
      expect(receivedXyt).to.be.equal(env.xyt.address);
    });

    it("shouldn't be able to create duplicated markets", async () => {
      await expect(
        env.router.createMarket(
          consts.MARKET_FACTORY_AAVE,
          env.xyt.address,
          env.testToken.address,
          consts.HIGH_GAS_OVERRIDE
        )
      ).to.be.revertedWith("EXISTED_MARKET");
    });

    it("should be able to swapPathExactIn", async () => {
      const amount = amountToWei(BN.from(100), 6);

      await bootstrapMarket(env, alice, amount);
      await bootstrapMarketEth(amount);

      await env.router.swapPathExactIn(
        [
          [
            {
              market: env.stdMarket.address,
              tokenIn: env.testToken.address,
              tokenOut: env.xyt.address,
              swapAmount: amount,
              limitReturnAmount: BN.from(0),
            },
            {
              market: env.ethMarket.address,
              tokenIn: env.xyt.address,
              tokenOut: WETH.address,
              swapAmount: BN.from(0),
              limitReturnAmount: BN.from(0),
            },
          ],
        ],
        env.testToken.address,
        WETH.address,
        amount,
        BN.from(0),
        consts.HIGH_GAS_OVERRIDE
      );

      let tokenBalance1: BN = await env.testToken.balanceOf(alice.address);
      let wethBalance1: BN = await WETH.balanceOf(alice.address);

      await evm_revert(snapshotId);
      snapshotId = await evm_snapshot();

      await bootstrapMarket(env, alice, amount);
      await bootstrapMarketEth(amount);

      let initialXytBalance: BN = await env.xyt.balanceOf(alice.address);
      await env.router.swapExactIn(
        env.testToken.address,
        env.xyt.address,
        amount,
        BN.from(0),
        consts.MARKET_FACTORY_AAVE,
        consts.HIGH_GAS_OVERRIDE
      );
      let postXytBalance: BN = await env.xyt.balanceOf(alice.address);
      await env.router.swapExactIn(
        env.xyt.address,
        WETH.address,
        postXytBalance.sub(initialXytBalance),
        BN.from(0),
        consts.MARKET_FACTORY_AAVE,
        consts.HIGH_GAS_OVERRIDE
      );

      let tokenBalance2: BN = await env.testToken.balanceOf(alice.address);
      let wethBalance2: BN = await WETH.balanceOf(alice.address);

      approxBigNumber(tokenBalance2, tokenBalance1, consts.TEST_TOKEN_DELTA);
      approxBigNumber(wethBalance2, wethBalance1, consts.TEST_TOKEN_DELTA);
    });

    it("should be able to swapPathExactOut", async () => {
      const amount = amountToWei(BN.from(100), 6);
      const swapAmount = amount.div(BN.from(10));

      await bootstrapMarket(env, alice, amount);
      await bootstrapMarketEth(amount);

      await env.router.swapPathExactOut(
        [
          [
            {
              market: env.stdMarket.address,
              tokenIn: env.testToken.address,
              tokenOut: env.xyt.address,
              swapAmount: BN.from(0),
              limitReturnAmount: consts.INF, // TODO: change to some reasonable amount?
            },
            {
              market: env.ethMarket.address,
              tokenIn: env.xyt.address,
              tokenOut: WETH.address,
              swapAmount: swapAmount,
              limitReturnAmount: consts.INF,
            },
          ],
        ],
        env.testToken.address,
        WETH.address,
        consts.INF,
        consts.HIGH_GAS_OVERRIDE
      );

      let tokenBalance1: BN = await env.testToken.balanceOf(alice.address);
      let wethBalance1: BN = await WETH.balanceOf(alice.address);

      await evm_revert(snapshotId);
      snapshotId = await evm_snapshot();

      await bootstrapMarket(env, alice, amount);
      await bootstrapMarketEth(amount);

      let initialXytBalance: BN = await env.xyt.balanceOf(alice.address);

      await env.router.swapExactOut(
        env.xyt.address,
        WETH.address,
        swapAmount,
        consts.INF,
        consts.MARKET_FACTORY_AAVE,
        consts.HIGH_GAS_OVERRIDE
      );
      let postXytBalance: BN = await env.xyt.balanceOf(alice.address);
      await env.router.swapExactOut(
        env.testToken.address,
        env.xyt.address,
        initialXytBalance.sub(postXytBalance),
        consts.INF,
        consts.MARKET_FACTORY_AAVE,
        consts.HIGH_GAS_OVERRIDE
      );

      let tokenBalance2: BN = await env.testToken.balanceOf(alice.address);
      let wethBalance2: BN = await WETH.balanceOf(alice.address);

      approxBigNumber(tokenBalance2, tokenBalance1, consts.TEST_TOKEN_DELTA);
      approxBigNumber(wethBalance2, wethBalance1, consts.TEST_TOKEN_DELTA);
    });

    it("shouldn't be able to swapPathExactIn with invalid params", async () => {
      const amount = amountToWei(BN.from(100), 6);

      await bootstrapMarket(env, alice, amount);
      await bootstrapMarketEth(amount);

      await expect(
        env.router.swapPathExactIn(
          [
            [
              {
                market: env.stdMarket.address,
                tokenIn: env.testToken.address,
                tokenOut: env.xyt.address,
                swapAmount: amount,
                limitReturnAmount: BN.from(0),
              },
              {
                market: env.ethMarket.address,
                tokenIn: env.xyt.address,
                tokenOut: WETH.address,
                swapAmount: BN.from(0),
                limitReturnAmount: BN.from(0),
              },
            ],
          ],
          env.testToken.address,
          WETH.address,
          amount.mul(2),
          BN.from(0),
          consts.HIGH_GAS_OVERRIDE
        )
      ).to.be.revertedWith(errMsg.INVALID_AMOUNTS);
    });

    it("shouldn't be able to create market with XYT as quote pair", async () => {
      await expect(
        env.router.createMarket(
          consts.MARKET_FACTORY_AAVE,
          env.xyt.address,
          env.xyt2.address,
          consts.HIGH_GAS_OVERRIDE
        )
      ).to.be.revertedWith("XYT_QUOTE_PAIR_FORBIDDEN");
    });

    it("Aave-ETH should be able to bootstrap", async () => {
      const amount = amountToWei(BN.from(100), 6);
      await bootstrapMarketEth(amount);
    });

    it("Aave-ETH should be able to join a bootstrapped market with a single standard token_sample", async () => {
      const amount = amountToWei(BN.from(100), 6);

      await bootstrapMarketEth(amount);

      let totalSupply = await env.ethMarket.totalSupply();
      let initialWalletBalance = await env.ethMarket.balanceOf(alice.address);
      await env.router.addMarketLiquiditySingle(
        consts.MARKET_FACTORY_AAVE,
        env.xyt.address,
        consts.ETH_ADDRESS,
        false,
        amount.div(10),
        totalSupply.div(21),
        wrapEth(consts.HIGH_GAS_OVERRIDE, amount.div(10))
      );
      let currentWalletBalance = await env.ethMarket.balanceOf(alice.address);
      expect(currentWalletBalance).to.be.gt(initialWalletBalance);
    });

    it("Aave-ETH should be able to join a bootstrapped pool by dual tokens_sample", async () => {
      const amount = amountToWei(BN.from(10), 6);

      await bootstrapMarketEth(amount);

      const totalSupply = await env.ethMarket.totalSupply();

      await env.router
        .connect(bob)
        .addMarketLiquidityDual(
          consts.MARKET_FACTORY_AAVE,
          env.xyt.address,
          consts.ETH_ADDRESS,
          amount,
          amount,
          BN.from(0),
          BN.from(0),
          wrapEth(consts.HIGH_GAS_OVERRIDE, amount)
        );

      let xytBalance = await env.xyt.balanceOf(env.ethMarket.address);
      let ethBalance = await WETH.balanceOf(env.ethMarket.address);
      let totalSupplyBalance = await env.ethMarket.totalSupply();

      expect(xytBalance).to.be.equal(amount.mul(2));
      expect(ethBalance).to.be.equal(amount.mul(2));
      expect(totalSupplyBalance).to.be.equal(totalSupply.mul(2));
    });

    it("Aave-ETH should be able to swap amount out_sample", async () => {
      const amount = amountToWei(BN.from(100), 6);

      await bootstrapMarketEth(amount);

      let xytBalanceBefore = await env.xyt.balanceOf(env.ethMarket.address);

      let result = await env.marketReader.getMarketRateExactOut(
        env.xyt.address,
        WETH.address,
        amountToWei(BN.from(10), 6),
        consts.MARKET_FACTORY_AAVE
      );

      await env.router
        .connect(bob)
        .swapExactOut(
          env.xyt.address,
          consts.ETH_ADDRESS,
          amountToWei(BN.from(10), 6),
          amountToWei(BN.from(100), 6),
          consts.MARKET_FACTORY_AAVE,
          consts.HIGH_GAS_OVERRIDE
        );

      let xytBalance = await env.xyt.balanceOf(env.ethMarket.address);
      let ethBalance = await WETH.balanceOf(env.ethMarket.address);

      expect(xytBalance.toNumber()).to.be.approximately(
        xytBalanceBefore.add(BN.from(result[1])).toNumber(),
        20
      );
      expect(ethBalance).to.be.equal(amount.sub(amount.div(10)));
    });

    it("Aave-ETH should be able to swap amount in_sample", async () => {
      const amount = amountToWei(BN.from(100), 6);

      await bootstrapMarketEth(amount);

      await env.router
        .connect(bob)
        .swapExactIn(
          env.xyt.address,
          consts.ETH_ADDRESS,
          amountToWei(BN.from(10), 6),
          BN.from(0),
          consts.MARKET_FACTORY_AAVE,
          consts.HIGH_GAS_OVERRIDE
        );

      let xytBalance = await env.xyt.balanceOf(env.ethMarket.address);
      let ethBalance = await WETH.balanceOf(env.ethMarket.address);

      expect(xytBalance.toNumber()).to.be.approximately(
        amount.add(amount.div(10)).toNumber(),
        30
      );

      expect(ethBalance.toNumber()).to.be.approximately(
        amount.sub(amount.div(10)).toNumber(),
        amount.div(100).toNumber()
      );
    });

    it("Aave-ETH should be able to exit a pool by dual tokens_sample", async () => {
      const amount = amountToWei(BN.from(100), 6);
      await bootstrapMarketEth(amount);
      await advanceTime(consts.ONE_MONTH);
      const totalSupply = await env.ethMarket.totalSupply();

      await env.router.removeMarketLiquidityDual(
        consts.MARKET_FACTORY_AAVE,
        env.xyt.address,
        consts.ETH_ADDRESS,
        totalSupply.div(10),
        BN.from(0),
        BN.from(0),
        consts.HIGH_GAS_OVERRIDE
      );

      let xytBalance = await env.xyt.balanceOf(env.ethMarket.address);
      let testTokenBalance = await WETH.balanceOf(env.ethMarket.address);

      expect(xytBalance).to.be.equal(amount.sub(amount.div(10)));
      expect(testTokenBalance).to.be.equal(amount.sub(amount.div(10)));
    });

    it("Aave-ETH should be able to join a bootstrapped pool by dual tokens with exact token in_sample", async () => {
      const amount = amountToWei(BN.from(10), 6);

      await bootstrapMarketEth(amount);

      const totalSupply = await env.ethMarket.totalSupply();

      await env.router.connect(bob).addMarketLiquidityDual(
        consts.MARKET_FACTORY_AAVE,
        env.xyt.address,
        consts.ETH_ADDRESS,
        amount.add(BN.from(100000)), // _desiredXytAmount
        amount, // _desiredTokenAmount
        amount, // _xytMinAmount
        amount, //_tokenMinAmount
        wrapEth(consts.HIGH_GAS_OVERRIDE, amount)
      );

      let xytBalance = await env.xyt.balanceOf(env.ethMarket.address);
      let ethBalance = await WETH.balanceOf(env.ethMarket.address);
      let totalSupplyBalance = await env.ethMarket.totalSupply();

      expect(xytBalance).to.be.equal(amount.mul(2));
      expect(ethBalance).to.be.equal(amount.mul(2));
      expect(totalSupplyBalance).to.be.equal(totalSupply.mul(2));

      await env.router.connect(bob).addMarketLiquidityDual(
        consts.MARKET_FACTORY_AAVE,
        env.xyt.address,
        consts.ETH_ADDRESS,
        amount, // _desiredXytAmount
        amount.add(BN.from(100000)), // _desiredTokenAmount
        amount, // _xytMinAmount
        amount, //_tokenMinAmount
        wrapEth(consts.HIGH_GAS_OVERRIDE, amount)
      );
      let xytBalance2 = await env.xyt.balanceOf(env.ethMarket.address);
      let ethBalance2 = await WETH.balanceOf(env.ethMarket.address);
      let totalSupplyBalance2 = await env.ethMarket.totalSupply();

      expect(xytBalance2).to.be.equal(amount.mul(3));
      expect(ethBalance2).to.be.equal(amount.mul(3));
      expect(totalSupplyBalance2).to.be.equal(totalSupply.mul(3));
    });

    it("Aave-ETH should be able to getReserves", async () => {
      const amount = amountToWei(BN.from(100), 6);

      await bootstrapMarketEth(amount);

      let { xytBalance, tokenBalance } = await env.ethMarket.getReserves();
      expect(xytBalance).to.be.equal(amount);
      expect(tokenBalance).to.be.equal(amount);
    });

    it("Aave-ETH should be able to getMarketReserve", async () => {
      const amount = amountToWei(BN.from(100), 6);

      await bootstrapMarketEth(amount);

      let [xytBalance, tokenBalance] = await env.marketReader.getMarketReserves(
        consts.MARKET_FACTORY_AAVE,
        env.xyt.address,
        WETH.address
      );
      expect(xytBalance).to.be.equal(amount);
      expect(tokenBalance).to.be.equal(amount);
    });

    it("Aave-ETH should be able to getMarketRateExactOut", async () => {
      const amount = amountToWei(BN.from(100), 6);

      await bootstrapMarketEth(amount);

      let result = await env.marketReader.getMarketRateExactOut(
        env.xyt.address,
        WETH.address,
        amountToWei(BN.from(10), 6),
        consts.MARKET_FACTORY_AAVE
      );

      expect(result[1].toNumber()).to.be.approximately(11111111, 200);
    });

    it("Aave-ETH should be able to getMarketRateExactIn", async () => {
      const amount = amountToWei(BN.from(100), 6);

      await bootstrapMarketEth(amount);

      let result = await env.marketReader.getMarketRateExactIn(
        WETH.address,
        env.xyt.address,
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

      await bootstrapMarketEth(amount);

      let initialLpTokenBal = await env.ethMarket.balanceOf(alice.address);
      let initialXytBal = await env.xyt.balanceOf(alice.address);
      let initialTokenBal = await provider.getBalance(alice.address);

      let totalSupply = await env.ethMarket.totalSupply();
      await env.router.addMarketLiquiditySingle(
        consts.MARKET_FACTORY_AAVE,
        env.xyt.address,
        consts.ETH_ADDRESS,
        false,
        amount.div(10),
        totalSupply.div(21),
        wrapEth(consts.HIGH_GAS_OVERRIDE, amount.div(10))
      );

      let currentLpTokenBal = await env.ethMarket.balanceOf(alice.address);
      let currentXytBal = await env.xyt.balanceOf(alice.address);
      let currentTokenBal = await provider.getBalance(alice.address);

      expect(currentLpTokenBal).to.be.gt(initialLpTokenBal);
      expect(currentTokenBal).to.be.lt(initialTokenBal);
      expect(currentXytBal).to.be.equal(initialXytBal);
    });

    it("Aave-ETH should be able to add XYT market liquidity_sample", async () => {
      const amount = amountToWei(BN.from(10), 6);

      await bootstrapMarketEth(amount);

      let initialLpTokenBal = await env.ethMarket.balanceOf(alice.address);
      let initialXytBal = await env.xyt.balanceOf(alice.address);
      let initialTokenBal = await WETH.balanceOf(alice.address);

      let totalSupply = await env.ethMarket.totalSupply();
      await env.router.addMarketLiquiditySingle(
        consts.MARKET_FACTORY_AAVE,
        env.xyt.address,
        consts.ETH_ADDRESS,
        true,
        amount.div(10),
        totalSupply.div(21),
        consts.HIGH_GAS_OVERRIDE
      );

      let currentLpTokenBal = await env.ethMarket.balanceOf(alice.address);
      let currentXytBal = await env.xyt.balanceOf(alice.address);
      let currentTokenBal = await WETH.balanceOf(alice.address);

      expect(currentLpTokenBal).to.be.gt(initialLpTokenBal);
      expect(currentTokenBal).to.be.equal(initialTokenBal);
      expect(currentXytBal).to.be.lt(initialXytBal);
    });

    it("AMM's formulas should be correct for swapExactIn", async () => {
      await AMMTest(
        env,
        true
      );
    });
    it("AMM's formulas should be correct for swapExactOut", async () => {
      await AMMTest(
        env,
        false
      );
    });
  });
}