import { runTest } from './common-test/xyt-interest-test';
import { Mode } from './fixtures/TestEnv';
describe('aaveV2-xyt-interest @skip-on-coverage', function () {
  runTest(Mode.AAVE_V2);
});

describe('compound-xyt-interest @skip-on-coverage', function () {
  runTest(Mode.COMPOUND);
});

describe('SushiswapComplex-xyt-interest', function () {
  runTest(Mode.SUSHISWAP_COMPLEX);
});

describe('SushiswapSimple-xyt-interest', function () {
  runTest(Mode.SUSHISWAP_SIMPLE);
});
