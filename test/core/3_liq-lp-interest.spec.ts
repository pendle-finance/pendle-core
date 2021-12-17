import { checkDisabled, Mode } from '../fixtures/TestEnv';
import { runTest } from './common-test/liq-lp-interest-common-test';
describe('aaveV2-liquidityMining-lp-interest ', function () {
  if (checkDisabled(Mode.AAVE_V2)) return;
  runTest(Mode.AAVE_V2);
});
describe('compound-liquidityMining-lp-interest ', function () {
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
describe('BenQi-liquididtyMining-lp-interest', function () {
  if (checkDisabled(Mode.BENQI)) return;
  runTest(Mode.BENQI);
});

describe('TraderJoe-liquididtyMining-lp-interest', function () {
  if (checkDisabled(Mode.TRADER_JOE)) return;
  runTest(Mode.TRADER_JOE);
});

describe('kyberDMM-liquididtyMining-lp-interest', function () {
  if (checkDisabled(Mode.KYBER_DMM)) return;
  runTest(Mode.KYBER_DMM);
});

describe('xJoe-liquididtyMining-lp-interest', function () {
  if (checkDisabled(Mode.XJOE)) return;
  runTest(Mode.XJOE);
});

describe('Wonderland-liquididtyMining-lp-interest', function () {
  if (checkDisabled(Mode.WONDERLAND)) return;
  runTest(Mode.WONDERLAND);
});
