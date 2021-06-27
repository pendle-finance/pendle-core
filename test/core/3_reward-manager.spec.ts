import { runTest } from './common-test/reward-manager-common-test';
import { Mode } from './fixtures/TestEnv';
describe('aaveV2-reward-manager @skip-on-coverage', function () {
  runTest(Mode.AAVE_V2);
});
describe('compound-reward-manager @skip-on-coverage', function () {
  runTest(Mode.COMPOUND);
});
describe('sushiswap-complex-reward-manager', function () {
  runTest(Mode.SUSHISWAP_COMPLEX);
});
