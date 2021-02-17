import { BigNumber as BN } from "ethers";
import { startOfEpoch } from "../../helpers";
import { liqParams, userStakeAction } from "./pendleLiquidityMining.fixture";
const SAME_AMOUNT: BN = BN.from(10000);

export function scenario01(params: liqParams): userStakeAction[][][] {
  let LENGTH = params.EPOCH_DURATION;
  return [
    [
      [
        new userStakeAction(
          startOfEpoch(params, 1),
          SAME_AMOUNT,
          true,
          0
        ),
        new userStakeAction(
          startOfEpoch(params, 1).add(LENGTH.div(3)),
          SAME_AMOUNT.mul(3).div(2),
          true,
          0
        ),
      ],
      [
        new userStakeAction(
          startOfEpoch(params, 1).add(LENGTH.div(2)),
          SAME_AMOUNT.div(5),
          true,
          1
        ),
        new userStakeAction(
          startOfEpoch(params, 1).add(LENGTH.mul(4).div(5)),
          SAME_AMOUNT,
          true,
          1
        ),
      ],
    ],
    [
      [
        new userStakeAction(
          startOfEpoch(params, 2),
          SAME_AMOUNT.div(3),
          false,
          0
        ),
        new userStakeAction(
          startOfEpoch(params, 2).add(LENGTH.div(3)),
          SAME_AMOUNT,
          true,
          0
        ),
      ],
      [
        new userStakeAction(
          startOfEpoch(params, 2).add(LENGTH.div(2)),
          SAME_AMOUNT.div(8),
          false,
          1
        ),
        new userStakeAction(
          startOfEpoch(params, 2).add(LENGTH.mul(4).div(5)),
          SAME_AMOUNT,
          true,
          1
        ),
      ],
    ],
  ];
}

export function scenario02(params: liqParams): userStakeAction[][][] {
  let LENGTH = params.EPOCH_DURATION;
  return [
    [
      [
        new userStakeAction(
          startOfEpoch(params, 1),
          SAME_AMOUNT,
          true,
          0
        ),
      ],
      [
        new userStakeAction(
          startOfEpoch(params, 1).add(LENGTH.div(2)),
          SAME_AMOUNT,
          true,
          1
        ),
      ],
    ],
  ];
}

export function scenario03(params: liqParams): userStakeAction[][][] {
  let LENGTH = params.EPOCH_DURATION;
  return [
    [
      [
        new userStakeAction(
          startOfEpoch(params, 1),
          SAME_AMOUNT,
          true,
          0
        ),
        new userStakeAction(
          startOfEpoch(params, 1).add(LENGTH.div(3)),
          SAME_AMOUNT,
          true,
          0
        ),
      ],
      [
        new userStakeAction(
          startOfEpoch(params, 1).add(LENGTH.div(2)),
          SAME_AMOUNT,
          true,
          1
        ),
        new userStakeAction(
          startOfEpoch(params, 1).add(LENGTH.mul(4).div(5)),
          SAME_AMOUNT,
          true,
          1
        ),
      ],
    ],
  ];
}