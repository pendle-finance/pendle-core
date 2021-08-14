import { checkDisabled, Mode } from '../fixtures/TestEnv';
import { runTest } from './common-test/liq-lp-interest-common-test';
describe('aaveV2-liquidityMining-lp-interest @skip-on-coverage', function () {
  if (checkDisabled(Mode.AAVE_V2)) return;
  runTest(Mode.AAVE_V2);
});
describe('compound-liquidityMining-lp-interest @skip-on-coverage', function () {
  if (checkDisabled(Mode.COMPOUND)) return;
  runTest(Mode.COMPOUND);
});
describe('compoundV2-liquidityMining-lp-interest', function () {
  if (checkDisabled(Mode.COMPOUND_V2)) return;
  runTest(Mode.COMPOUND_V2);
});
describe('sushiswapComplex-liquidityMining-lp-interest', function () {
  if (checkDisabled(Mode.SUSHISWAP_COMPLEX)) return;
  runTest(Mode.SUSHISWAP_COMPLEX);
});
describe('sushiswapSimple-liquidityMining-lp-interest', function () {
  if (checkDisabled(Mode.SUSHISWAP_SIMPLE)) return;
  runTest(Mode.SUSHISWAP_SIMPLE);
});
