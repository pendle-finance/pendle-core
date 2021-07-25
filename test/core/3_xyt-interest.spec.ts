import { runTest } from './common-test/xyt-interest-test';
import { Mode, checkDisabled } from './fixtures/TestEnv';

describe('aaveV2-xyt-interest', function () {
  if (checkDisabled(Mode.AAVE_V2)) return;
  runTest(Mode.AAVE_V2);
});

describe('compound-xyt-interest', function () {
  if (checkDisabled(Mode.COMPOUND)) return;
  runTest(Mode.COMPOUND);
});

describe('SushiswapComplex-xyt-interest', function () {
  if (checkDisabled(Mode.SUSHISWAP_COMPLEX)) return;
  runTest(Mode.SUSHISWAP_COMPLEX);
});

describe('SushiswapSimple-xyt-interest', function () {
  if (checkDisabled(Mode.SUSHISWAP_SIMPLE)) return;
  runTest(Mode.SUSHISWAP_SIMPLE);
});
