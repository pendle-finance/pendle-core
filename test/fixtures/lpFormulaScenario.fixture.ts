import { BigNumber as BN } from 'ethers';
import { consts } from '../helpers';
export class TestAddLiq {
  timeOffset: BN;
  initTokenAmount: BN;
  initXytAmount: BN;
  amountTokenChange: BN;
  amountXytChange: BN;
  expectedLpBal1: BN;
  expectedLpBal2: BN;
  constructor(
    timeOffset: BN,
    initTokenAmount: number,
    amountTokenChange: number,
    expectedLpBal1: string,
    initXytAmount: number,
    amountXytChange: number,
    expectedLpBal2: string
  ) {
    this.timeOffset = timeOffset;
    this.initTokenAmount = BN.from(initTokenAmount);
    this.initXytAmount = BN.from(initXytAmount);
    this.amountTokenChange = BN.from(amountTokenChange);
    this.amountXytChange = BN.from(amountXytChange);
    this.expectedLpBal1 = BN.from(expectedLpBal1);
    this.expectedLpBal2 = BN.from(expectedLpBal2);
  }
}

export class TestRemoveLiq {
  timeOffset: BN;
  initTokenAmount: BN;
  ratioLpForToken: BN;
  expectedTokenDiff: BN;
  initXytAmount: BN;
  ratioLpForXyt: BN;
  expectedXytDiff: BN;
  constructor(
    timeOffset: BN,
    initTokenAmount: number | string,
    ratioLpForToken: number | string,
    expectedTokenDiff: number | string,
    initXytAmount: number | string,
    ratioLpForXyt: number | string,
    expectedXytDiff: number | string
  ) {
    this.timeOffset = timeOffset;
    this.initTokenAmount = BN.from(initTokenAmount);
    this.initXytAmount = BN.from(initXytAmount);
    this.ratioLpForToken = BN.from(ratioLpForToken);
    this.ratioLpForXyt = BN.from(ratioLpForXyt);
    this.expectedTokenDiff = BN.from(expectedTokenDiff);
    this.expectedXytDiff = BN.from(expectedXytDiff);
  }
}

export function scenarioRemove01(): TestRemoveLiq {
  return new TestRemoveLiq(consts.THREE_MONTH, 2133, 1, 35334069, 4231, 99, 4222077082);
}

export function scenarioRemove02(): TestRemoveLiq {
  return new TestRemoveLiq(consts.ONE_MONTH, 381, 34, 207998136, 167, 55, 162885525);
}

export function scenarioRemove03(): TestRemoveLiq {
  return new TestRemoveLiq(consts.FIVE_MONTH, 951, 50, 563319095, 45, 50, 44877732);
}

export function scenarioRemove04(): TestRemoveLiq {
  return new TestRemoveLiq(consts.FIVE_MONTH, 34576, 98, 34331513798, 16424, 1, 15640454634);
}

export function scenarioRemove05(): TestRemoveLiq {
  return new TestRemoveLiq(consts.ONE_MONTH, 45732, 1, 865753226, 78652, 1, 1663309227);
}

export function scenarioAdd01(): TestAddLiq {
  return new TestAddLiq(consts.THREE_MONTH, 891, 50, '18085079', 331, 57, '36505357');
}

export function scenarioAdd02(): TestAddLiq {
  return new TestAddLiq(consts.ONE_MONTH, 381, 157, '50015925', 167, 36, '29257706');
}

export function scenarioAdd03(): TestAddLiq {
  return new TestAddLiq(consts.FIVE_MONTH, 594, 784334, '125153154247', 407, 397405, '460160784843');
}

export function scenarioAdd04(): TestAddLiq {
  return new TestAddLiq(consts.THREE_MONTH, 891, 1000, '310064648', 331, 2697, '1201658307');
}

export function scenarioAdd05(): TestAddLiq {
  return new TestAddLiq(consts.ONE_MONTH, 292, 4769482, '86452840114', 979, 5636155, '5182800312870');
}
