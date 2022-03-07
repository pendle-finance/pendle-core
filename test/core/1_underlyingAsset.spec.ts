import { checkDisabled, Mode } from '../fixtures/TestEnv';
import { runTest } from './common-test/underlying-asset-common-test';

describe('aaveV2-underlyingAsset', function () {
  if (checkDisabled(Mode.AAVE_V2)) return;
  runTest(Mode.AAVE_V2);
});

describe('compound-underlyingAsset', function () {
  if (checkDisabled(Mode.COMPOUND)) return;
  runTest(Mode.COMPOUND);
});

describe('SushiswapComplex-underlyingAsset', function () {
  if (checkDisabled(Mode.SUSHISWAP_COMPLEX)) return;
  runTest(Mode.SUSHISWAP_COMPLEX);
});

describe('SushiswapSimple-underlyingAsset', function () {
  if (checkDisabled(Mode.SUSHISWAP_SIMPLE)) return;
  runTest(Mode.SUSHISWAP_SIMPLE);
});

describe('BenQi-underlyingAsset', function () {
  if (checkDisabled(Mode.BENQI)) return;
  runTest(Mode.BENQI);
});

describe('Wonderland-underlyingAsset', function () {
  if (checkDisabled(Mode.WONDERLAND)) return;
  runTest(Mode.WONDERLAND);
});

describe('TraderJoe-underlyingAsset', function () {
  if (checkDisabled(Mode.TRADER_JOE)) return;
  runTest(Mode.TRADER_JOE);
});

describe('xJoe-underlyingAsset', function () {
  if (checkDisabled(Mode.XJOE)) return;
  runTest(Mode.XJOE);
});
