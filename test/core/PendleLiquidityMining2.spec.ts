import { createFixtureLoader } from "ethereum-waffle";
import { BigNumber as BN, Contract, Wallet } from "ethers";
import {
  advanceTime,
  consts,
  evm_revert,
  evm_snapshot,
  getAContract,
  setTimeNextBlock,
  tokens,
  setTime,
} from "../helpers";
import PendleLiquidityMining from "../../build/artifacts/contracts/core/PendleLiquidityMining.sol/PendleLiquidityMining.json";
import { liqParams, pendleLiquidityMiningFixture } from "./fixtures";
import { assert, expect, use } from "chai";

const { waffle } = require("hardhat");
const hre = require("hardhat");
const { deployContract, provider } = waffle;

interface userStakeAction {
  time: BN;
  amount: BN;
  isStaking: boolean;
  id: number; // will not be used in calExpectedRewards
}

function epochRelativeTime(params: liqParams, t: BN): BN {
  return t.sub(params.START_TIME).mod(params.EPOCH_DURATION);
}

function epochOfTimestamp(params: liqParams, t: BN): BN {
  if (t.lt(params.START_TIME)) return BN.from(0);
  return t.sub(params.START_TIME).div(params.EPOCH_DURATION).add(BN.from(1));
}

function startOfEpoch(params: liqParams, e: BN): BN {
  return params.EPOCH_DURATION.mul(e.sub(1)).add(params.START_TIME);
}

// returns a rewards object = BN[][]
//    rewards[userId][0] is the rewards withdrawable at currentEpoch
//    rewards[userId][1] is the rewards withdrawable at currentEpoch + 1
//    ...
function calExpectedRewards(
  userStakingData: userStakeAction[][][],
  params: liqParams,
  currentEpoch: number
): BN[][] {
  let userCurrentStakes: BN[] = [];
  let userLastWithdrawnEpoch: number[] = [];
  let rewards: BN[][] = [];

  let nUsers = userStakingData[0].length;
  // let availableRewardsForEpoch: BN[][] = []; // availableRewardsForEpoch[userId][epochId]

  for (let i: number = 0; i < nUsers; i++) {
    userCurrentStakes.push(BN.from(0));
    userLastWithdrawnEpoch.push(0);
    rewards.push([]);
    // availableRewardsForEpoch.push([]);
    // for (
    //   let j: number = 0;
    //   j < params.NUMBER_OF_EPOCHS.add(params.VESTING_EPOCHS).toNumber();
    //   j++
    // ) {
    //   availableRewardsForEpoch[i].push(BN.from(0));
    // }
    for (let j: number = 0; j < params.VESTING_EPOCHS.toNumber(); j++) {
      rewards[i].push(BN.from(0));
    }
  }

  userStakingData.forEach((epochData, i) => {
    let epochId = i + 1;
    epochData.forEach((userData, userId) => {
      userData.forEach((userAction, actionId) => {
        if (!userAction.isStaking) {
          userLastWithdrawnEpoch[userId] = epochId;
        }
      });
    });
  });

  userStakingData.forEach((epochData, i) => {
    let epochId = i + 1;
    if (epochId >= currentEpoch) return; // only count for epoches before currentEpoch
    let userStakeSeconds: BN[] = [];
    let totalStakeSeconds = BN.from(0);

    epochData.forEach((userData, userId) => {
      userStakeSeconds.push(BN.from(0));
      let lastTimeUpdated = startOfEpoch(params, BN.from(epochId));
      userData.push({
        time: startOfEpoch(params, BN.from(epochId + 1)),
        amount: BN.from(0),
        isStaking: true,
        id: -1
      });
      userData.forEach((userAction, actionId) => {
        // console.log(`\t[calExpectedRewards] Processing userAction: ${userAction.time} ${userAction.amount} ${userAction.isStaking} for user ${userId}`);
        const timeElapsed = userAction.time.sub(lastTimeUpdated);
        const additionalStakeSeconds = userCurrentStakes[userId].mul(
          timeElapsed
        );
        userStakeSeconds[userId] = userStakeSeconds[userId].add(
          additionalStakeSeconds
        );
        // console.log(`\t\ttotalStakeSeconds before = ${totalStakeSeconds}, ${totalStakeSeconds.add(additionalStakeSeconds)}`);
        totalStakeSeconds = totalStakeSeconds.add(additionalStakeSeconds);
        // console.log(`\t\t[calExpectedRewards] additionalStakeSeconds = ${additionalStakeSeconds}, timeElapsed = ${timeElapsed}, totalStakeSeconds = ${totalStakeSeconds}`);

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
    // console.log(`\t[calExpectedRewards] Epoch = ${epochId}, totalStakeSeconds = ${totalStakeSeconds}`);

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
        if (e <= userLastWithdrawnEpoch[userId]) {
          continue; // this would be withdrawn by the user's last withdraw action
        }
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
  rewards.forEach((userReward, userId) => {
    console.log(`\tRewards for user ${userId}: ${userReward}`);
  });
  return rewards;
}

describe("PendleLiquidityMining-beta tests", async () => {
  const wallets = provider.getWallets();
  const loadFixture = createFixtureLoader(wallets, provider);
  const [alice, bob, charlie, dave] = wallets;
  let lendingPoolCore: Contract;
  let pendleLiq: Contract;
  let pdl: Contract;
  let aUSDT: Contract;
  let params: liqParams;
  let snapshotId: string;
  let globalSnapshotId: string;
  let pendleLiqWeb3: any; // TODO: move this to fixture
  before(async () => {
    globalSnapshotId = await evm_snapshot();
    const fixture = await loadFixture(pendleLiquidityMiningFixture);
    lendingPoolCore = fixture.aave.lendingPoolCore;
    pendleLiq = fixture.pendleLiquidityMining;
    params = fixture.params;
    aUSDT = await getAContract(alice, lendingPoolCore, tokens.USDT);
    pdl = fixture.pdl;
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
  // [epochs][user][transaction]
  async function doSequence(userStakingData: userStakeAction[][][]) {
    let flatData: userStakeAction[] = [];

    userStakingData.forEach((epochData) => {
      epochData.forEach((userData) => {
        userData.forEach((userAction) => {
          flatData.push(userAction);
        })
      })
    })

    flatData = flatData.sort((a, b) => {
      assert(a.time != b.time);
      return a.time.sub(b.time).toNumber();
    })

    // console.log(flatData);
    for (let i = 0; i < flatData.length; i++) {
      let action = flatData[i];
      if (action.id == -1) {
        continue; // placeholder event, skip
      }
      if (i != 0) {
        assert(flatData[i - 1].time < flatData[i].time);
      }
      await setTimeNextBlock(provider, action.time);
      if (action.isStaking) {
        await doStake(wallets[action.id], action.amount); // acess users directly by their id instead of names
      }
      else { // withdrawing
        await doWithdraw(wallets[action.id], action.amount);
      }
    }
  }

  function checkEqualRewards(expectedRewards: BN[][], actualRewards: BN[][]) {
    let numUser = expectedRewards.length;
    for (let userId = 0; userId < numUser; userId++) {
      for (let i = 0; i < 4; i++) {
        expect(expectedRewards[userId][i].toNumber()).to.be.approximately(
          BN.from(actualRewards[userId][i]).toNumber(),
          10000
        );
      }
    }
  }
  it("beta", async () => {
    const T0 = params.START_TIME;
    const LENGTH = params.EPOCH_DURATION;

    let userStakingData = [
      [
        [
          {
            time: T0,
            amount: BN.from(10000),
            isStaking: true,
            id: 0
          },
          {
            time: T0.add(LENGTH.div(3)),
            amount: BN.from(10000),
            isStaking: true,
            id: 0
          },
        ],
        [
          {
            time: T0.add(LENGTH.div(2)), // exactly half
            amount: BN.from(10000),
            isStaking: true,
            id: 1
          },
          {
            time: T0.add(LENGTH.mul(4).div(5)), // exactly half
            amount: BN.from(10000),
            isStaking: true,
            id: 1
          },
        ],
      ],
    ];
    let expectedRewards: BN[][] = calExpectedRewards(
      userStakingData,
      params,
      2
    );
    await doSequence(userStakingData);
    await setTime(provider, params.START_TIME.add(params.EPOCH_DURATION));
    let actualRewards: BN[][] = [await claimRewardsWeb3(alice), await claimRewardsWeb3(bob)];
    checkEqualRewards(expectedRewards, actualRewards);
  });

  it("Test", async () => {
    let userStakingData: userStakeAction[][][] = [
      [
        [
          {
            time: params.START_TIME, // start of epoch
            amount: BN.from(10000),
            isStaking: true,
            id: 0
          },
        ],
        [
          {
            time: params.START_TIME.add(params.EPOCH_DURATION.div(2)), // exactly half
            amount: BN.from(10000),
            isStaking: true,
            id: 1
          },
        ],
      ],
    ];
    let expectedRewards: BN[][] = calExpectedRewards(
      userStakingData,
      params,
      2
    );
    await doSequence(userStakingData);
    await setTime(provider, params.START_TIME.add(params.EPOCH_DURATION));
    let actualRewards: BN[][] = [await claimRewardsWeb3(alice), await claimRewardsWeb3(bob)];
    checkEqualRewards(expectedRewards, actualRewards);
  });

  it("Test 2", async () => {
    const T0 = params.START_TIME;
    const LENGTH = params.EPOCH_DURATION;

    let userStakingData = [
      [
        [
          {
            time: T0,
            amount: BN.from(10000),
            isStaking: true,
            id: 0
          },
          {
            time: T0.add(LENGTH.div(3)),
            amount: BN.from(10000),
            isStaking: true,
            id: 0
          },
        ],
        [
          {
            time: T0.add(LENGTH.div(2)), // exactly half
            amount: BN.from(10000),
            isStaking: true,
            id: 1
          },
          {
            time: T0.add(LENGTH.mul(4).div(5)), // exactly half
            amount: BN.from(10000),
            isStaking: true,
            id: 1
          },
        ],
      ],
    ];
    let expectedRewards: BN[][] = calExpectedRewards(
      userStakingData,
      params,
      2
    );
    await doSequence(userStakingData);
    await setTime(provider, params.START_TIME.add(params.EPOCH_DURATION));
    let actualRewards: BN[][] = [await claimRewardsWeb3(alice), await claimRewardsWeb3(bob)];
    checkEqualRewards(expectedRewards, actualRewards);
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
