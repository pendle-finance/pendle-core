import { checkDisabled, Mode } from '../fixtures/TestEnv';
import { runTest } from './common-test/xyt-interest-test';

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

describe('BenQi-xyt-interest', function () {
  if (checkDisabled(Mode.BENQI)) return;
  runTest(Mode.BENQI);
});

describe('TraderJoe-xyt-interest', function () {
  if (checkDisabled(Mode.TRADER_JOE)) return;
  runTest(Mode.TRADER_JOE);
});

describe('KyberDMM-xyt-interest', function () {
  if (checkDisabled(Mode.KYBER_DMM)) return;
  runTest(Mode.KYBER_DMM);
});

describe('xJoe-xyt-interest', function () {
  if (checkDisabled(Mode.XJOE)) return;
  runTest(Mode.XJOE);
});

describe('Wonderland-xyt-interest', function () {
  if (checkDisabled(Mode.WONDERLAND)) return;
  runTest(Mode.WONDERLAND);
});
