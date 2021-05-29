import { runTest } from './common-test/reward-manager-common-test';
import { Mode } from './fixtures/TestEnv';
describe('aaveV2-reward-manager', function () {
  runTest(Mode.AAVE_V2);
});
describe('compound-reward-manager', function () {
  runTest(Mode.COMPOUND);
});
