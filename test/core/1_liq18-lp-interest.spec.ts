import { runTest } from './common-test/liq18-lp-interest-common-test';
import { Mode } from './fixtures/TestEnv';
describe('aaveV2-liquidity-mining18-lp-interest', function () {
  runTest(Mode.AAVE_V2);
});
