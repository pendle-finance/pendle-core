import { runTest } from '../core/common-test/pausing-common-test';
import { checkDisabled, Mode } from '../fixtures/TestEnv';

describe('aaveV2-pausing @skip-on-coverage', function () {
  if (checkDisabled(Mode.AAVE_V2)) return;
  runTest(Mode.AAVE_V2);
});
describe('compound-pausing @skip-on-coverage', function () {
  if (checkDisabled(Mode.COMPOUND)) return;
  runTest(Mode.COMPOUND);
});
