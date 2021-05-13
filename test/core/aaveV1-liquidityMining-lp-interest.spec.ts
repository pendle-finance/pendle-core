import { createFixtureLoader } from "ethereum-waffle";
import { BigNumber as BN } from "ethers";
import {
  emptyToken,
  setTimeNextBlock,
  evm_revert,
  evm_snapshot,
  redeemDueInterests,
  stake,
  withdraw,
  consts,
  approxBigNumber,
  randomBN,
  randomNumber,
  redeemLpInterests,
} from "../helpers";
import {
  liquidityMiningFixture,
  LiquidityMiningFixture,
  Mode,
  parseTestEnvLiquidityMiningFixture,
  TestEnv,
} from "./fixtures";

const { waffle } = require("hardhat");
const { provider } = waffle;

describe("aaveV1-liquidityMining-lp-interest", async () => {
  const wallets = provider.getWallets();
  const loadFixture = createFixtureLoader(wallets, provider);
  const [alice, bob, charlie, dave, eve] = wallets;
  let snapshotId: string;
  let globalSnapshotId: string;
  let env: TestEnv = {} as TestEnv;

  async function buildTestEnv() {
    let fixture: LiquidityMiningFixture = await loadFixture(
      liquidityMiningFixture
    );
    await parseTestEnvLiquidityMiningFixture(alice, Mode.AAVE_V1, env, fixture);
    env.TEST_DELTA = BN.from(200);
  }

  before(async () => {
    globalSnapshotId = await evm_snapshot();
    await buildTestEnv();

    await env.data.setInterestUpdateRateDeltaForMarket(BN.from(0));
    for (let user of [bob, charlie, dave]) {
      await redeemDueInterests(env, user);
      await emptyToken(env.aUSDT, user);
      await emptyToken(env.xyt, user);
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

  it("test 1", async () => {
    await env.xyt.transfer(
      eve.address,
      (await env.xyt.balanceOf(env.market.address)).div(10)
    );

    let totalTime = consts.SIX_MONTH;
    let numTurnsBeforeExpiry = 40;
    let numTurnsAfterExpiry = 10;
    let numTurns = numTurnsBeforeExpiry + numTurnsAfterExpiry;

    let liqBalance: BN[] = [BN.from(0), BN.from(0), BN.from(0), BN.from(0)];
    let lpBalance: BN[] = [];
    for (let i = 0; i < 4; i++)
      lpBalance.push(await env.market.balanceOf(wallets[i].address));

    for (let i = 1; i <= numTurns; i++) {
      await setTimeNextBlock(
        env.liqParams.START_TIME.add(totalTime.div(numTurnsBeforeExpiry).mul(i))
      );
      let userID = randomBN(4).toNumber();
      let actionType: number = randomNumber(3);
      if (liqBalance[userID].eq(0)) {
        actionType = 0;
      }

      if (actionType == 0) {
        let amount = randomBN(lpBalance[userID]);
        await stake(env, wallets[userID], amount);
        liqBalance[userID] = liqBalance[userID].add(amount);
        lpBalance[userID] = lpBalance[userID].sub(amount);
      } else if (actionType == 1) {
        let amount = randomBN(liqBalance[userID]);
        await withdraw(env, wallets[userID], amount);
        liqBalance[userID] = liqBalance[userID].sub(amount);
        lpBalance[userID] = lpBalance[userID].add(amount);
      } else if (actionType == 2) {
        await env.liq.redeemLpInterests(env.EXPIRY, wallets[userID].address);
      }
    }

    await redeemDueInterests(env, eve);
    let expectedGain: BN = await env.aUSDT.balanceOf(eve.address);
    for (let i = 1; i < 4; i++) {
      await env.liq.redeemLpInterests(env.EXPIRY, wallets[i].address);
      await redeemLpInterests(env, wallets[i]);
    }
    for (let i = 1; i < 4; i++) {
      approxBigNumber(
        await env.aUSDT.balanceOf(wallets[i].address),
        expectedGain,
        env.TEST_DELTA
      );
      approxBigNumber(
        await env.market.balanceOf(wallets[i].address),
        lpBalance[i],
        0
      );
    }
  });
});
