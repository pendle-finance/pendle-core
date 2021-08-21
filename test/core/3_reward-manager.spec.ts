import { checkDisabled, Mode } from '../fixtures/TestEnv';
import { runTest as runTestCv2 } from './common-test/cv2-reward-mananger-common-test';
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
describe('compound-v2-reward-manager', function () {
  if (checkDisabled(Mode.COMPOUND_V2)) return;
  runTestCv2(Mode.COMPOUND_V2);
});
