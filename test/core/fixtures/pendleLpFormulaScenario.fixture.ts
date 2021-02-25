import { consts } from "../../helpers";
import { BigNumber as BN } from "ethers";
export class TestAddLiq {
  timeOffset: BN;
  initTokenAmount: BN;
  initXytAmount: BN;
  amountTokenChange: BN;
  amountXytChange: BN;
  expectedLpBal1: BN;
  expectedLpBal2: BN;
  constructor(timeOffset: BN, initTokenAmount: number, amountTokenChange: number, expectedLpBal1: string, initXytAmount: number, amountXytChange: number, expectedLpBal2: string) {
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
  constructor(timeOffset: BN, initTokenAmount: number | string, ratioLpForToken: number | string, expectedTokenDiff: number | string, initXytAmount: number | string, ratioLpForXyt: number | string, expectedXytDiff: number | string) {
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
  return new TestRemoveLiq(consts.THREE_MONTH, 2133, 1, 35334082, 4231, 99, 4222077082);
}

export function scenarioRemove02(): TestRemoveLiq {
  return new TestRemoveLiq(consts.ONE_MONTH, 381, 34, 207998809, 167, 55, 162885766);
}

export function scenarioRemove03(): TestRemoveLiq {
  return new TestRemoveLiq(consts.FIVE_MONTH, 951, 50, 563321520, 45, 50, 44877732);
}

export function scenarioRemove04(): TestRemoveLiq {
  return new TestRemoveLiq(consts.FIVE_MONTH, 34576, 98, 34331514376, 16424, 1, 15640461578);
}

export function scenarioRemove05(): TestRemoveLiq {
  return new TestRemoveLiq(consts.ONE_MONTH, 45732, 1, 865753241, 78652, 1, 78502379353);
}

export function scenarioAdd01(): TestAddLiq {
  return new TestAddLiq(consts.THREE_MONTH, 891, 50, "33301790282170172", 331, 57, "67220816465474392");
}

export function scenarioAdd02(): TestAddLiq {
  return new TestAddLiq(consts.ONE_MONTH, 381, 157, "198283961837071968", 167, 36, "115989733684135088");
}

export function scenarioAdd03(): TestAddLiq {
  return new TestAddLiq(consts.FIVE_MONTH, 594, 784334, "254537264553463578624", 407, 397405, "935877870063826108416");
}

export function scenarioAdd04(): TestAddLiq {
  return new TestAddLiq(consts.THREE_MONTH, 891, 1000, "570951745713196928", 331, 2697, "2212728577055110912");
}

export function scenarioAdd05(): TestAddLiq {
  return new TestAddLiq(consts.ONE_MONTH, 292, 4769482, "161694963824566140928", 979, 5636155, "9693524330657995554816");
}