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

const { waffle } = require("hardhat");
const hre = require("hardhat");
const { deployContract, provider } = waffle;

interface userStakeAction {
  time: BN;
  amount: BN;
  isStaking: boolean;
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
function calculateExpectedRewards(
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
    })
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
      });
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

  it.only("Test", async () => {
    calculateExpectedRewards(
      [
        [
          //epoch 1
          [],
          [
            // epoch 1 - user 1
            {
              time: BN.from(params.START_TIME), // start of epoch
              amount: BN.from(10000),
              isStaking: true,
            },
          ],
          [
            // epoch 1 - user 2
            {
              time: BN.from(
                params.START_TIME.add(params.EPOCH_DURATION.div(2))
              ), // exactly half
              amount: BN.from(10000),
              isStaking: true,
            },
          ],
        ],
        [ // epoch 2
          [],
          [ // epoche 2 - user 1
            {
              time: BN.from(params.START_TIME.add(params.EPOCH_DURATION)), // start of epoch
              amount: BN.from(10000),
              isStaking: false //withdraw all
            },
          ],
          [ // epoche 2 - user 2: dont do anything
          ],
        ]
      ],
      params,
      3
    );

    console.log(`rewardsPerEpoch in params = ${params.REWARDS_PER_EPOCH}`);
    console.log((await pdl.balanceOf(bob.address)).toString());

    await setTimeNextBlock(provider, params.START_TIME);
    await doStake(bob, BN.from(10000));

    await advanceTime(provider, params.EPOCH_DURATION.div(2));
    await doStake(charlie, BN.from(10000));

    await advanceTime(provider, params.EPOCH_DURATION.div(2));

    console.log(
      "rewards Bob",
      await pendleLiqWeb3.methods.claimRewards().call({ from: bob.address })
    );
    console.log(
      "rewards Charlie",
      await pendleLiqWeb3.methods.claimRewards().call({ from: charlie.address })
    );
    // await doWithdraw(bob, BN.from(10000));

    // // await advanceTime(provider, params.EPOCH_DURATION);

    // console.log("rewards Bob", await pendleLiqWeb3.methods
    //   .claimRewards()
    //   .call({ from: bob.address }));
  });

  it("this test should run fine", async () => {
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
    // await advanceTime(provider, params.EPOCH_DURATION);
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
    console.log((await pdl.balanceOf(bob.address)).toString());

    await pendleLiq.connect(bob).claimRewards();
  });

  it("sample test 1", async () => {
    const amountToStake = params.INITIAL_LP_AMOUNT;

    await setTimeNextBlock(provider, params.START_TIME);
    await pendleLiq
      .connect(bob)
      .stake(
        consts.T0.add(consts.SIX_MONTH),
        amountToStake,
        consts.HIGH_GAS_OVERRIDE
      );
    await pendleLiq
      .connect(charlie)
      .stake(
        consts.T0.add(consts.SIX_MONTH),
        amountToStake,
        consts.HIGH_GAS_OVERRIDE
      );

    await advanceTime(provider, params.EPOCH_DURATION);
    await pendleLiq.connect(bob).claimRewards();
    await pendleLiq.connect(charlie).claimRewards();
    console.log(
      "bob's balance after 1 epoch",
      (await pdl.balanceOf(bob.address)).toString()
    );
    console.log(
      "charlie's balance after 1 epoch",
      (await pdl.balanceOf(charlie.address)).toString()
    );

    await advanceTime(provider, params.EPOCH_DURATION);

    await pendleLiq.connect(bob).claimRewards();
    await pendleLiq.connect(charlie).claimRewards();
    console.log(
      "bob's balance after 2 epoch",
      (await pdl.balanceOf(bob.address)).toString()
    );
    console.log(
      "charlie's balance after 2 epoch",
      (await pdl.balanceOf(charlie.address)).toString()
    );
  });
});
