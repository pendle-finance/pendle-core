import { expect } from "chai";
import { createFixtureLoader } from "ethereum-waffle";
import { BigNumber as BN, Contract, Wallet } from "ethers";
import {
  amountToWei,
  approxBigNumber,
  consts,
  evm_revert,
  evm_snapshot,
  getAContract,
  mintAaveToken,
  setTimeNextBlock,
  Token,
  tokens,
  errMsg,
  getA2Contract
} from "../helpers";
import testData from "./fixtures/yieldTokenizeAndRedeem.scenario.json";
import { pendleFixture, PendleFixture } from "./fixtures";

const { waffle } = require("hardhat");
const provider = waffle.provider;

interface YieldTest {
  type: string;
  user: number;
  amount: number;
  timeDelta: number;
}

interface TestEnv {
  T0: BN,
  FORGE_ID: string,
  INITIAL_AAVE_TOKEN_AMOUNT: BN,
  TEST_DELTA: BN
}

export function runTest(isAaveV1: boolean) {
  describe("", async () => {
    const wallets = provider.getWallets();
    const loadFixture = createFixtureLoader(wallets, provider);
    const [alice, bob, charlie, dave] = wallets;

    let fixture: PendleFixture;
    let router: Contract;
    let aOt: Contract;
    let aaveForge: Contract;
    let aUSDT: Contract;
    let snapshotId: string;
    let globalSnapshotId: string;
    let tokenUSDT: Token;
    let testEnv: TestEnv = {} as TestEnv;

    async function buildCommonTestEnv() {
      fixture = await loadFixture(pendleFixture);
      router = fixture.core.router;
      testEnv.INITIAL_AAVE_TOKEN_AMOUNT = consts.INITIAL_AAVE_TOKEN_AMOUNT;
    }

    async function buildTestEnvV1() {
      aOt = fixture.aForge.aOwnershipToken;
      aaveForge = fixture.aForge.aaveForge;
      tokenUSDT = tokens.USDT;
      aUSDT = await getAContract(alice, aaveForge, tokenUSDT);
      testEnv.FORGE_ID = consts.FORGE_AAVE;
      testEnv.T0 = consts.T0;
    }

    async function buildTestEnvV2() {
      aOt = fixture.a2Forge.a2OwnershipToken;
      aaveForge = fixture.a2Forge.aaveV2Forge;
      tokenUSDT = tokens.USDT;
      aUSDT = await getA2Contract(alice, aaveForge, tokenUSDT);
      testEnv.FORGE_ID = consts.FORGE_AAVE_V2;
      testEnv.T0 = consts.T0_A2;
    }

    before(async () => {
      globalSnapshotId = await evm_snapshot();
      await buildCommonTestEnv();
      if (isAaveV1) {
        await buildTestEnvV1();
      } else {
        await buildTestEnvV2();
      }
      await mintAaveToken(
        provider,
        tokens.USDT,
        bob,
        testEnv.INITIAL_AAVE_TOKEN_AMOUNT,
        isAaveV1
      );
      await mintAaveToken(
        provider,
        tokens.USDT,
        charlie,
        testEnv.INITIAL_AAVE_TOKEN_AMOUNT,
        isAaveV1
      );
      await mintAaveToken(
        provider,
        tokens.USDT,
        dave,
        testEnv.INITIAL_AAVE_TOKEN_AMOUNT,
        isAaveV1
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
          testEnv.FORGE_ID,
          tokenUSDT.address,
          testEnv.T0.add(consts.SIX_MONTH),
          consts.HIGH_GAS_OVERRIDE
        );
    }

    async function redeemUnderlying(user: Wallet, amount: BN) {
      await router
        .connect(user)
        .redeemUnderlying(
          testEnv.FORGE_ID,
          tokenUSDT.address,
          testEnv.T0.add(consts.SIX_MONTH),
          amount,
          user.address,
          consts.HIGH_GAS_OVERRIDE
        );
    }

    async function tokenizeYield(user: Wallet, amount: BN) {
      await router
        .connect(user)
        .tokenizeYield(
          testEnv.FORGE_ID,
          tokenUSDT.address,
          testEnv.T0.add(consts.SIX_MONTH),
          amount,
          user.address,
          consts.HIGH_GAS_OVERRIDE
        );
    }

    async function runTest(yieldTest: YieldTest[]) {
      let curTime = testEnv.T0;
      for (let id = 0; id < yieldTest.length; id++) {
        let curTest = yieldTest[id];
        let user = wallets[curTest.user];
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
}
