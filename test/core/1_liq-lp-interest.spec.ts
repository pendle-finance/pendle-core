import { runTest } from './common-test/liq-lp-interest-common-test';
import { Mode, checkDisabled } from './fixtures/TestEnv';
describe('aaveV2-liquidityMining-lp-interest @skip-on-coverage', function () {
  if (checkDisabled(Mode.AAVE_V2)) return;
  runTest(Mode.AAVE_V2);
});
describe('compound-liquidityMining-lp-interest @skip-on-coverage', function () {
  if (checkDisabled(Mode.COMPOUND)) return;
  runTest(Mode.COMPOUND);
});
describe('sushiswapComplex-liquidityMining-lp-interest', function () {
  if (checkDisabled(Mode.SUSHISWAP_COMPLEX)) return;
  runTest(Mode.SUSHISWAP_COMPLEX);
});
describe('sushiswapSimple-liquidityMining-lp-interest', function () {
  if (checkDisabled(Mode.SUSHISWAP_SIMPLE)) return;
  runTest(Mode.SUSHISWAP_SIMPLE);
});
