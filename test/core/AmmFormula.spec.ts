import { assert } from "chai";
import { createFixtureLoader } from "ethereum-waffle";
import { BigNumber, Contract } from "ethers";
import {
  amountToWei,
  approxBigNumber,
  consts,
  evm_revert,
  evm_snapshot,
  getAContract,
  setTimeNextBlock, toFixedPoint, toFPWei,
  Token,
  tokens
} from "../helpers";
import { pendleMarketFixture } from "./fixtures";

const { waffle } = require("hardhat");
const { deployContract, provider } = waffle;

describe("AMM Formula", async () => {
  const wallets = provider.getWallets();
  const loadFixture = createFixtureLoader(wallets, provider);
  const [wallet, wallet1] = wallets;
  let pendle: Contract;
  let pendleTreasury: Contract;
  let pendleAaveMarketFactory: Contract;
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
    pendle = fixture.core.pendle;
    pendleTreasury = fixture.core.pendleTreasury;
    pendleAaveMarketFactory = fixture.core.pendleAaveMarketFactory;
    pendleData = fixture.core.pendleData;
    pendleOwnershipToken = fixture.forge.pendleOwnershipToken;
    pendleXyt = fixture.forge.pendleFutureYieldToken;
    pendleAaveForge = fixture.forge.pendleAaveForge;
    lendingPoolCore = fixture.aave.lendingPoolCore;
    testToken = fixture.testToken;
    pendleMarket = fixture.pendleMarket;
    tokenUSDT = tokens.USDT;
    aUSDT = await getAContract(wallet, lendingPoolCore, tokenUSDT);
    snapshotId = await evm_snapshot();
  });

  after(async () => {
    await evm_revert(globalSnapshotId);
  });

  beforeEach(async () => {
    await evm_revert(snapshotId);
    snapshotId = await evm_snapshot();

    const amountToTokenize = amountToWei(tokenUSDT, toFixedPoint(1000));
    await bootstrapSampleMarket(amountToTokenize);
    await testToken.approve(pendleMarket.address, consts.MAX_ALLOWANCE);
  });

  async function bootstrapSampleMarket(
    amountToTokenize: BigNumber,
    lowLevelCall: boolean = false
  ) {
    if (lowLevelCall == true) {
      await pendleMarket.bootstrap(
        wallet.address,
        amountToTokenize,
        amountToTokenize,
        consts.HIGH_GAS_OVERRIDE
      );
    } else {
      await pendle.bootStrapMarket(
        consts.FORGE_AAVE,
        consts.MARKET_FACTORY_AAVE,
        pendleXyt.address,
        testToken.address,
        amountToTokenize,
        amountToTokenize,
        consts.HIGH_GAS_OVERRIDE
      );
    }
  }

  async function swapTokenToXyt(amount: BigNumber) {
    await pendle.swapTokenToXyt(
      consts.FORGE_AAVE,
      consts.MARKET_FACTORY_AAVE,
      pendleXyt.address,
      testToken.address,
      amount,
      BigNumber.from(0),
      consts.MAX_ALLOWANCE
    );
  }

  async function swapXytToToken(amount: BigNumber) {
    await pendle.swapXytToToken(
      consts.FORGE_AAVE,
      consts.MARKET_FACTORY_AAVE,
      pendleXyt.address,
      testToken.address,
      amount,
      BigNumber.from(0),
      consts.MAX_ALLOWANCE
    );
  }

  async function runTestTokenToXyt(
    time: BigNumber,
    tokenIn: string,
    xytOut: string
  ) {
    var { xytReserves: initialXytReserves, tokenReserves: initialTokenReserves } = await pendleMarket.getReserves();

    await setTimeNextBlock(provider, time);
    await swapTokenToXyt(toFPWei(tokenIn));
    var { xytReserves, tokenReserves } = await pendleMarket.getReserves();

    var actualXytOut = initialXytReserves.sub(xytReserves);
    var actualTokenIn = tokenReserves.sub(initialTokenReserves);

    assert(approxBigNumber(toFPWei(tokenIn), actualTokenIn, consts.AMM_DELTA));
    assert(approxBigNumber(toFPWei(xytOut), actualXytOut, consts.AMM_DELTA));
  }

  async function runTestXytToToken(
    time: BigNumber,
    xytIn: string,
    tokenOut: string
  ) {
    var { xytReserves: initialXytReserves, tokenReserves: initialTokenReserves } = await pendleMarket.getReserves();

    await setTimeNextBlock(provider, time);
    await swapXytToToken(toFPWei(xytIn));
    var { xytReserves, tokenReserves } = await pendleMarket.getReserves();

    var actualXytIn = xytReserves.sub(initialXytReserves);
    var actualTokenOut = initialTokenReserves.sub(tokenReserves);

    assert(approxBigNumber(toFPWei(tokenOut), actualTokenOut, consts.AMM_DELTA));
    assert(approxBigNumber(toFPWei(xytIn), actualXytIn, consts.AMM_DELTA));
  }

  it("Test 1", async () => {
    await runTestTokenToXyt(consts.T0.add(3600), "20.4056154640437012529487593", "20");
    await runTestXytToToken(consts.T0.add(3660), "120", "111.303781468187238009565391");
    await runTestTokenToXyt(consts.T0.add(43200), "300", "273.280448649430121754778355");
    await runTestXytToToken(consts.T0.add(43210), "74.65525897473777272314011", "100");
    await runTestXytToToken(consts.T0.add(2592030), "100", "100.71634012485444436225310");
    await runTestXytToToken(consts.T0.add(14515300), "200", "24.266823488747670122258785");
    await runTestTokenToXyt(consts.T0.add(14861000), "26.338047049500061035209868", "300");
    await runTestXytToToken(consts.T0.add(15120300), "400", "21.59504665672333789302071");
    await runTestTokenToXyt(consts.T0.add(15120360), "3.69683925359824726534054", "80");
    await runTestXytToToken(consts.T0.add(15551400), "800", "0.04263564745466537519981");
  });
});
