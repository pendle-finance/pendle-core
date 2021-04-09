import { createFixtureLoader } from "ethereum-waffle";
import { BigNumber as BN, Contract, Wallet } from "ethers";
import ICToken from "../../build/artifacts/contracts/interfaces/ICToken.sol/ICToken.json";
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
  mintCompoundToken,
} from "../helpers";
import { marketFixture } from "./fixtures";
const hre = require("hardhat");

const { waffle } = require("hardhat");
const { provider } = waffle;

describe("lpInterest for CompoundMarket", async () => {
  const wallets = provider.getWallets();
  const loadFixture = createFixtureLoader(wallets, provider);
  const [alice, bob, charlie, dave, eve] = wallets;
  let router: Contract;
  let xyt: Contract;
  let ot: Contract;
  let stdMarket: Contract;
  let testToken: Contract;
  let snapshotId: string;
  let globalSnapshotId: string;
  let aaveForge: Contract;
  let aaveV2Forge: Contract;
  let cUSDT: Contract;
  let cUSDTWeb3: any;
  let tokenUSDT: Token;
  const amountUSDTRef = BN.from(10).pow(8);
  let amountXytRef: any;

  before(async () => {
    globalSnapshotId = await evm_snapshot();

    const fixture = await loadFixture(marketFixture);
    router = fixture.core.router;
    ot = fixture.cForge.cOwnershipToken;
    xyt = fixture.cForge.cFutureYieldToken;
    testToken = fixture.testToken;
    stdMarket = fixture.cMarket;
    tokenUSDT = tokens.USDT;
    aaveForge = fixture.aForge.aaveForge;
    aaveV2Forge = fixture.a2Forge.aaveV2Forge;
    cUSDT = await getCContract(alice, tokenUSDT);
    cUSDTWeb3 = new hre.web3.eth.Contract(ICToken.abi, cUSDT.address);

    for (let user of [alice, bob, charlie, dave, eve]) {
      await emptyToken(ot, user);
      await emptyToken(xyt, user);
      await emptyToken(cUSDT, user);
    }

    for (let user of [alice, bob, charlie, dave]) {
      await mintOtAndXytUSDT(user, amountUSDTRef.div(10 ** 6));
    }
    amountXytRef = await xyt.balanceOf(alice.address);
    console.log(`\tamountXytRef = ${amountXytRef}`);
    //Note: bob, charlie and dave will not have exactly the same amount of cXYTs

    console.log(`\t[BeforeAll] cUSDT Balance of all users: `);
    for (let user of [alice, bob, charlie, dave]) {
      console.log((await cUSDT.balanceOf(user.address)).toString());
    }
    console.log(`\t[BeforeAll] USDT-equivalent balance of all users: `);
    for (let user of [alice, bob, charlie, dave]) {
      console.log(
        (
          await cUSDTWeb3.methods.balanceOfUnderlying(user.address).call()
        ).toString()
      );
    }
    console.log(`\t[BeforeAll] XYT Balance of all users: `);
    for (let user of [alice, bob, charlie, dave]) {
      console.log((await xyt.balanceOf(user.address)).toString());
    }

    for (let user of [alice, bob, charlie, dave, eve]) {
      await emptyToken(cUSDT, user);
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
        consts.MAX_ALLOWANCE,
        amountXyt,
        BN.from(0),
        consts.HIGH_GAS_OVERRIDE
      );
    // console.log("added:", ((await xyt.balanceOf(stdMarket.address)).sub(amountXytMarket)).toString());
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
    await router.removeMarketLiquidityDual(
      consts.MARKET_FACTORY_COMPOUND,
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
    await router.removeMarketLiquiditySingle(
      consts.MARKET_FACTORY_COMPOUND,
      xyt.address,
      testToken.address,
      false,
      amount,
      BN.from(0),
      consts.HIGH_GAS_OVERRIDE
    );
  }

  async function mintOtAndXytUSDT(user: Wallet, amount: BN) {
    await mintOtAndXyt(
      provider,
      tokenUSDT,
      user,
      amount,
      router,
      aaveForge,
      aaveV2Forge
    );
  }

  async function swapExactInTokenToXyt(user: Wallet, inAmount: BN) {
    await router
      .connect(user)
      .swapExactIn(
        testToken.address,
        xyt.address,
        inAmount,
        BN.from(0),
        consts.MAX_ALLOWANCE,
        consts.MARKET_FACTORY_COMPOUND,
        consts.HIGH_GAS_OVERRIDE
      );
  }

  async function swapExactInXytToToken(user: Wallet, inAmount: BN) {
    await router
      .connect(user)
      .swapExactIn(
        xyt.address,
        testToken.address,
        inAmount,
        BN.from(0),
        consts.MAX_ALLOWANCE,
        consts.MARKET_FACTORY_COMPOUND,
        consts.HIGH_GAS_OVERRIDE
      );
  }

  async function addFakeXyt(user: Wallet, amount: BN) {
    await xyt.connect(user).transfer(stdMarket.address, amount);
  }

  async function addFakeIncome(token: Token, user: Wallet, amount: BN) {
    await mint(provider, token, user, amount);
    let USDTcontract = await getERC20Contract(user, token);
    USDTcontract.connect(user).transfer(
      cUSDT.address,
      amountToWei(amount, token.decimal)
    );
    await cUSDT.balanceOfUnderlying(user.address); // interact with compound so that it updates all info
    // await mintCompoundToken(provider, token, user, BN.from(1000));
  }

  async function getLPBalance(user: Wallet) {
    return await stdMarket.balanceOf(user.address);
  }

  it("test 0", async () => {
    await mintOtAndXytUSDT(eve, BN.from(10).pow(5));

    await bootstrapSampleMarket(BN.from(10).pow(10));
    console.log(`\t[Before] cUSDT Balance of all users: `);
    for (let user of [alice, bob, charlie, dave]) {
      console.log((await cUSDT.balanceOf(user.address)).toString());
    }
    console.log(`\t[Before] XYT Balance of all users: `);
    for (let user of [alice, bob, charlie, dave]) {
      console.log((await xyt.balanceOf(user.address)).toString());
    }

    await advanceTime(provider, consts.FIFTEEN_DAY);
    await addFakeIncome(tokenUSDT, eve, consts.INITIAL_COMPOUND_TOKEN_AMOUNT);
    console.log("\n\t============== Bob addding liq");
    await addMarketLiquidityDualByXyt(bob, amountXytRef.div(10));

    await advanceTime(provider, consts.FIFTEEN_DAY);
    await addFakeIncome(tokenUSDT, eve, consts.INITIAL_COMPOUND_TOKEN_AMOUNT);
    console.log("\n\t============== Charlie addding liq");
    await addMarketLiquidityDualByXyt(charlie, amountXytRef.div(5));

    await advanceTime(provider, consts.FIFTEEN_DAY);
    await addFakeIncome(tokenUSDT, eve, consts.INITIAL_COMPOUND_TOKEN_AMOUNT);
    console.log("\n\t============== Dave addding liq");
    await addMarketLiquidityDualByXyt(dave, amountXytRef.div(2));

    await advanceTime(provider, consts.FIFTEEN_DAY);
    await addFakeIncome(tokenUSDT, eve, consts.INITIAL_COMPOUND_TOKEN_AMOUNT);
    console.log("\n\t============== Dave addding liq");
    await addMarketLiquidityDualByXyt(dave, amountXytRef.div(3));
    console.log("\n\t============== Bob addding liq");
    await addMarketLiquidityDualByXyt(bob, amountXytRef.div(6));

    await advanceTime(provider, consts.FIFTEEN_DAY);
    await addFakeIncome(tokenUSDT, eve, consts.INITIAL_COMPOUND_TOKEN_AMOUNT);
    await addMarketLiquidityDualByXyt(charlie, amountXytRef.div(3));
    await addMarketLiquidityDualByXyt(charlie, amountXytRef.div(3));

    await advanceTime(provider, consts.FIFTEEN_DAY);
    await addFakeIncome(tokenUSDT, eve, consts.INITIAL_COMPOUND_TOKEN_AMOUNT);
    await addMarketLiquidityDualByXyt(bob, amountXytRef.div(2));

    await advanceTime(provider, consts.FIFTEEN_DAY);
    await addFakeIncome(tokenUSDT, eve, consts.INITIAL_COMPOUND_TOKEN_AMOUNT);
    await addMarketLiquidityDualByXyt(bob, amountXytRef.div(5));

    console.log(
      "\n\t============== Users are claiming LP interests and redeemDueInterests"
    );

    for (let user of [alice, bob, charlie, dave]) {
      await router
        .connect(user)
        .claimLpInterests([stdMarket.address], consts.HIGH_GAS_OVERRIDE);
      console.log("\n\t======= redeemingDueInterests");
      // console.log(`isValidXYT? forgeId=${consts.FORGE_COMPOUND}, underlyingAsset=${tokenUSDT.address}`)
      await router
        .connect(user)
        .redeemDueInterests(
          consts.FORGE_COMPOUND,
          tokenUSDT.address,
          consts.T0_C.add(consts.SIX_MONTH),
          consts.HIGH_GAS_OVERRIDE
        );
    }

    const aliceCUSDTBalance = await cUSDT.balanceOf(alice.address);
    const acceptedDelta = BN.from(1200000);
    console.log(`\t[After] cUSDT Balance of all users: `);
    for (let user of [bob, charlie, dave]) {
      const USDTBalance = await cUSDT.balanceOf(user.address);
      approxBigNumber(USDTBalance, aliceCUSDTBalance, acceptedDelta);
      console.log(USDTBalance.toString());
    }
    console.log(`\t[After] USDT-equivalent balance of all users: `);
    for (let user of [alice, bob, charlie, dave]) {
      console.log(
        (
          await cUSDTWeb3.methods.balanceOfUnderlying(user.address).call()
        ).toString()
      );
    }
    console.log(`\t[After] XYT Balance of all users: `);
    for (let user of [alice, bob, charlie, dave]) {
      console.log((await xyt.balanceOf(user.address)).toString());
    }
    console.log(
      `\tMarket cToken balance at the end: ${await cUSDT.balanceOf(
        stdMarket.address
      )}`
    );
  });

  it("test 0", async () => {
    await mintOtAndXytUSDT(eve, BN.from(10).pow(5));

    await bootstrapSampleMarket(BN.from(10).pow(10));
    console.log(`\t[Before] cUSDT Balance of all users: `);
    for (let user of [alice, bob, charlie, dave]) {
      console.log((await cUSDT.balanceOf(user.address)).toString());
    }
    console.log(`\t[Before] XYT Balance of all users: `);
    for (let user of [alice, bob, charlie, dave]) {
      console.log((await xyt.balanceOf(user.address)).toString());
    }

    await advanceTime(provider, consts.FIFTEEN_DAY);
    await addFakeIncome(tokenUSDT, eve, consts.INITIAL_COMPOUND_TOKEN_AMOUNT);
    console.log("\n\t============== Bob addding liq");
    await addMarketLiquidityDualByXyt(bob, amountXytRef.div(5));

    await advanceTime(provider, consts.FIFTEEN_DAY);
    await addFakeIncome(tokenUSDT, eve, consts.INITIAL_COMPOUND_TOKEN_AMOUNT);
    console.log("\n\t============== Charlie addding liq");
    await addMarketLiquidityDualByXyt(charlie, amountXytRef.div(2));

    await advanceTime(provider, consts.FIFTEEN_DAY);
    await addFakeIncome(tokenUSDT, eve, consts.INITIAL_COMPOUND_TOKEN_AMOUNT);
    console.log("\n\t============== Dave addding liq");
    await addMarketLiquidityDualByXyt(dave, amountXytRef.div(3));

    await advanceTime(provider, consts.FIFTEEN_DAY);
    await addFakeIncome(tokenUSDT, eve, consts.INITIAL_COMPOUND_TOKEN_AMOUNT);
    console.log("\n\t============== Dave addding liq");
    await addMarketLiquidityDualByXyt(dave, amountXytRef.div(3));
    console.log("\n\t============== Bob addding liq");
    await addMarketLiquidityDualByXyt(bob, amountXytRef.div(5));

    await advanceTime(provider, consts.FIFTEEN_DAY);
    await addFakeIncome(tokenUSDT, eve, consts.INITIAL_COMPOUND_TOKEN_AMOUNT);
    await addMarketLiquidityDualByXyt(charlie, amountXytRef.div(6));
    await addMarketLiquidityDualByXyt(charlie, amountXytRef.div(6));

    await advanceTime(provider, consts.FIFTEEN_DAY);
    await addFakeIncome(tokenUSDT, eve, consts.INITIAL_COMPOUND_TOKEN_AMOUNT);
    await addMarketLiquidityDualByXyt(bob, amountXytRef.div(2));

    await advanceTime(provider, consts.FIFTEEN_DAY);
    await addFakeIncome(tokenUSDT, eve, consts.INITIAL_COMPOUND_TOKEN_AMOUNT);

    console.log(
      "\n\t============== Users are claiming LP interests and redeemDueInterests"
    );

    for (let user of [alice, bob, charlie, dave]) {
      await router
        .connect(user)
        .claimLpInterests([stdMarket.address], consts.HIGH_GAS_OVERRIDE);
      console.log("\n\t======= redeemingDueInterests");
      // console.log(`isValidXYT? forgeId=${consts.FORGE_COMPOUND}, underlyingAsset=${tokenUSDT.address}`)
      await router
        .connect(user)
        .redeemDueInterests(
          consts.FORGE_COMPOUND,
          tokenUSDT.address,
          consts.T0_C.add(consts.SIX_MONTH),
          consts.HIGH_GAS_OVERRIDE
        );
    }

    const aliceCUSDTBalance = await cUSDT.balanceOf(alice.address);
    const acceptedDelta = BN.from(1200000);
    console.log(`\t[After] cUSDT Balance of all users: `);
    for (let user of [bob, charlie, dave]) {
      const USDTBalance = await cUSDT.balanceOf(user.address);
      approxBigNumber(USDTBalance, aliceCUSDTBalance, acceptedDelta);
      console.log(USDTBalance.toString());
    }
    console.log(`\t[After] USDT-equivalent balance of all users: `);
    for (let user of [alice, bob, charlie, dave]) {
      console.log(
        (
          await cUSDTWeb3.methods.balanceOfUnderlying(user.address).call()
        ).toString()
      );
    }
    console.log(`\t[After] XYT Balance of all users: `);
    for (let user of [alice, bob, charlie, dave]) {
      console.log((await xyt.balanceOf(user.address)).toString());
    }
    console.log(
      `\tMarket cToken balance at the end: ${await cUSDT.balanceOf(
        stdMarket.address
      )}`
    );
  });
});
