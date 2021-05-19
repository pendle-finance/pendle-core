import { assert, expect } from "chai";
import { createFixtureLoader } from "ethereum-waffle";
import { BigNumber as BN, Contract, Wallet } from "ethers";
import PendleRedeemProxy from "../../build/artifacts/contracts/proxies/PendleRedeemProxy.sol/PendleRedeemProxy.json";
import {
  advanceTime,
  amountToWei,
  approxBigNumber,
  consts,
  emptyToken,
  errMsg,
  evm_revert,
  evm_snapshot,
  getAContract,
  setTime,
  setTimeNextBlock,
  startOfEpoch,
  tokens,
} from "../helpers";
import { liqParams, liquidityMiningFixture, UserStakeAction } from "./fixtures";
import * as scenario from "./fixtures/liquidityMiningScenario.fixture";

const { waffle } = require("hardhat");
const hre = require("hardhat");
const { provider, deployContract } = waffle;

describe("Redeem Proxy", async () => {
  const wallets = provider.getWallets();
  const loadFixture = createFixtureLoader(wallets, provider);
  const [alice, bob, charlie, dave, eve] = wallets;
  let liq: Contract;
  let liqWeb3: any;
  let router: Contract;
  let market: Contract;
  let ethMarket: Contract;
  let xyt: Contract;
  let xyt2: Contract;
  let baseToken: Contract;
  let pdl: Contract;
  let params: liqParams;
  let aUSDT: Contract;
  let snapshotId: string;
  let globalSnapshotId: string;
  let EXPIRY: BN = consts.T0.add(consts.SIX_MONTH);
  let redeemProxy: Contract;
  before(async () => {
    globalSnapshotId = await evm_snapshot();
    const fixture = await loadFixture(liquidityMiningFixture);
    liq = fixture.aLiquidityMining;
    liqWeb3 = fixture.aLiquidityMiningWeb3;
    router = fixture.core.router;
    baseToken = fixture.testToken;
    market = fixture.aMarket;
    // ethMarket = fixture.ethMarket;
    xyt = fixture.aForge.aFutureYieldToken;
    xyt2 = fixture.aForge.aFutureYieldToken2;
    params = fixture.params;
    pdl = fixture.pdl;
    aUSDT = await getAContract(alice, fixture.aForge.aaveForge, tokens.USDT);
    redeemProxy = await deployContract(alice, PendleRedeemProxy, [
      router.address,
    ]);
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

  it("should be able to redeem using redeemProxy", async () => {
    await setTimeNextBlock(provider, params.START_TIME.add(100));
    const aliceBalance = await market.balanceOf(alice.address);
    console.log(`alice LP Balance  = ${aliceBalance}`);

    await setTimeNextBlock(provider, params.START_TIME.add(consts.ONE_MONTH));


    await liq.stake(EXPIRY, aliceBalance.div(2), consts.HIGH_GAS_OVERRIDE);
    await setTimeNextBlock(provider, params.START_TIME.add(consts.THREE_MONTH));
    await alice.sendTransaction({to: bob.address, value: 1});

    console.log(`alice pending lpInterest = ${await router.callStatic.redeemLpInterests(market.address, alice.address)}`);
    console.log(`alice xyt balance  = ${await xyt.balanceOf(alice.address)}`);
    console.log(`alice pending xyt interest  = ${await router.callStatic.redeemDueInterests(
      consts.FORGE_AAVE,
      tokens.USDT.address,
      EXPIRY,
      alice.address
    )}`);

    // print out results
    const redeemProxyWeb3 = new hre.web3.eth.Contract(
      PendleRedeemProxy.abi,
      redeemProxy.address
    );
    const results = await redeemProxyWeb3.methods.redeem(
      [xyt.address, xyt2.address],
      [market.address],
      [liq.address, liq.address],
      [EXPIRY, EXPIRY],
      1
    ).call();
    console.log(JSON.stringify(results, null, "  "));



    console.log(`aUSDT before = ${await aUSDT.balanceOf(alice.address)}`);
    await redeemProxy.redeem(
      [xyt.address, xyt2.address],
      [market.address],
      [liq.address, liq.address],
      [EXPIRY, EXPIRY],
      1,
      consts.HIGH_GAS_OVERRIDE
    );
    console.log(`aUSDT after = ${await aUSDT.balanceOf(alice.address)}`);
  });
});
