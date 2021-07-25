import { runTest } from './common-test/liq-emergency-common-test';
import { Mode, checkDisabled } from './fixtures/TestEnv';
describe('aaveV2-liquidityMining-emergency @skip-on-coverage', function () {
  if (checkDisabled(Mode.AAVE_V2)) return;
  runTest(Mode.AAVE_V2);
});
describe('compound-liquidityMining-emergency @skip-on-coverage', function () {
  if (checkDisabled(Mode.COMPOUND)) return;
  runTest(Mode.COMPOUND);
});
