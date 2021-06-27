import { runTest } from './common-test/pausing-common-test';
import { Mode } from './fixtures/TestEnv';

describe('aaveV2-pausing @skip-on-coverage', function () {
  runTest(Mode.AAVE_V2);
});
describe('compound-pausing @skip-on-coverage', function () {
  runTest(Mode.COMPOUND);
});
