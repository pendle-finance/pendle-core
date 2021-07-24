import { runTest } from './common-test/liq18-lp-interest-common-test';
import { Mode, checkDisabled } from './fixtures/TestEnv';
describe('aaveV2-liquidity-mining18-lp-interest @skip-on-coverage', function () {
  if (checkDisabled(Mode.AAVE_V2)) return;
  runTest(Mode.AAVE_V2);
});
