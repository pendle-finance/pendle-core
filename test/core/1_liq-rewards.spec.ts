import { runTest } from './common-test/liq-rewards-common-test';
import { Mode, checkDisabled } from './fixtures/TestEnv';
describe('aaveV2-liquidity-mining-rewards @skip-on-coverage', function () {
  if (checkDisabled(Mode.AAVE_V2)) return;
  runTest(Mode.AAVE_V2);
});
describe('compound-liquidity-mining-rewards @skip-on-coverage', function () {
  if (checkDisabled(Mode.COMPOUND)) return;
  runTest(Mode.COMPOUND);
});
