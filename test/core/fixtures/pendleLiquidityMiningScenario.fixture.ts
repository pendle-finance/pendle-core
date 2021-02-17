import { BigNumber as BN } from "ethers";
import { startOfEpoch } from "../../helpers";
import { liqParams, userStakeAction } from "./pendleLiquidityMining.fixture";
const SAME_AMOUNT: BN = BN.from(10000);

export function scenario01(params: liqParams): userStakeAction[][][] {
  let LENGTH = params.EPOCH_DURATION;
  return [
    [
      [
        {
          time: startOfEpoch(params, 1),
          amount: SAME_AMOUNT,
          isStaking: true,
          id: 0
        },
        {
          time: startOfEpoch(params, 1).add(LENGTH.div(3)),
          amount: SAME_AMOUNT.mul(3).div(2),
          isStaking: true,
          id: 0
        },
      ],
      [
        {
          time: startOfEpoch(params, 1).add(LENGTH.div(2)),
          amount: SAME_AMOUNT.div(5),
          isStaking: true,
          id: 1
        },
        {
          time: startOfEpoch(params, 1).add(LENGTH.mul(4).div(5)),
          amount: SAME_AMOUNT,
          isStaking: true,
          id: 1
        },
      ],
    ],
    [
      [
        {
          time: startOfEpoch(params, 2),
          amount: SAME_AMOUNT.div(3),
          isStaking: false,
          id: 0
        },
        {
          time: startOfEpoch(params, 2).add(LENGTH.div(3)),
          amount: SAME_AMOUNT,
          isStaking: true,
          id: 0
        },
      ],
      [
        {
          time: startOfEpoch(params, 2).add(LENGTH.div(2)),
          amount: SAME_AMOUNT.div(8),
          isStaking: false,
          id: 1
        },
        {
          time: startOfEpoch(params, 2).add(LENGTH.mul(4).div(5)),
          amount: SAME_AMOUNT,
          isStaking: true,
          id: 1
        },
      ],
    ],
  ];
}

export function scenario02(params: liqParams): userStakeAction[][][] {
  let LENGTH = params.EPOCH_DURATION;
  return [
    [
      [
        {
          time: startOfEpoch(params, 1),
          amount: SAME_AMOUNT,
          isStaking: true,
          id: 0
        },
      ],
      [
        {
          time: startOfEpoch(params, 1).add(LENGTH.div(2)),
          amount: SAME_AMOUNT,
          isStaking: true,
          id: 1
        },
      ],
    ],
  ];
}

export function scenario03(params: liqParams): userStakeAction[][][] {
  let LENGTH = params.EPOCH_DURATION;
  return [
    [
      [
        {
          time: startOfEpoch(params, 1),
          amount: SAME_AMOUNT,
          isStaking: true,
          id: 0
        },
        {
          time: startOfEpoch(params, 1).add(LENGTH.div(3)),
          amount: SAME_AMOUNT,
          isStaking: true,
          id: 0
        },
      ],
      [
        {
          time: startOfEpoch(params, 1).add(LENGTH.div(2)),
          amount: SAME_AMOUNT,
          isStaking: true,
          id: 1
        },
        {
          time: startOfEpoch(params, 1).add(LENGTH.mul(4).div(5)),
          amount: SAME_AMOUNT,
          isStaking: true,
          id: 1
        },
      ],
    ],
  ];
}