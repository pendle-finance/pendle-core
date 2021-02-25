import { expect } from "chai";
import { createFixtureLoader } from "ethereum-waffle";
import { BigNumber as BN, Contract } from "ethers";
import ERC20 from "../../build/artifacts/@openzeppelin/contracts/token/ERC20/ERC20.sol/ERC20.json";
import {
  advanceTime,
  amountToWei,
  consts,
  evm_revert,
  evm_snapshot,
  getAContract,
  Token,
  tokens,
} from "../helpers";
import { AMMTest } from "./AmmFormula";
import { pendleMarketFixture } from "./fixtures";

const { waffle } = require("hardhat");
const { deployContract, provider } = waffle;

describe("PendleMarketEth", async () => {
  const wallets = provider.getWallets();
  const loadFixture = createFixtureLoader(wallets, provider);
  const [alice, bob] = wallets;
  let pendleRouter: Contract;
  let pendleXyt: Contract;
  let pendleXyt2: Contract;
  let lendingPoolCore: Contract;
  let pendleAaveForge: Contract;
  let pendleEthMarket: Contract;
  let aUSDT: Contract;
  let snapshotId: string;
  let globalSnapshotId: string;
  let tokenUSDT: Token;
  let WETH: Contract;

  before(async () => {
    globalSnapshotId = await evm_snapshot();

    const fixture = await loadFixture(pendleMarketFixture);
    pendleRouter = fixture.core.pendleRouter;
    pendleXyt = fixture.aForge.pendleAFutureYieldToken;
    pendleXyt2 = fixture.aForge.pendleAFutureYieldToken2;
    pendleAaveForge = fixture.aForge.pendleAaveForge;
    lendingPoolCore = fixture.aave.lendingPoolCore;
    pendleEthMarket = fixture.pendleEthMarket;
    WETH = new Contract(tokens.WETH.address, ERC20.abi, alice);
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
  });

  function wrapEth(object: any, weiAmount: BN): any {
    const cloneObj = JSON.parse(JSON.stringify(object));
    cloneObj.value = weiAmount;
    return cloneObj;
  }

  async function bootstrapSampleMarket(amountToTokenize: BN) {
    await pendleRouter.bootstrapMarket(
      consts.MARKET_FACTORY_AAVE,
      pendleXyt.address,
      consts.ETH_ADDRESS,
      amountToTokenize,
      amountToTokenize,
      wrapEth(consts.HIGH_GAS_OVERRIDE, amountToTokenize)
    );
  }

  it("should be able to bootstrap", async () => {
    const amountToTokenize = amountToWei(tokenUSDT, BN.from(100));
    await bootstrapSampleMarket(amountToTokenize);
  });

  it("should be able to join a bootstrapped market with a single standard token_sample", async () => {
    const amountToTokenize = amountToWei(tokenUSDT, BN.from(100));

    await bootstrapSampleMarket(amountToTokenize);

    let totalSupply = await pendleEthMarket.totalSupply();
    let initalWalletBalance = await pendleEthMarket.balanceOf(alice.address);
    await pendleRouter.addMarketLiquiditySingle(
      consts.MARKET_FACTORY_AAVE,
      pendleXyt.address,
      consts.ETH_ADDRESS,
      false,
      amountToTokenize.div(10),
      totalSupply.div(21),
      wrapEth(consts.HIGH_GAS_OVERRIDE, amountToTokenize.div(10))
    );
    let currentWalletBalance = await pendleEthMarket.balanceOf(alice.address);
    expect(currentWalletBalance).to.be.gt(initalWalletBalance);
  });

  it("should be able to join a bootstrapped pool by dual tokens_sample", async () => {
    const amountToTokenize = amountToWei(tokenUSDT, BN.from(10));

    await bootstrapSampleMarket(amountToTokenize);

    const totalSupply = await pendleEthMarket.totalSupply();

    await pendleRouter
      .connect(bob)
      .addMarketLiquidityAll(
        consts.MARKET_FACTORY_AAVE,
        pendleXyt.address,
        consts.ETH_ADDRESS,
        amountToTokenize,
        amountToTokenize,
        totalSupply,
        wrapEth(consts.HIGH_GAS_OVERRIDE, amountToTokenize)
      );

    let yieldTokenBalance = await pendleXyt.balanceOf(pendleEthMarket.address);
    let ethBalance = await WETH.balanceOf(pendleEthMarket.address);
    let totalSupplyBalance = await pendleEthMarket.totalSupply();

    expect(yieldTokenBalance).to.be.equal(amountToTokenize.mul(2));
    expect(ethBalance).to.be.equal(amountToTokenize.mul(2));
    expect(totalSupplyBalance).to.be.equal(totalSupply.mul(2));
  });

  it("should be able to swap amount out_sample", async () => {
    const amountToTokenize = amountToWei(tokenUSDT, BN.from(100));

    await bootstrapSampleMarket(amountToTokenize);

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
    expect(ethBalance).to.be.equal(
      amountToTokenize.sub(amountToTokenize.div(10))
    );
  });

  it("should be able to swap amount in_sample", async () => {
    const amountToTokenize = amountToWei(tokenUSDT, BN.from(100));

    await bootstrapSampleMarket(amountToTokenize);

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
      amountToTokenize.add(amountToTokenize.div(10)).toNumber(),
      30
    );

    expect(ethBalance.toNumber()).to.be.approximately(
      amountToTokenize.sub(amountToTokenize.div(10)).toNumber(),
      amountToTokenize.div(100).toNumber()
    );
  });

  it("should be able to get spot price", async () => {
    const amountToTokenize = amountToWei(tokenUSDT, BN.from(100));

    await bootstrapSampleMarket(amountToTokenize);

    let spotPrice = await pendleEthMarket.spotPrice(
      WETH.address,
      pendleXyt.address
    );

    expect(spotPrice.toNumber()).to.be.approximately(
      1000000000000,
      100000000000
    );
  });

  it("should be able to exit a pool by dual tokens_sample", async () => {
    const amountToTokenize = amountToWei(tokenUSDT, BN.from(100));
    await bootstrapSampleMarket(amountToTokenize);
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

    expect(yieldTokenBalance).to.be.equal(
      amountToTokenize.sub(amountToTokenize.div(10))
    );
    expect(testTokenBalance).to.be.equal(
      amountToTokenize.sub(amountToTokenize.div(10))
    );
  });

  it("should be able to getReserves", async () => {
    const amountToTokenize = amountToWei(tokenUSDT, BN.from(100));

    await bootstrapSampleMarket(amountToTokenize);

    let [xytReserve, tokenReserve] = await pendleEthMarket.getReserves();
    expect(xytReserve).to.be.equal(amountToTokenize);
    expect(tokenReserve).to.be.equal(amountToTokenize);
  });

  it("should be able to getMarketReserve", async () => {
    const amountToTokenize = amountToWei(tokenUSDT, BN.from(100));

    await bootstrapSampleMarket(amountToTokenize);

    let [
      xytReserve,
      tokenReserve,
      currentTime,
    ] = await pendleRouter.getMarketReserves(
      consts.MARKET_FACTORY_AAVE,
      pendleXyt.address,
      WETH.address
    );
    expect(xytReserve).to.be.equal(amountToTokenize);
    expect(tokenReserve).to.be.equal(amountToTokenize);
  });

  it("should be able to getMarketRateExactOut", async () => {
    const amountToTokenize = amountToWei(tokenUSDT, BN.from(100));

    await bootstrapSampleMarket(amountToTokenize);

    let result = await pendleRouter.getMarketRateExactOut(
      pendleXyt.address,
      WETH.address,
      amountToWei(tokenUSDT, BN.from(10)),
      consts.MARKET_FACTORY_AAVE
    );

    expect(result[1].toNumber()).to.be.approximately(11111111, 100);
  });

  it("should be able to getMarketRateExactIn", async () => {
    const amountToTokenize = amountToWei(tokenUSDT, BN.from(100));

    await bootstrapSampleMarket(amountToTokenize);

    let result = await pendleRouter.getMarketRateExactIn(
      WETH.address,
      pendleXyt.address,
      amountToWei(tokenUSDT, BN.from(10)),
      consts.MARKET_FACTORY_AAVE
    );

    expect(result[1].toNumber()).to.be.approximately(9090909, 100);
  });

  it("should be able to add market liquidity for a token_sample", async () => {
    const amountToTokenize = amountToWei(tokenUSDT, BN.from(10));

    await bootstrapSampleMarket(amountToTokenize);

    let initalLpTokenBal = await pendleEthMarket.balanceOf(alice.address);
    let initalXytBal = await pendleXyt.balanceOf(alice.address);
    let initalTokenBal = await provider.getBalance(alice.address);

    let totalSupply = await pendleEthMarket.totalSupply();
    await pendleRouter.addMarketLiquiditySingle(
      consts.MARKET_FACTORY_AAVE,
      pendleXyt.address,
      consts.ETH_ADDRESS,
      false,
      amountToTokenize.div(10),
      totalSupply.div(21),
      wrapEth(consts.HIGH_GAS_OVERRIDE, amountToTokenize.div(10))
    );

    let currentLpTokenBal = await pendleEthMarket.balanceOf(alice.address);
    let currentXytBal = await pendleXyt.balanceOf(alice.address);
    let currentTokenBal = await provider.getBalance(alice.address);

    expect(currentLpTokenBal).to.be.gt(initalLpTokenBal);
    expect(currentTokenBal).to.be.lt(initalTokenBal);
    expect(currentXytBal).to.be.equal(initalXytBal);
  });

  it("should be able to add XYT market liquidity_sample", async () => {
    const amountToTokenize = amountToWei(tokenUSDT, BN.from(10));

    await bootstrapSampleMarket(amountToTokenize);

    let initalLpTokenBal = await pendleEthMarket.balanceOf(alice.address);
    let initalXytBal = await pendleXyt.balanceOf(alice.address);
    let initalTokenBal = await WETH.balanceOf(alice.address);

    let totalSupply = await pendleEthMarket.totalSupply();
    await pendleRouter.addMarketLiquiditySingle(
      consts.MARKET_FACTORY_AAVE,
      pendleXyt.address,
      consts.ETH_ADDRESS,
      true,
      amountToTokenize.div(10),
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
});
