import { runTest } from "./liquidity-mining-lp-interest-common-test";
import { Mode } from "./fixtures/TestEnv";
describe("compound-lp-interest", function () {
  runTest(Mode.COMPOUND);
});
