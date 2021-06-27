import { runTest } from './common-test/liq-lp-interest-common-test';
import { Mode } from './fixtures/TestEnv';
describe('aaveV2-liquidityMining-lp-interest @skip-on-coverage', function () {
  runTest(Mode.AAVE_V2);
});
describe('compound-liquidityMining-lp-interest @skip-on-coverage', function () {
  runTest(Mode.COMPOUND);
});
describe('sushiswapComplex-liquidityMining-lp-interest', function () {
  runTest(Mode.SUSHISWAP_COMPLEX);
});
describe('sushiswapSimple-liquidityMining-lp-interest', function () {
  runTest(Mode.SUSHISWAP_SIMPLE);
});
