import { checkDisabled, Mode } from '../fixtures/TestEnv';
import { runTest } from './common-test/liq-rewards-common-test';
describe('aaveV2-liquidity-mining-rewards @skip-on-coverage', function () {
  if (checkDisabled(Mode.AAVE_V2)) return;
  runTest(Mode.AAVE_V2);
});
describe('compound-liquidity-mining-rewards @skip-on-coverage', function () {
  if (checkDisabled(Mode.COMPOUND)) return;
  runTest(Mode.COMPOUND);
});
