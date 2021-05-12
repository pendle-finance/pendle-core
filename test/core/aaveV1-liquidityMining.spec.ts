import { assert, expect } from "chai";
import { createFixtureLoader } from "ethereum-waffle";
import { BigNumber as BN, Contract, Wallet } from "ethers";
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
  calcExpectedRewards,
  tokens,
} from "../helpers";
import { liqParams, liquidityMiningFixture, UserStakeAction } from "./fixtures";
import * as scenario from "./fixtures/liquidityMiningScenario.fixture";

const { waffle } = require("hardhat");
const { provider } = waffle;

describe("aaveV1-liquidityMining", async () => {
  const wallets = provider.getWallets();
  const loadFixture = createFixtureLoader(wallets, provider);
  const [alice, bob, charlie, dave, eve] = wallets;
  let liq: Contract;
  let router: Contract;
  let market: Contract;
  let xyt: Contract;
  let baseToken: Contract;
  let pdl: Contract;
  let params: liqParams;
  let aUSDT: Contract;
  let snapshotId: string;
  let globalSnapshotId: string;
  let EXPIRY: BN = consts.T0.add(consts.SIX_MONTH);
  before(async () => {
    globalSnapshotId = await evm_snapshot();
    const fixture = await loadFixture(liquidityMiningFixture);
    liq = fixture.aLiquidityMining;
    router = fixture.core.router;
    baseToken = fixture.testToken;
    market = fixture.aMarket;
    xyt = fixture.aForge.aFutureYieldToken;
    params = fixture.params;
    pdl = fixture.pdl;
    aUSDT = await getAContract(alice, fixture.aForge.aaveForge, tokens.USDT);

    await fixture.core.data.setInterestUpdateRateDeltaForMarket(BN.from(0));
    for (let user of [bob, charlie, dave]) {
      await router.redeemDueInterests(
        consts.FORGE_AAVE,
        tokens.USDT.address,
        EXPIRY,
        user.address,
        consts.HIGH_GAS_OVERRIDE
      );
      await emptyToken(aUSDT, user);
      await emptyToken(xyt, user);
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

  async function doStake(person: Wallet, amount: BN) {
    await liq.connect(person).stake(EXPIRY, amount, consts.HIGH_GAS_OVERRIDE);
  }

  async function doWithdraw(person: Wallet, amount: BN) {
    await liq
      .connect(person)
      .withdraw(EXPIRY, amount, consts.HIGH_GAS_OVERRIDE);
  }

  async function getLpBalanceOfAllUsers(): Promise<BN[]> {
    let res: BN[] = [];
    for (let i = 0; i < wallets.length; i++) {
      res.push(await market.balanceOf(wallets[i].address));
    }
    return res;
  }

  // [epochs][user][transaction]

  async function doSequence(userStakingData: UserStakeAction[][][]) {
    let flatData: UserStakeAction[] = [];
    let expectedLpBalance: BN[] = await getLpBalanceOfAllUsers();

    userStakingData.forEach((epochData) => {
      epochData.forEach((userData) => {
        userData.forEach((userAction) => {
          if (userAction.id != -1) {
            flatData.push(userAction);
          }
        });
      });
    });

    flatData = flatData.sort((a, b) => {
      return a.time.sub(b.time).toNumber();
    });

    for (let i = 0; i < flatData.length; i++) {
      let action: UserStakeAction = flatData[i];
      if (i != 0) {
        // console.log(flatData[i - 1], flatData[i]);
        assert(flatData[i - 1].time < flatData[i].time);
      }
      await setTimeNextBlock(action.time);
      if (action.isStaking) {
        await doStake(wallets[action.id], action.amount); // access users directly by their id instead of names
        expectedLpBalance[action.id] = expectedLpBalance[action.id].sub(
          action.amount
        );
      } else {
        // withdrawing
        await doWithdraw(wallets[action.id], action.amount);
        expectedLpBalance[action.id] = expectedLpBalance[action.id].add(
          action.amount
        );
      }
    }

    /* check Lp balances*/
    let actualLpBalance: BN[] = await getLpBalanceOfAllUsers();
    expect(
      expectedLpBalance,
      "lp balances don't match expected lp balances"
    ).to.be.eql(actualLpBalance);
  }

  async function checkEqualRewards(
    userStakingData: UserStakeAction[][][],
    epochToCheck: number,
    _allocationRateDiv?: number
  ) {
    let expectedRewards: BN[][] = calcExpectedRewards(
      userStakingData,
      params,
      epochToCheck
    );
    await setTime(startOfEpoch(params, epochToCheck));
    let numUser = expectedRewards.length;
    let allocationRateDiv =
      _allocationRateDiv !== undefined ? _allocationRateDiv : 1;
    for (let userId = 0; userId < numUser; userId++) {
      await liq.redeemRewards(EXPIRY, wallets[userId].address);
      // console.log(expectedRewards[userId][0].toString(), (await pdl.balanceOf(wallets[userId].address)).toString());
      approxBigNumber(
        await pdl.balanceOf(wallets[userId].address),
        expectedRewards[userId][0].div(allocationRateDiv),
        BN.from(100), // 100 is much better than necessary, but usually the differences are 0
        false
      );
    }
  }

  async function checkEqualRewardsForEpochs(
    userStakingData: UserStakeAction[][][],
    epochToCheck: number,
    _allocationRateDiv?: number
  ) {
    for (let i = 0; i < 4; i++) {
      await checkEqualRewards(
        userStakingData,
        epochToCheck + i,
        _allocationRateDiv
      );
    }
  }

  // Bob, Dave and Charlie all starts with 0 AUSDTs and 0 XYTs in their wallet
  // Both Bob and Dave has 10% of LP of the Market
  //  - Charlie will receive XYTs equivalent to 10% of whats in the market, and hold it
  //  - Dave just holds the LP tokens
  //  - Bob stake the LP tokens into liq-mining contract, in two transactions
  //=> after 2 months, all three of them should get the same interests
  it("Staking to LP mining, holding LP tokens & holding equivalent XYTs should get same interests", async () => {
    const INITIAL_LP_AMOUNT: BN = await market.balanceOf(bob.address);
    await setTimeNextBlock(params.START_TIME.add(100));
    const xytBalanceOfMarket = await xyt.balanceOf(market.address);

    // Charlie holds same equivalent amount of XYTs as 10% of the market
    // which is the same as what Bob and Dave holds
    await xyt.transfer(charlie.address, xytBalanceOfMarket.div(10));

    let preBalanceBob = await aUSDT.balanceOf(bob.address);
    let preBalanceDave = await aUSDT.balanceOf(dave.address);
    let preBalanceCharlie = await aUSDT.balanceOf(charlie.address);

    await doStake(alice, INITIAL_LP_AMOUNT); // Alice also stake into liq-mining
    console.log(`\talice staked`);
    await doStake(bob, INITIAL_LP_AMOUNT.div(2));
    await liq.redeemLpInterests(EXPIRY, bob.address);
    console.log(`\tbob staked`);
    await setTimeNextBlock(params.START_TIME.add(consts.ONE_MONTH));
    await doStake(bob, INITIAL_LP_AMOUNT.div(2));
    await liq.redeemLpInterests(EXPIRY, bob.address);
    await router.redeemLpInterests(market.address, bob.address);
    console.log(`\tbob staked round 2`);
    await setTimeNextBlock(params.START_TIME.add(consts.ONE_MONTH.mul(2)));

    await liq.redeemLpInterests(EXPIRY, bob.address);
    console.log(`\tbob claimed interests`);
    let actualGainBob = (await aUSDT.balanceOf(bob.address)).sub(preBalanceBob);

    await router.redeemDueInterests(
      consts.FORGE_AAVE,
      tokens.USDT.address,
      EXPIRY,
      charlie.address
    );
    const actualGainCharlie = (await aUSDT.balanceOf(charlie.address)).sub(
      preBalanceCharlie
    );

    await router.redeemLpInterests(market.address, dave.address);
    let actualGainDave = (await aUSDT.balanceOf(dave.address)).sub(
      preBalanceDave
    );

    // console.log(actualGainCharlie.toString(), actualGainDave.toString());
    approxBigNumber(actualGainBob, actualGainDave, consts.TEST_TOKEN_DELTA);
    approxBigNumber(actualGainCharlie, actualGainDave, consts.TEST_TOKEN_DELTA);
  });

  it("should be able to receive enough PENDLE rewards - test 2", async () => {
    let userStakingData: UserStakeAction[][][] = scenario.scenario04(params);
    await doSequence(userStakingData);
    await checkEqualRewardsForEpochs(
      userStakingData,
      userStakingData.length + 1
    );
  });

  it("should be able to receive enough PENDLE rewards - test 3", async () => {
    await liq.setAllocationSetting(
      [EXPIRY, consts.T0.add(consts.THREE_MONTH)],
      [params.TOTAL_NUMERATOR.div(2), params.TOTAL_NUMERATOR.div(2)],
      consts.HIGH_GAS_OVERRIDE
    );
    let userStakingData: UserStakeAction[][][] = scenario.scenario04(params);
    await doSequence(userStakingData);
    await checkEqualRewardsForEpochs(
      userStakingData,
      userStakingData.length + 1,
      2
    );
  });

  it("should be able to receive enough PENDLE rewards - test 4", async () => {
    await liq.setAllocationSetting(
      [EXPIRY, consts.T0.add(consts.THREE_MONTH)],
      [params.TOTAL_NUMERATOR.div(2), params.TOTAL_NUMERATOR.div(2)],
      consts.HIGH_GAS_OVERRIDE
    );
    let userStakingData: UserStakeAction[][][] = scenario.scenario06(params);
    await doSequence(userStakingData);
    await checkEqualRewardsForEpochs(
      userStakingData,
      userStakingData.length + 1,
      2
    );
  });

  it("test invalid setAllocationSetting", async () => {
    await expect(
      liq.setAllocationSetting(
        [
          EXPIRY,
          consts.T0.add(consts.THREE_MONTH),
          consts.T0.add(consts.ONE_MONTH),
        ],
        [
          params.TOTAL_NUMERATOR.div(3),
          params.TOTAL_NUMERATOR.div(3),
          params.TOTAL_NUMERATOR.div(3),
        ],
        consts.HIGH_GAS_OVERRIDE
      )
    ).to.be.revertedWith(errMsg.INVALID_ALLOCATION);
  });

  it("this test shouldn't crash", async () => {
    const amountToStake = await market.balanceOf(bob.address);

    await setTimeNextBlock(params.START_TIME);
    await liq
      .connect(bob)
      .stake(EXPIRY, amountToStake, consts.HIGH_GAS_OVERRIDE);

    await setTimeNextBlock(params.START_TIME.add(params.EPOCH_DURATION));
    await liq
      .connect(bob)
      .withdraw(EXPIRY, amountToStake, consts.HIGH_GAS_OVERRIDE);
    await liq.redeemRewards(EXPIRY, bob.address);
    await setTimeNextBlock(
      params.START_TIME.add(params.EPOCH_DURATION).add(params.EPOCH_DURATION)
    );
    await liq.redeemRewards(EXPIRY, bob.address);
  });

  it("can stake and withdraw", async () => {
    const FIFTEEN_DAYS = consts.ONE_DAY.mul(15);

    const amountToStake = await market.balanceOf(bob.address);

    const pdlBalanceOfContract = await pdl.balanceOf(liq.address);
    const pdlBalanceOfUser = await pdl.balanceOf(bob.address);
    const lpBalanceOfUser = await market.balanceOf(bob.address);

    console.log(
      `\tPDL balance of liq contract before: ${pdlBalanceOfContract}`
    );
    console.log(`\tPDL balance of user before: ${pdlBalanceOfUser}`);
    console.log(`\tLP balance of user before: ${lpBalanceOfUser}`);

    await advanceTime(params.START_TIME.sub(consts.T0));
    await liq
      .connect(bob)
      .stake(EXPIRY, amountToStake, consts.HIGH_GAS_OVERRIDE);
    console.log("\tStaked");
    const lpHolderContract = await liq.lpHolderForExpiry(EXPIRY);
    const aTokenBalanceOfLpHolderContract = await aUSDT.balanceOf(
      lpHolderContract
    );
    const aTokenBalanceOfUser = await aUSDT.balanceOf(bob.address);
    console.log(
      `\t[LP interests] aUSDT balance of LpHolder after first staking = ${aTokenBalanceOfLpHolderContract}`
    );
    console.log(
      `\t[LP interests] aUSDT balance of User after first staking = ${aTokenBalanceOfUser}`
    );

    await advanceTime(FIFTEEN_DAYS);
    await liq
      .connect(bob)
      .withdraw(
        EXPIRY,
        amountToStake.div(BN.from(2)),
        consts.HIGH_GAS_OVERRIDE
      );
    await liq.redeemRewards(EXPIRY, bob.address);

    const pdlBalanceOfContractAfter = await pdl.balanceOf(liq.address);
    const pdlBalanceOfUserAfter = await pdl.balanceOf(bob.address);
    const expectedPdlBalanceOfUserAfter = params.REWARDS_PER_EPOCH[0].div(4);
    console.log(
      `\tPDL balance of liq contract after: ${pdlBalanceOfContractAfter}`
    );
    console.log(`\tPDL balance of user after: ${pdlBalanceOfUserAfter}`);
    console.log(
      `\tExpected PDL balance of user after: ${expectedPdlBalanceOfUserAfter}`
    );

    // we need to do this properly
    expect(pdlBalanceOfUserAfter.toNumber()).to.be.approximately(
      expectedPdlBalanceOfUserAfter.toNumber(),
      expectedPdlBalanceOfUserAfter.toNumber() / 1000
    );

    console.log(
      `\t\t\t lpHolderContract aToken bal = ${await aUSDT.balanceOf(
        lpHolderContract
      )}`
    );

    //stake using another user - alice, for the same amount as bob's stake now (amountToStake/2)
    await liq.stake(EXPIRY, amountToStake.div(2), consts.HIGH_GAS_OVERRIDE);

    // Now we wait for another 15 days to withdraw (at the very start of epoch 4), then the rewards to be withdrawn for bob should be:
    // From epoch 1: rewardsForEpoch * 2/4    ( 1/4 is released at start of epoch 3, 1/4 is released at start of epoch 4)
    // From epoch 2: (rewardsForEpoch/2 + rewardsForEpoch/2/2) * 2/4  ( first half: get all the rewards = rewardsForEpoch/2, 2nd half: get half)
    // From epoch 3: rewardsForEpoch/2 * 1/4  ( two stakers with the same stake & duration => each gets rewardsForEpoch/2)
    //  Total: rewardsForEpoch * (1/2 + 3/8 + 1/8) = rewardsForEpoch
    await advanceTime(FIFTEEN_DAYS);

    await liq
      .connect(bob)
      .withdraw(
        EXPIRY,
        amountToStake.div(BN.from(2)),
        consts.HIGH_GAS_OVERRIDE
      );
    await liq.redeemRewards(EXPIRY, bob.address);

    const pdlBalanceOfUserAfter2ndTnx = await pdl.balanceOf(bob.address);
    const expectedPdlBalanceOfUsersAfter2ndTnx = expectedPdlBalanceOfUserAfter.add(
      params.REWARDS_PER_EPOCH[0]
        .div(2)
        .add(params.REWARDS_PER_EPOCH[1].mul(3).div(8))
        .add(params.REWARDS_PER_EPOCH[2].div(8))
    );
    console.log(
      `\tPDL balance of user after 2nd withdraw: ${pdlBalanceOfUserAfter2ndTnx}`
    );
    console.log(
      `\tExpected PDL balance of user after 2nd withdraw: ${expectedPdlBalanceOfUsersAfter2ndTnx}`
    );

    console.log(
      `\t\t\t lpHolderContract aToken bal = ${await aUSDT.balanceOf(
        lpHolderContract
      )}`
    );

    expect(pdlBalanceOfUserAfter2ndTnx.toNumber()).to.be.approximately(
      expectedPdlBalanceOfUsersAfter2ndTnx.toNumber(),
      expectedPdlBalanceOfUsersAfter2ndTnx.toNumber() / 1000
    );

    await liq.withdraw(EXPIRY, amountToStake.div(2), consts.HIGH_GAS_OVERRIDE);
    await liq.redeemRewards(EXPIRY, bob.address);
    const aTokenBalanceOfLpHolderContractAfter = await aUSDT.balanceOf(
      lpHolderContract
    );
    const aTokenBalanceOfUserAfter = await aUSDT.balanceOf(bob.address);

    //now, the LP holding contract should hold almost 0 aUSDT. This means that we have calculated and gave the Lp interests back to the users properly
    console.log(
      `\t[LP interests] aUSDT balance of LpHolder after withdrawing all = ${aTokenBalanceOfLpHolderContractAfter}`
    );
    console.log(
      `\t[LP interests] aUSDT balance of user after withdrawing all = ${aTokenBalanceOfUserAfter}`
    );
  });
});
