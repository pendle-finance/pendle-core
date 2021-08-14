import { checkDisabled, Mode } from '../fixtures/TestEnv';
import { runTest } from './common-test/reward-manager-common-test';
describe('aaveV2-reward-manager @skip-on-coverage', function () {
  if (checkDisabled(Mode.AAVE_V2)) return;
  runTest(Mode.AAVE_V2);
});
describe('compound-reward-manager @skip-on-coverage', function () {
  if (checkDisabled(Mode.COMPOUND)) return;
  runTest(Mode.COMPOUND);
});
describe('sushiswap-complex-reward-manager', function () {
  if (checkDisabled(Mode.SUSHISWAP_COMPLEX)) return;
  runTest(Mode.SUSHISWAP_COMPLEX);
});
