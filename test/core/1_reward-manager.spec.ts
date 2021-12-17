import { checkDisabled, Mode } from '../fixtures/TestEnv';
import { runTest as runTestCv2 } from './common-test/cv2-reward-mananger-common-test';
import { runTest } from './common-test/reward-manager-common-test';

describe('aaveV2-reward-manager ', function () {
  if (checkDisabled(Mode.AAVE_V2)) return;
  runTest(Mode.AAVE_V2);
});
describe('compound-reward-manager ', function () {
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

describe('Benqi-reward-manager', function () {
  if (checkDisabled(Mode.BENQI)) return;
  runTest(Mode.BENQI);
});

describe('Trader-Joe-reward-manager', function () {
  if (checkDisabled(Mode.TRADER_JOE)) return;
  runTest(Mode.TRADER_JOE);
});

describe('xJoe-reward-manager', function () {
  if (checkDisabled(Mode.XJOE)) return;
  runTest(Mode.XJOE);
});
describe('KyberDMM-reward-manager', function () {
  if (checkDisabled(Mode.KYBER_DMM)) return;
  runTest(Mode.KYBER_DMM);
});
