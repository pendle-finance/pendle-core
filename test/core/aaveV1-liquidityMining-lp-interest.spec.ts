import { runTest } from './liquidity-mining-lp-interest-common-test';
import { Mode } from './fixtures/TestEnv';
describe('aaveV1-lp-interest', function () {
  runTest(Mode.AAVE_V1);
});
