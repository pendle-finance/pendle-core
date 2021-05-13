import { assert, expect } from "chai";
import { createFixtureLoader } from "ethereum-waffle";
import { BigNumber as BN, Contract, Wallet } from "ethers";
import {
  advanceTime,
  approxBigNumber,
  calcExpectedRewards,
  consts,
  evm_revert,
  evm_snapshot,
  getCContract,
  setTime,
  setTimeNextBlock,
  startOfEpoch,
  tokens,
} from "../helpers";
import { LiqParams, liquidityMiningFixture, UserStakeAction } from "./fixtures";
import * as scenario from "./fixtures/liquidityMiningScenario.fixture";

const { waffle } = require("hardhat");
const hre = require("hardhat");
const { provider } = waffle;

// TODO:Old version, not as updated as pendleAaveLiquidityMining
describe("compound-liquidityMining", async () => {
  const wallets = provider.getWallets();
  const loadFixture = createFixtureLoader(wallets, provider);
  const [alice, bob, charlie, dave, eve] = wallets;
  let liq: Contract;
  let market: Contract;
  let pdl: Contract;
  let params: LiqParams;
  let cUSDT: Contract;
  let snapshotId: string;
  let globalSnapshotId: string;
  let EXPIRY: BN = consts.T0_C.add(consts.SIX_MONTH);
  before(async () => {
    globalSnapshotId = await evm_snapshot();
    const fixture = await loadFixture(liquidityMiningFixture);
    liq = fixture.cLiquidityMining;
    market = fixture.cMarket;
    params = fixture.params;
    pdl = fixture.pdl;
    cUSDT = await getCContract(alice, tokens.USDT);
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

  async function checkEqualRewardsFourEpochs(
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

  it("test 1", async () => {
    let userStakingData: UserStakeAction[][][] = scenario.scenario01(params);
    await doSequence(userStakingData);
    await checkEqualRewardsFourEpochs(
      userStakingData,
      userStakingData.length + 1
    );
  });

  it("test 4", async () => {
    let userStakingData: UserStakeAction[][][] = scenario.scenario04(params);
    await doSequence(userStakingData);
    await checkEqualRewardsFourEpochs(
      userStakingData,
      userStakingData.length + 1
    );
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

    const amountToStake = await market.balanceOf(bob.address); //1e17 LP = 0.1 LP

    const pdlBalanceOfContract = await pdl.balanceOf(liq.address);
    const pdlBalanceOfUser = await pdl.balanceOf(bob.address);
    const lpBalanceOfUser = await market.balanceOf(bob.address);

    console.log(
      `\tPDL balance of liq contract before: ${pdlBalanceOfContract}`
    );
    console.log(`\tPDL balance of user before: ${pdlBalanceOfUser}`);
    console.log(`\tLP balance of user before: ${lpBalanceOfUser}`);

    await advanceTime(params.START_TIME.sub(consts.T0_C));
    await liq
      .connect(bob)
      .stake(EXPIRY, amountToStake, consts.HIGH_GAS_OVERRIDE);
    console.log("\tStaked");
    const lpHolderContract = await liq.lpHolderForExpiry(EXPIRY);
    const cTokenBalanceOfLpHolderContract = await cUSDT.balanceOf(
      lpHolderContract
    );
    const cTokenBalanceOfUser = await cUSDT.balanceOf(bob.address);
    console.log(
      `\t[LP interests] cUSDT balance of LpHolder after first staking = ${cTokenBalanceOfLpHolderContract}`
    );
    console.log(
      `\t[LP interests] cUSDT balance of User after first staking = ${cTokenBalanceOfUser}`
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

    //stake using another user - alice, for the same amount as bob's stake now (amountToStake/2)
    await liq.stake(EXPIRY, amountToStake.div(2), consts.HIGH_GAS_OVERRIDE);

    // Now we wait for another 15 days to withdraw (at the very start of epoch 4), then the rewards to be withdrawn for bob should be:
    // From epoch 1: rewardsForEpoch[0] * 2/4    ( 1/4 is released at start of epoch 3, 1/4 is released at start of epoch 4)
    // From epoch 2: (rewardsForEpoch[1]/2 + rewardsForEpoch[1]/2/2) * 2/4  ( first half: get all the rewards = rewardsForEpoch/2, 2nd half: get half)
    // From epoch 3: rewardsForEpoch[2]/2 * 1/4  ( two stakers with the same stake & duration => each gets rewardsForEpoch/2)
    //  Total: rewardsForEpoch[0] * 1/2 + rewardsForEpoch[1]*3/8 + rewardsForEpoch[2]*1/8)
    await advanceTime(FIFTEEN_DAYS);

    // console.log(`abi = ${liq.abi}`);
    // console.log(liq);

    const { interests } = await liq.callStatic.redeemLpInterests(
      EXPIRY,
      alice.address
    );
    const { rewards } = await liq.callStatic.redeemRewards(
      EXPIRY,
      alice.address
    );
    console.log(`\tInterests for alice = ${interests}`);
    console.log(`\tRewards available for epochs from now: ${rewards}`);

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

    expect(pdlBalanceOfUserAfter2ndTnx.toNumber()).to.be.approximately(
      expectedPdlBalanceOfUsersAfter2ndTnx.toNumber(),
      expectedPdlBalanceOfUsersAfter2ndTnx.toNumber() / 1000
    );

    await liq.withdraw(EXPIRY, amountToStake.div(2), consts.HIGH_GAS_OVERRIDE);
    const cTokenBalanceOfLpHolderContractAfter = await cUSDT.balanceOf(
      lpHolderContract
    );
    const cTokenBalanceOfUserAfter = await cUSDT.balanceOf(bob.address);

    //now, the LP holding contract should hold almost 0 cUSDT. This means that we have calculated and gave the Lp interests back to the users properly
    console.log(
      `\t[LP interests] cUSDT balance of LpHolder after withdrawing all = ${cTokenBalanceOfLpHolderContractAfter}`
    );
    console.log(
      `\t[LP interests] cUSDT balance of user after withdrawing all = ${cTokenBalanceOfUserAfter}`
    );
  });
});
