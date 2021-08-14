import { checkDisabled, Mode } from '../fixtures/TestEnv';
import { runTest } from './common-test/underlying-asset-common-test';

describe('aaveV2-xyt-interest', function () {
  if (checkDisabled(Mode.AAVE_V2)) return;
  runTest(Mode.AAVE_V2);
});

describe('compound-xyt-interest', function () {
  if (checkDisabled(Mode.COMPOUND)) return;
  runTest(Mode.COMPOUND);
});

describe('compoundV2-xyt-interest', function () {
  if (checkDisabled(Mode.COMPOUND_V2)) return;
  runTest(Mode.COMPOUND_V2);
});

describe('SushiswapComplex-xyt-interest', function () {
  if (checkDisabled(Mode.SUSHISWAP_COMPLEX)) return;
  runTest(Mode.SUSHISWAP_COMPLEX);
});

describe('SushiswapSimple-xyt-interest', function () {
  if (checkDisabled(Mode.SUSHISWAP_SIMPLE)) return;
  runTest(Mode.SUSHISWAP_SIMPLE);
});
