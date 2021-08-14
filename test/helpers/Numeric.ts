import { expect } from 'chai';
import { BigNumber as BN, BigNumberish } from 'ethers';
import { LiqParams, TestEnv, UserStakeAction } from '../fixtures';
const PRECISION = BN.from(2).pow(40);

// returns a rewards object = BN[][]
//    rewards[userId][0] is the rewards withdrawable at currentEpoch
//    rewards[userId][1] is the rewards withdrawable at currentEpoch + 1
//    ...
export function calcExpectedRewards(
  userStakingData: UserStakeAction[][][],
  params: LiqParams,
  currentEpoch: number,
  usingAllocationSetting: Boolean = false
): BN[][] {
  let nUsers = userStakingData[0].length;
  let numerator: BN = params.TOTAL_NUMERATOR;
  let denominator: BN = params.TOTAL_NUMERATOR;
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
    for (let j: number = 0; j < params.NUMBER_OF_EPOCHS.add(params.VESTING_EPOCHS).toNumber(); j++) {
      availableRewardsForEpoch[i].push(BN.from(0));
    }
    for (let j: number = 0; j < params.VESTING_EPOCHS.toNumber(); j++) {
      rewards[i].push(BN.from(0));
    }
  }

  userStakingData.forEach((epochData, i) => {
    if (usingAllocationSetting) {
      numerator = params.ALLOCATION_SETTING[i + 1];
    }

    let epochId = i + 1;
    if (epochId >= currentEpoch) return; // only count for epochs before currentEpoch
    let userStakeSeconds: BN[] = [];
    let totalStakeSeconds = BN.from(0);

    epochData.forEach((userData, userId) => {
      userStakeSeconds.push(BN.from(0));
      let lastTimeUpdated = startOfEpoch(params, epochId);
      userData.push(new UserStakeAction(startOfEpoch(params, epochId + 1), BN.from(0), true, -1));
      userData.forEach((userAction, actionId) => {
        // console.log(`\t[calculateExpectedRewards] Processing userAction: ${userAction.time} ${userAction.amount} ${userAction.isStaking} for user ${userId}`);
        const timeElapsed = userAction.time.sub(lastTimeUpdated);
        const additionalStakeSeconds = userCurrentStakes[userId].mul(timeElapsed);
        userStakeSeconds[userId] = userStakeSeconds[userId].add(additionalStakeSeconds);
        // console.log(`\t\ttotalStakeSeconds before = ${totalStakeSeconds}, ${totalStakeSeconds.add(additionalStakeSeconds)}`);
        totalStakeSeconds = totalStakeSeconds.add(additionalStakeSeconds);
        // console.log(`\t\t[calculateExpectedRewards] additionalStakeSeconds = ${additionalStakeSeconds}, timeElapsed = ${timeElapsed}, totalStakeSeconds = ${totalStakeSeconds}`);

        if (userAction.isStaking) {
          userCurrentStakes[userId] = userCurrentStakes[userId].add(userAction.amount);
        } else {
          userCurrentStakes[userId] = userCurrentStakes[userId].sub(userAction.amount);
        }
        lastTimeUpdated = userAction.time;
      });
    });
    // console.log(`\t[calculateExpectedRewards] Epoch = ${epochId}, totalStakeSeconds = ${totalStakeSeconds}`);

    epochData.forEach((userData, userId) => {
      if (!totalStakeSeconds.eq(0)) {
        const rewardsPerVestingEpoch = params.REWARDS_PER_EPOCH[epochId - 1]
          .mul(userStakeSeconds[userId])
          .div(totalStakeSeconds)
          .div(params.VESTING_EPOCHS)
          .mul(numerator)
          .div(denominator);
        for (let e: number = epochId + 1; e <= epochId + params.VESTING_EPOCHS.toNumber(); e++) {
          if (e <= currentEpoch) {
            rewards[userId][0] = rewards[userId][0].add(rewardsPerVestingEpoch);
            continue;
          }
          if (e < currentEpoch + params.VESTING_EPOCHS.toNumber()) {
            rewards[userId][e - currentEpoch] = rewards[userId][e - currentEpoch].add(rewardsPerVestingEpoch);
          }
        }
      }
    });
  });
  // rewards.forEach((userReward, userId) => {
  //   console.log(`\tRewards for user ${userId}: ${userReward}`);
  // });
  return rewards;
}

async function calEffectiveLiquidity(env: TestEnv): Promise<{
  xytAmount: BN;
  tokenAmount: BN;
}> {
  const MINIMUM_LIQUIDITY: BN = BN.from(3000);
  let totalSupply = await env.market.totalSupply();
  let totalEffectiveLP = totalSupply.sub(MINIMUM_LIQUIDITY);
  let xytAmount = (await env.xyt.balanceOf(env.market.address)).mul(totalEffectiveLP).div(totalSupply);
  console.log(xytAmount.toString(), (await env.xyt.balanceOf(env.market.address)).toString());
  let tokenAmount = (await env.testToken.balanceOf(env.market.address)).mul(totalEffectiveLP).div(totalSupply);
  return { xytAmount, tokenAmount };
}

export function epochRelativeTime(params: LiqParams, t: BN): BN {
  return t.sub(params.START_TIME).mod(params.EPOCH_DURATION);
}

export function epochOfTimestamp(params: LiqParams, t: BN): BN {
  if (t.lt(params.START_TIME)) return BN.from(0);
  return t.sub(params.START_TIME).div(params.EPOCH_DURATION).add(BN.from(1));
}

export function startOfEpoch(params: LiqParams, e: number): BN {
  return params.EPOCH_DURATION.mul(e - 1).add(params.START_TIME);
}

/**
 * convert an amount to Wei
 * @param inp if inp is number => inp is the number of decimal digits
 *            if inp is Token => the number of decimal digits will be extracted from Token
 */
export function amountToWei(amount: BN, decimal: number) {
  return BN.from(10).pow(decimal).mul(amount);
}

export function toFixedPoint(val: string | number): BN {
  if (typeof val === 'number') {
    return BN.from(val).mul(PRECISION);
  }
  var pos: number = val.indexOf('.');
  if (pos == -1) {
    return BN.from(val).mul(PRECISION);
  }
  var lenFrac = val.length - pos - 1;
  val = val.replace('.', '');
  return BN.from(val).mul(PRECISION).div(BN.from(10).pow(lenFrac));
}

export function randomBN(range?: number | BN): BN {
  let lim = 10 ** 15;
  return BN.from(Math.floor(Math.random() * lim))
    .mul(BN.from(range))
    .div(lim);
}

export function randomNumber(range?: number): number {
  return randomBN(range).toNumber();
}

export function approxBigNumber(
  _actual: BigNumberish,
  _expected: BigNumberish,
  _delta: BigNumberish,
  log: boolean = true
) {
  let actual: BN = BN.from(_actual);
  let expected: BN = BN.from(_expected);
  let delta: BN = BN.from(_delta);

  var diff = expected.sub(actual);
  if (diff.lt(0)) {
    diff = diff.mul(-1);
  }
  if (diff.lte(delta) == false) {
    expect(
      diff.lte(delta),
      `expecting: ${expected.toString()}, received: ${actual.toString()}, diff: ${diff.toString()}, allowedDelta: ${delta.toString()}`
    ).to.be.true;
  } else {
    if (log) {
      console.log(
        `expecting: ${expected.toString()}, received: ${actual.toString()}, diff: ${diff.toString()}, allowedDelta: ${delta.toString()}`
      );
    }
  }
}

export function approxByPercent(
  _actual: BigNumberish,
  _expected: BigNumberish,
  _percentInDecimal: BigNumberish = 1000000 // default delta is 1e-6
) {
  let delta: BN = BN.from(_expected).div(_percentInDecimal);
  if (delta.eq(0)) delta = BN.from(1);
  approxBigNumber(BN.from(_actual), BN.from(_expected), delta);
}

export function sqrt(y: BN): BN {
  let z: BN = BN.from(0);
  if (y.gt(3)) {
    z = y;
    let x = y.div(2).add(1);
    while (x.lt(z)) {
      z = x;
      x = y.div(x).add(x).div(2);
    }
  } else if (!y.eq(0)) {
    z = BN.from(1);
  }
  return z;
}
