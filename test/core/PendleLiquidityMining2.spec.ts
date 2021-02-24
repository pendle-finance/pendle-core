import { assert, expect } from "chai";
import { createFixtureLoader } from "ethereum-waffle";
import { BigNumber as BN, Contract, Wallet } from "ethers";
import PendleLiquidityMining from "../../build/artifacts/contracts/core/PendleLiquidityMining.sol/PendleLiquidityMining.json";
import {
  approxBigNumber,
  amountToWei,
  consts,
  evm_revert,
  evm_snapshot,
  setTime,
  setTimeNextBlock,
  startOfEpoch,
  getAContract,
  tokens,
  mint,
} from "../helpers";
import {
  liqParams,
  pendleLiquidityMiningFixture,
  UserStakeAction,
} from "./fixtures";
import * as scenario from "./fixtures/pendleLiquidityMiningScenario.fixture";

const { waffle } = require("hardhat");
const hre = require("hardhat");
const { deployContract, provider } = waffle;

// returns a rewards object = BN[][]
//    rewards[userId][0] is the rewards withdrawable at currentEpoch
//    rewards[userId][1] is the rewards withdrawable at currentEpoch + 1
//    ...
function calExpectedRewards(
  userStakingData: UserStakeAction[][][],
  params: liqParams,
  currentEpoch: number
): BN[][] {
  let nUsers = userStakingData[0].length;
  /*
  pushing params.NUMBER_OF_EPOCHS empty epochs to mimic the real-life situation where users
  will continue to receive rewards even if they don't do any action
  */
  for (let i = 1; i <= params.NUMBER_OF_EPOCHS.toNumber(); i++) {
    let emptyArr = [];
    for (let j = 1; j <= nUsers; j++) {
      emptyArr.push([]);
    }
    userStakingData.push(emptyArr);
  }

  let userCurrentStakes: BN[] = [];
  let rewards: BN[][] = [];

  let availableRewardsForEpoch: BN[][] = []; // availableRewardsForEpoch[userId][epochId]

  for (let i: number = 0; i < nUsers; i++) {
    userCurrentStakes.push(BN.from(0));
    rewards.push([]);
    availableRewardsForEpoch.push([]);
    for (
      let j: number = 0;
      j < params.NUMBER_OF_EPOCHS.add(params.VESTING_EPOCHS).toNumber();
      j++
    ) {
      availableRewardsForEpoch[i].push(BN.from(0));
    }
    for (let j: number = 0; j < params.VESTING_EPOCHS.toNumber(); j++) {
      rewards[i].push(BN.from(0));
    }
  }

  userStakingData.forEach((epochData, i) => {
    let epochId = i + 1;
    if (epochId >= currentEpoch) return; // only count for epoches before currentEpoch
    let userStakeSeconds: BN[] = [];
    let totalStakeSeconds = BN.from(0);

    epochData.forEach((userData, userId) => {
      userStakeSeconds.push(BN.from(0));
      let lastTimeUpdated = startOfEpoch(params, epochId);
      userData.push(
        new UserStakeAction(
          startOfEpoch(params, epochId + 1),
          BN.from(0),
          true,
          -1
        )
      );
      userData.forEach((userAction, actionId) => {
        // console.log(`\t[calculateExpectedRewards] Processing userAction: ${userAction.time} ${userAction.amount} ${userAction.isStaking} for user ${userId}`);
        const timeElapsed = userAction.time.sub(lastTimeUpdated);
        const additionalStakeSeconds = userCurrentStakes[userId].mul(
          timeElapsed
        );
        userStakeSeconds[userId] = userStakeSeconds[userId].add(
          additionalStakeSeconds
        );
        // console.log(`\t\ttotalStakeSeconds before = ${totalStakeSeconds}, ${totalStakeSeconds.add(additionalStakeSeconds)}`);
        totalStakeSeconds = totalStakeSeconds.add(additionalStakeSeconds);
        // console.log(`\t\t[calculateExpectedRewards] additionalStakeSeconds = ${additionalStakeSeconds}, timeElapsed = ${timeElapsed}, totalStakeSeconds = ${totalStakeSeconds}`);

        if (userAction.isStaking) {
          userCurrentStakes[userId] = userCurrentStakes[userId].add(
            userAction.amount
          );
        } else {
          userCurrentStakes[userId] = userCurrentStakes[userId].sub(
            userAction.amount
          );
        }
        lastTimeUpdated = userAction.time;
      });
    });
    // console.log(`\t[calculateExpectedRewards] Epoch = ${epochId}, totalStakeSeconds = ${totalStakeSeconds}`);

    epochData.forEach((userData, userId) => {
      const rewardsPerVestingEpoch = params.REWARDS_PER_EPOCH.mul(
        userStakeSeconds[userId]
      )
        .div(totalStakeSeconds)
        .div(params.VESTING_EPOCHS);
      for (
        let e: number = epochId + 1;
        e <= epochId + params.VESTING_EPOCHS.toNumber();
        e++
      ) {
        if (e <= currentEpoch) {
          rewards[userId][0] = rewards[userId][0].add(rewardsPerVestingEpoch);
          continue;
        }
        if (e < currentEpoch + params.VESTING_EPOCHS.toNumber()) {
          rewards[userId][e - currentEpoch] = rewards[userId][
            e - currentEpoch
          ].add(rewardsPerVestingEpoch);
        }
      }
    });
  });
  // rewards.forEach((userReward, userId) => {
  //   console.log(`\tRewards for user ${userId}: ${userReward}`);
  // });
  return rewards;
}

// TODO:interest of Lp, pull&push of tokens
describe("PendleLiquidityMining-beta tests", async () => {
  const wallets = provider.getWallets();
  const loadFixture = createFixtureLoader(wallets, provider);
  const [alice, bob, charlie, dave, eve] = wallets;
  let pendleLiq: Contract;
  let pendleRouter: Contract;
  let pendleStdMarket: Contract;
  let pendleXyt: Contract;
  let baseToken: Contract;
  let pdl: Contract;
  let params: liqParams;
  let lendingPoolCore: Contract;
  let aUSDT: Contract;
  let snapshotId: string;
  let globalSnapshotId: string;
  let pendleLiqWeb3: any; // TODO: move this to fixture
  before(async () => {
    globalSnapshotId = await evm_snapshot();
    const fixture = await loadFixture(pendleLiquidityMiningFixture);
    pendleLiq = fixture.pendleLiquidityMining;
    pendleRouter = fixture.core.pendleRouter;
    baseToken = fixture.testToken;
    pendleStdMarket = fixture.pendleStdMarket;
    pendleXyt = fixture.forge.pendleFutureYieldToken;
    params = fixture.params;
    pdl = fixture.pdl;
    lendingPoolCore = fixture.aave.lendingPoolCore;
    aUSDT = await getAContract(alice, lendingPoolCore, tokens.USDT);
    pendleLiqWeb3 = new hre.web3.eth.Contract(
      PendleLiquidityMining.abi,
      pendleLiq.address
    );
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
    await pendleLiq
      .connect(person)
      .stake(consts.T0.add(consts.SIX_MONTH), amount, consts.HIGH_GAS_OVERRIDE);
  }

  async function doWithdraw(person: Wallet, amount: BN) {
    await pendleLiq
      .connect(person)
      .withdraw(
        consts.T0.add(consts.SIX_MONTH),
        amount,
        consts.HIGH_GAS_OVERRIDE
      );
  }

  async function claimRewardsWeb3(user: Wallet) {
    return await pendleLiqWeb3.methods
      .claimRewards()
      .call({ from: user.address });
  }

  async function getLpBalanceOfAllUsers(): Promise<BN[]> {
    let res: BN[] = [];
    for (let i = 0; i < wallets.length; i++) {
      res.push(await pendleStdMarket.balanceOf(wallets[i].address));
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
      await setTimeNextBlock(provider, action.time);
      if (action.isStaking) {
        await doStake(wallets[action.id], action.amount); // acess users directly by their id instead of names
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
    let expectedRewards: BN[][] = calExpectedRewards(
      userStakingData,
      params,
      epochToCheck
    );
    await setTime(provider, startOfEpoch(params, epochToCheck));
    let numUser = expectedRewards.length;
    let allocationRateDiv =
      _allocationRateDiv !== undefined ? _allocationRateDiv : 1;
    for (let userId = 0; userId < numUser; userId++) {
      await pendleLiq.connect(wallets[userId]).claimRewards();
      // console.log(expectedRewards[userId][0].toString(), (await pdl.balanceOf(wallets[userId].address)).toString());
      approxBigNumber(
        await pdl.balanceOf(wallets[userId].address),
        expectedRewards[userId][0].div(allocationRateDiv),
        BN.from(100), // 100 is much better than necessary, but usually the differences are 0
        false
      );
    }
    // console.log(await claimRewardsWeb3(wallets[0]));
    // console.log(await claimRewardsWeb3(wallets[1]));
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

  it("beta", async () => {
    // console.log(`\tLP balance of eve = ${await pendleStdMarket.balanceOf(eve.address)}`);
    // console.log(`\taToken balance of market = ${await aUSDT.balanceOf(pendleStdMarket.address)}`);
    // console.log(`\tXYT balance of market = ${await pendleXyt.balanceOf(pendleStdMarket.address)}`);
    // console.log(`\tbaseToken balance of market = ${await baseToken.balanceOf(pendleStdMarket.address)}`);
    await pendleRouter.connect(eve).claimLpInterests([pendleStdMarket.address]);
    setTimeNextBlock(provider, consts.T0.add(consts.THREE_MONTH));

    // some dummy trade
    const testAmount = amountToWei(tokens.USDT, BN.from(1));
    await pendleRouter.swapExactOut(
      baseToken.address,
      pendleXyt.address,
      testAmount,
      testAmount.mul(BN.from(10)),
      consts.MAX_ALLOWANCE,
      consts.MARKET_FACTORY_AAVE,
      consts.HIGH_GAS_OVERRIDE
    );
    // console.log(`\t+3m, LP balance of eve = ${await pendleStdMarket.balanceOf(eve.address)}`);
    // console.log(`\t+3m, aToken balance of market = ${await aUSDT.balanceOf(pendleStdMarket.address)}`);
    // console.log(`\t+3m, XYT balance of market = ${await pendleXyt.balanceOf(pendleStdMarket.address)}`);
    // console.log(`\t+3m, baseToken balance of market = ${await baseToken.balanceOf(pendleStdMarket.address)}`);
    // console.log(`\t\tDid a dummy trade`);

    await pendleRouter.connect(eve).claimLpInterests([pendleStdMarket.address]);

    // console.log(`\tclaimed LP interests: LP balance of eve = ${await pendleStdMarket.balanceOf(eve.address)}`);
    // console.log(`\tclaimed LP interests: aToken balance of market = ${await aUSDT.balanceOf(pendleStdMarket.address)}`);
    // console.log(`\tclaimed LP interests: aToken balance of eve = ${await aUSDT.balanceOf(eve.address)}`);
    // console.log(`\tclaimed LP interests: XYT balance of market = ${await pendleXyt.balanceOf(pendleStdMarket.address)}`);
    // console.log(`\tclaimed LP interests: baseToken balance of market = ${await baseToken.balanceOf(pendleStdMarket.address)}`);
  });

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

  it("test 5", async () => {
    await pendleLiq.setAllocationSetting(
      [consts.T0.add(consts.SIX_MONTH), consts.T0.add(consts.THREE_MONTH)],
      [params.TOTAL_NUMERATOR.div(2), params.TOTAL_NUMERATOR.div(2)],
      consts.HIGH_GAS_OVERRIDE
    );
    let userStakingData: UserStakeAction[][][] = scenario.scenario04(params);
    await doSequence(userStakingData);
    await checkEqualRewardsFourEpochs(
      userStakingData,
      userStakingData.length + 1,
      2
    );
  });

  it("test invalid setAllocationSetting", async () => {
    await expect(
      pendleLiq.setAllocationSetting(
        [
          consts.T0.add(consts.SIX_MONTH),
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
    ).to.be.revertedWith(
      "VM Exception while processing transaction: revert INVALID_ALLOCATION"
    );
  });

  it("this test shouldn't crash", async () => {
    const amountToStake = params.INITIAL_LP_AMOUNT;

    await setTimeNextBlock(provider, params.START_TIME);
    await pendleLiq
      .connect(bob)
      .stake(
        consts.T0.add(consts.SIX_MONTH),
        amountToStake,
        consts.HIGH_GAS_OVERRIDE
      );

    await setTimeNextBlock(
      provider,
      params.START_TIME.add(params.EPOCH_DURATION)
    );
    await pendleLiq
      .connect(bob)
      .withdraw(
        consts.T0.add(consts.SIX_MONTH),
        amountToStake,
        consts.HIGH_GAS_OVERRIDE
      );
    await pendleLiq.connect(bob).claimRewards();
    await setTimeNextBlock(
      provider,
      params.START_TIME.add(params.EPOCH_DURATION).add(params.EPOCH_DURATION)
    );
    await pendleLiq.connect(bob).claimRewards();
  });
});
