import { BigNumber as BN } from 'ethers';
import { startOfEpoch } from '../helpers';
import { LiqParams, UserStakeAction } from './liquidityMining.fixture';
const SAME_AMOUNT: BN = BN.from(10000);

export function scenario01(params: LiqParams): UserStakeAction[][][] {
  let LENGTH = params.EPOCH_DURATION;
  return [
    [
      [
        new UserStakeAction(startOfEpoch(params, 1), SAME_AMOUNT, true, 0),
        new UserStakeAction(startOfEpoch(params, 1).add(LENGTH.div(3)), SAME_AMOUNT.mul(3).div(2), true, 0),
      ],
      [
        new UserStakeAction(startOfEpoch(params, 1).add(LENGTH.div(2)), SAME_AMOUNT.div(5), true, 1),
        new UserStakeAction(startOfEpoch(params, 1).add(LENGTH.mul(4).div(5)), SAME_AMOUNT, true, 1),
      ],
    ],
    [
      [
        new UserStakeAction(startOfEpoch(params, 2), SAME_AMOUNT.div(3), false, 0),
        new UserStakeAction(startOfEpoch(params, 2).add(LENGTH.div(3)), SAME_AMOUNT, true, 0),
      ],
      [
        new UserStakeAction(startOfEpoch(params, 2).add(LENGTH.div(2)), SAME_AMOUNT.div(8), false, 1),
        new UserStakeAction(startOfEpoch(params, 2).add(LENGTH.mul(4).div(5)), SAME_AMOUNT, true, 1),
      ],
    ],
  ];
}

export function scenario04(params: LiqParams): UserStakeAction[][][] {
  return [
    [
      [new UserStakeAction(startOfEpoch(params, 1).add(801427), BN.from(745), true, 0)],
      [
        new UserStakeAction(startOfEpoch(params, 1).add(110339), BN.from(584), true, 1),
        new UserStakeAction(startOfEpoch(params, 1).add(174944), BN.from(217), false, 1),
        new UserStakeAction(startOfEpoch(params, 1).add(523613), BN.from(314), true, 1),
      ],
      [
        new UserStakeAction(startOfEpoch(params, 1).add(3492), BN.from(420), true, 2),
        new UserStakeAction(startOfEpoch(params, 1).add(481032), BN.from(54), false, 2),
        new UserStakeAction(startOfEpoch(params, 1).add(698160), BN.from(246), false, 2),
        new UserStakeAction(startOfEpoch(params, 1).add(706579), BN.from(48), false, 2),
      ],
      [
        new UserStakeAction(startOfEpoch(params, 1).add(126315), BN.from(659), true, 3),
        new UserStakeAction(startOfEpoch(params, 1).add(524408), BN.from(831), true, 3),
        new UserStakeAction(startOfEpoch(params, 1).add(646377), BN.from(254), true, 3),
      ],
    ],
    [
      [
        new UserStakeAction(startOfEpoch(params, 2).add(798759), BN.from(362), false, 0),
        new UserStakeAction(startOfEpoch(params, 2).add(809650), BN.from(559), true, 0),
        new UserStakeAction(startOfEpoch(params, 2).add(857925), BN.from(515), true, 0),
      ],
      [
        new UserStakeAction(startOfEpoch(params, 2).add(55363), BN.from(395), true, 1),
        new UserStakeAction(startOfEpoch(params, 2).add(152340), BN.from(660), true, 1),
        new UserStakeAction(startOfEpoch(params, 2).add(608526), BN.from(769), false, 1),
        new UserStakeAction(startOfEpoch(params, 2).add(618520), BN.from(162), true, 1),
        new UserStakeAction(startOfEpoch(params, 2).add(735143), BN.from(578), true, 1),
        new UserStakeAction(startOfEpoch(params, 2).add(783075), BN.from(724), true, 1),
      ],
      [
        new UserStakeAction(startOfEpoch(params, 2).add(265988), BN.from(154), true, 2),
        new UserStakeAction(startOfEpoch(params, 2).add(271138), BN.from(619), true, 2),
        new UserStakeAction(startOfEpoch(params, 2).add(818063), BN.from(49), false, 2),
      ],
      [
        new UserStakeAction(startOfEpoch(params, 2).add(431733), BN.from(1303), false, 3),
        new UserStakeAction(startOfEpoch(params, 2).add(551955), BN.from(117), false, 3),
      ],
    ],
    [
      [
        new UserStakeAction(startOfEpoch(params, 3).add(472081), BN.from(427), true, 0),
        new UserStakeAction(startOfEpoch(params, 3).add(507431), BN.from(532), false, 0),
        new UserStakeAction(startOfEpoch(params, 3).add(637126), BN.from(149), false, 0),
        new UserStakeAction(startOfEpoch(params, 3).add(659194), BN.from(921), true, 0),
      ],
      [
        new UserStakeAction(startOfEpoch(params, 3).add(23520), BN.from(17), true, 1),
        new UserStakeAction(startOfEpoch(params, 3).add(353152), BN.from(289), false, 1),
        new UserStakeAction(startOfEpoch(params, 3).add(624697), BN.from(1151), false, 1),
      ],
      [
        new UserStakeAction(startOfEpoch(params, 3).add(282761), BN.from(291), true, 2),
        new UserStakeAction(startOfEpoch(params, 3).add(765240), BN.from(113), true, 2),
      ],
      [
        new UserStakeAction(startOfEpoch(params, 3).add(182573), BN.from(849), true, 3),
        new UserStakeAction(startOfEpoch(params, 3).add(493521), BN.from(315), false, 3),
        new UserStakeAction(startOfEpoch(params, 3).add(543419), BN.from(1), false, 3),
      ],
    ],
    [
      [
        new UserStakeAction(startOfEpoch(params, 4).add(72379), BN.from(42), true, 0),
        new UserStakeAction(startOfEpoch(params, 4).add(481621), BN.from(26), false, 0),
        new UserStakeAction(startOfEpoch(params, 4).add(705315), BN.from(568), true, 0),
      ],
      [],
      [
        new UserStakeAction(startOfEpoch(params, 4).add(7704), BN.from(303), false, 2),
        new UserStakeAction(startOfEpoch(params, 4).add(95697), BN.from(972), true, 2),
        new UserStakeAction(startOfEpoch(params, 4).add(292335), BN.from(421), true, 2),
        new UserStakeAction(startOfEpoch(params, 4).add(378968), BN.from(405), true, 2),
        new UserStakeAction(startOfEpoch(params, 4).add(854683), BN.from(505), true, 2),
      ],
      [
        new UserStakeAction(startOfEpoch(params, 4).add(40696), BN.from(913), true, 3),
        new UserStakeAction(startOfEpoch(params, 4).add(239958), BN.from(283), true, 3),
        new UserStakeAction(startOfEpoch(params, 4).add(685410), BN.from(647), true, 3),
        new UserStakeAction(startOfEpoch(params, 4).add(698688), BN.from(239), true, 3),
      ],
    ],
    [
      [
        new UserStakeAction(startOfEpoch(params, 5).add(168997), BN.from(1004), false, 0),
        new UserStakeAction(startOfEpoch(params, 5).add(272394), BN.from(539), true, 0),
        new UserStakeAction(startOfEpoch(params, 5).add(644768), BN.from(267), true, 0),
        new UserStakeAction(startOfEpoch(params, 5).add(784413), BN.from(377), true, 0),
      ],
      [
        new UserStakeAction(startOfEpoch(params, 5).add(4240), BN.from(928), true, 1),
        new UserStakeAction(startOfEpoch(params, 5).add(23888), BN.from(521), true, 1),
        new UserStakeAction(startOfEpoch(params, 5).add(699612), BN.from(2249), false, 1),
      ],
      [new UserStakeAction(startOfEpoch(params, 5).add(268619), BN.from(284), true, 2)],
      [
        new UserStakeAction(startOfEpoch(params, 5).add(77091), BN.from(465), true, 3),
        new UserStakeAction(startOfEpoch(params, 5).add(374716), BN.from(200), true, 3),
        new UserStakeAction(startOfEpoch(params, 5).add(458030), BN.from(144), true, 3),
      ],
    ],
  ];
}

export function scenario06(params: LiqParams): UserStakeAction[][][] {
  return [
    [
      [new UserStakeAction(startOfEpoch(params, 1).add(801427), BN.from(745), true, 0)],
      [
        new UserStakeAction(startOfEpoch(params, 1).add(110339), BN.from(584), true, 1),
        new UserStakeAction(startOfEpoch(params, 1).add(174944), BN.from(217), false, 1),
        new UserStakeAction(startOfEpoch(params, 1).add(523613), BN.from(314), true, 1),
      ],
      [
        new UserStakeAction(startOfEpoch(params, 1).add(3492), BN.from(420), true, 2),
        new UserStakeAction(startOfEpoch(params, 1).add(481032), BN.from(54), false, 2),
        new UserStakeAction(startOfEpoch(params, 1).add(698160), BN.from(246), false, 2),
        new UserStakeAction(startOfEpoch(params, 1).add(706579), BN.from(48), false, 2),
      ],
      [
        new UserStakeAction(startOfEpoch(params, 1).add(126315), BN.from(659), true, 3),
        new UserStakeAction(startOfEpoch(params, 1).add(524408), BN.from(831), true, 3),
        new UserStakeAction(startOfEpoch(params, 1).add(646377), BN.from(254), true, 3),
      ],
    ],
    [[], [], [], []],
    [[], [], [], []],
    [[], [], [], []],
    [
      [
        new UserStakeAction(startOfEpoch(params, 5).add(168997), BN.from(745), false, 0),
        new UserStakeAction(startOfEpoch(params, 5).add(272394), BN.from(539), true, 0),
        new UserStakeAction(startOfEpoch(params, 5).add(644768), BN.from(267), true, 0),
        new UserStakeAction(startOfEpoch(params, 5).add(784413), BN.from(377), true, 0),
      ],
      [
        new UserStakeAction(startOfEpoch(params, 5).add(4240), BN.from(928), true, 1),
        new UserStakeAction(startOfEpoch(params, 5).add(23888), BN.from(521), true, 1),
        new UserStakeAction(startOfEpoch(params, 5).add(699612), BN.from(1950), false, 1),
      ],
      [new UserStakeAction(startOfEpoch(params, 5).add(268619), BN.from(284), true, 2)],
      [
        new UserStakeAction(startOfEpoch(params, 5).add(77091), BN.from(465), true, 3),
        new UserStakeAction(startOfEpoch(params, 5).add(374716), BN.from(200), true, 3),
        new UserStakeAction(startOfEpoch(params, 5).add(458030), BN.from(144), true, 3),
      ],
    ],
  ];
}

export function scenario07(params: LiqParams): UserStakeAction[][][] {
  return [
    [[], [], [], []],
    [[], [], [], []],
    [[], [], [], []],
    [[], [], [], []],
    [
      [
        new UserStakeAction(startOfEpoch(params, 5).add(168997), BN.from(745), true, 0),
        new UserStakeAction(startOfEpoch(params, 5).add(272394), BN.from(539), true, 0),
        new UserStakeAction(startOfEpoch(params, 5).add(644768), BN.from(267), true, 0),
        new UserStakeAction(startOfEpoch(params, 5).add(784413), BN.from(377), true, 0),
      ],
      [
        new UserStakeAction(startOfEpoch(params, 5).add(4240), BN.from(928), true, 1),
        new UserStakeAction(startOfEpoch(params, 5).add(23888), BN.from(521), true, 1),
        new UserStakeAction(startOfEpoch(params, 5).add(699612), BN.from(1950), true, 1),
      ],
      [new UserStakeAction(startOfEpoch(params, 5).add(268619), BN.from(284), true, 2)],
      [
        new UserStakeAction(startOfEpoch(params, 5).add(77091), BN.from(465), true, 3),
        new UserStakeAction(startOfEpoch(params, 5).add(374716), BN.from(200), true, 3),
        new UserStakeAction(startOfEpoch(params, 5).add(458030), BN.from(144), true, 3),
      ],
    ],
  ];
}
