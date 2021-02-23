import { BigNumber as BN, Contract } from "ethers";
import MockMathLibrary from "../../build/artifacts/contracts/mock/MockMathLibrary.sol/MockMathLibrary.json";
import { evm_revert, evm_snapshot } from "../helpers";
import { expect } from "chai";
import testData from "./fixtures/pendleMockMathLibrary.json";

const { waffle } = require("hardhat");
const { provider, deployContract } = waffle;

describe("Math tests", async () => {
  const wallets = provider.getWallets();
  const [alice, bob] = wallets;
  let math: Contract;
  let globalSnapshotId: string;
  let rpowTest: string[][];
  before(async () => {
    globalSnapshotId = await evm_snapshot();
    math = await deployContract(alice, MockMathLibrary, []);
    rpowTest = (<any>testData).test;
  });

  after(async () => {
    await evm_revert(globalSnapshotId);
  });

  beforeEach(async () => {
    // await evm_revert(snapshotId);
    // snapshotId = await evm_snapshot();
  });

  it("test rpow", async () => {
    const toleranceRatio = BN.from(10).pow(8);
    for (let id = 0; id < rpowTest.length; id++) {
      let [base, exp, _expectedResult] = rpowTest[id];
      let expectedResult: BN = BN.from(_expectedResult);
      let actualResult: BN = await math.rpow(BN.from(base), BN.from(exp));
      let diff = expectedResult.sub(actualResult);
      if (diff.lte(0)) diff = diff.mul(-1);
      // console.log(base, exp, diff.toString(), actualResult.toString(), expectedResult.toString());
      // if diff < 10, then the difference is minimal
      if (diff.gte(10)) {
        // diff * toleranceRatio <= expectedResult
        expect(
          diff.mul(toleranceRatio).lte(expectedResult),
          "high precision error"
        ).to.be.true;
      }
    }
  });

  it("test rpow special cases", async () => {
    expect(
      (await math.rpow(BN.from(0), BN.from(4915181090268))).toNumber()
    ).to.equal(0);
  });
});
