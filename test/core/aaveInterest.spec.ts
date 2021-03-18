import { expect } from "chai";
import { createFixtureLoader } from "ethereum-waffle";
import { BigNumber as BN, Contract, Wallet } from "ethers";
import {
  amountToWei,
  approxBigNumber,
  getA2Contract,
  consts,
  evm_revert,
  evm_snapshot,
  mintAaveToken,
  setTimeNextBlock,
  Token,
  tokens,
  errMsg,
  advanceTime,
} from "../helpers";
import testData from "./fixtures/yieldTokenizeAndRedeem.scenario.json";
import { pendleFixture } from "./fixtures";

const { waffle } = require("hardhat");
const provider = waffle.provider;

interface YieldTest {
  type: string;
  user: number;
  amount: number;
  timeDelta: number;
}

describe("aaveInterest test", async () => {
  const wallets = provider.getWallets();
  const loadFixture = createFixtureLoader(wallets, provider);
  const [alice, bob, charlie, dave] = wallets;

  let router: Contract;
  let aOt: Contract;
  let aaveForge: Contract;
  let aUSDT: Contract;
  let snapshotId: string;
  let globalSnapshotId: string;
  let tokenUSDT: Token;

  before(async () => {
    globalSnapshotId = await evm_snapshot();

    const fixture = await loadFixture(pendleFixture);
    router = fixture.core.router;
    aOt = fixture.aForge.aOwnershipToken;
    aaveForge = fixture.aForge.aaveForge;
    tokenUSDT = tokens.USDT;
    aUSDT = await getA2Contract(alice, aaveForge, tokenUSDT);

    await mintAaveToken(
      provider,
      tokens.USDT,
      bob,
      consts.INITIAL_AAVE_TOKEN_AMOUNT
    );
    await mintAaveToken(
      provider,
      tokens.USDT,
      charlie,
      consts.INITIAL_AAVE_TOKEN_AMOUNT
    );
    await mintAaveToken(
      provider,
      tokens.USDT,
      dave,
      consts.INITIAL_AAVE_TOKEN_AMOUNT
    );
    await aUSDT.connect(bob).approve(router.address, consts.MAX_ALLOWANCE);
    await aUSDT.connect(charlie).approve(router.address, consts.MAX_ALLOWANCE);

    snapshotId = await evm_snapshot();
  });

  after(async () => {
    await evm_revert(globalSnapshotId);
  });

  beforeEach(async () => {
    await evm_revert(snapshotId);
    snapshotId = await evm_snapshot();
  });

  async function redeemDueInterests(user: Wallet) {
    await router
      .connect(user)
      .redeemDueInterests(
        consts.FORGE_AAVE,
        tokenUSDT.address,
        consts.T0.add(consts.SIX_MONTH)
      );
  }

  async function redeemUnderlying(user: Wallet, amount: BN) {
    await router
      .connect(user)
      .redeemUnderlying(
        consts.FORGE_AAVE,
        tokenUSDT.address,
        consts.T0.add(consts.SIX_MONTH),
        amount,
        user.address,
        consts.HIGH_GAS_OVERRIDE
      );
  }

  async function tokenizeYield(user: Wallet, amount: BN) {
    await router
      .connect(user)
      .tokenizeYield(
        consts.FORGE_AAVE,
        tokenUSDT.address,
        consts.T0.add(consts.SIX_MONTH),
        amount,
        user.address,
        consts.HIGH_GAS_OVERRIDE
      );
  }

  async function runTest(yieldTest: YieldTest[]) {
    let curTime = consts.T0;
    for (let id = 0; id < yieldTest.length; id++) {
      let curTest = yieldTest[id];
      let user = wallets[curTest.user];
      // console.log(curTest);
      curTime = curTime.add(BN.from(curTest.timeDelta));
      await setTimeNextBlock(provider, curTime);
      if (curTest.type == "redeemDueInterests") {
        await redeemDueInterests(user);
      } else if (curTest.type == "redeemUnderlying") {
        await redeemUnderlying(user, BN.from(curTest.amount));
      } else if (curTest.type == "tokenizeYield") {
        await tokenizeYield(user, BN.from(curTest.amount));
      } else if (curTest.type == "redeemUnderlyingAll") {
        let balance = await aOt.balanceOf(user.address);
        await redeemUnderlying(user, balance);
      }
    }
    const expectedBalance = await aUSDT.balanceOf(dave.address);
    approxBigNumber(
      await aUSDT.balanceOf(alice.address),
      expectedBalance,
      BN.from(3000)
    );
    approxBigNumber(
      await aUSDT.balanceOf(bob.address),
      expectedBalance,
      BN.from(3000)
    );
    approxBigNumber(
      await aUSDT.balanceOf(charlie.address),
      expectedBalance,
      BN.from(3000)
    );
  }
  it("test 1", async () => {
    await runTest((<any>testData).test1);
  });
  it("test 2", async () => {
    await runTest((<any>testData).test2);
  });
  xit("stress 1 [only enable when necessary]", async () => {
    await runTest((<any>testData).stress1);
  });
  xit("stress 2 [only enable when necessary]", async () => {
    await runTest((<any>testData).stress2);
  });
});
