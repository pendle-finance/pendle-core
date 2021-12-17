import { checkDisabled, Mode } from '../fixtures/TestEnv';
import { runTest } from './common-test/liq-rewards-common-test';
describe('aaveV2-liquidity-mining-rewards ', function () {
  if (checkDisabled(Mode.AAVE_V2)) return;
  runTest(Mode.AAVE_V2);
});
describe('compound-liquidity-mining-rewards ', function () {
  if (checkDisabled(Mode.COMPOUND)) return;
  runTest(Mode.COMPOUND);
});
describe('benq-liquidity-mining-rewards ', function () {
  if (checkDisabled(Mode.BENQI)) return;
  runTest(Mode.BENQI);
});
describe('trader-joe-liquidity-mining-rewards ', function () {
  if (checkDisabled(Mode.TRADER_JOE)) return;
  runTest(Mode.TRADER_JOE);
});
describe('kyberDMM-liquidity-mining-rewards ', function () {
  if (checkDisabled(Mode.KYBER_DMM)) return;
  runTest(Mode.KYBER_DMM);
});
describe('xJoe-liquidity-mining-rewards ', function () {
  if (checkDisabled(Mode.XJOE)) return;
  runTest(Mode.XJOE);
});
describe('Wonderland-liquidity-mining-rewards ', function () {
  if (checkDisabled(Mode.WONDERLAND)) return;
  runTest(Mode.WONDERLAND);
});
