import { runTest } from '../core/common-test/liq-emergency-common-test';
import { checkDisabled, Mode } from '../fixtures/TestEnv';
describe('aaveV2-liquidityMining-emergency @skip-on-coverage', function () {
  if (checkDisabled(Mode.AAVE_V2)) return;
  runTest(Mode.AAVE_V2);
});
describe('compound-liquidityMining-emergency @skip-on-coverage', function () {
  if (checkDisabled(Mode.COMPOUND)) return;
  runTest(Mode.COMPOUND);
});
