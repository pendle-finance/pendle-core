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
  toFixedPoint,
} from "../helpers";
import { AMMTest, MarketFeesTest, ProtocolFeeTest } from "./amm-formula-test";
import { marketFixture } from "./fixtures";

const { waffle } = require("hardhat");
const { provider } = waffle;

describe("aaveV1-market", async () => {
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
  let data: Contract;

  before(async () => {
    globalSnapshotId = await evm_snapshot();

    const fixture = await loadFixture(marketFixture);
    router = fixture.core.router;
    data = fixture.core.data;
    marketReader = fixture.core.marketReader;
    xyt = fixture.aForge.aFutureYieldToken;
    xyt2 = fixture.aForge.aFutureYieldToken2;
    testToken = fixture.testToken;
    stdMarket = fixture.aMarket;
    ethMarket = fixture.ethMarket;
    tokenUSDT = tokens.USDT;
    WETH = new Contract(tokens.WETH.address, ERC20.abi, alice);
    await data.setMarketFees(toFixedPoint("0.0035"), toFixedPoint("0.0"), toFixedPoint("0.2"), consts.HIGH_GAS_OVERRIDE);
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

  async function addLiquidityDual(amount: BN) {
    return;
    await router.addMarketLiquidityDual(
      consts.MARKET_FACTORY_AAVE,
      xyt.address,
      testToken.address,
      amount, 
      amount,
      BN.from(1),
      BN.from(1),
      consts.HIGH_GAS_OVERRIDE
    );
  }

  /*
  READ ME!!!
  All tests with "_sample" suffix are legacy tests. It's improved version is in other test files
    Tests for adding/removing liquidity can be found in pendleLpFormula.spec.ts
    Tests for swapping tokens can be found in amm-formula-test.ts
  */

  xit("AMM's formula should be correct for swapExactOut", async () => {
    await MarketFeesTest(
      router,
      stdMarket,
      tokenUSDT,
      testToken,
      xyt,
      bootstrapSampleMarket,
      true
    );
  });

 it("AMM's protocol fee to treasury should be correct", async() => {
    await ProtocolFeeTest(
      router,
      stdMarket,
      tokenUSDT,
      testToken,
      xyt,
      bootstrapSampleMarket,
      true,
      (await data.treasury()),
      bob,
      alice,
      addLiquidityDual
    );
  });
});
