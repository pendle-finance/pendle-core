import { runTest } from './common-test/withdrawal-common-test';
import { Mode } from './fixtures/TestEnv';
describe('aaveV2-withdrawal @skip-on-coverage', function () {
  runTest(Mode.AAVE_V2);
});

describe('compound-withdrawal @skip-on-coverage', function () {
  runTest(Mode.COMPOUND);
});
