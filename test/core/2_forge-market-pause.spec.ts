import { runTest } from './common-test/pausing-common-test';
import { Mode } from './fixtures/TestEnv';

describe('aaveV1-pausing', function () {
  runTest(Mode.AAVE_V1);
});
describe('aaveV2-pausing', function () {
  runTest(Mode.AAVE_V2);
});
describe('compound-pausing', function () {
  runTest(Mode.COMPOUND);
});
