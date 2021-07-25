import { runTest } from './common-test/withdrawal-common-test';
import { Mode, checkDisabled } from './fixtures/TestEnv';
describe('aaveV2-withdrawal @skip-on-coverage', function () {
  if (checkDisabled(Mode.AAVE_V2)) return;
  runTest(Mode.AAVE_V2);
});

describe('compound-withdrawal @skip-on-coverage', function () {
  if (checkDisabled(Mode.COMPOUND)) return;
  runTest(Mode.COMPOUND);
});
