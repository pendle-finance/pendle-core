import { checkDisabled, Mode } from '../fixtures';
import { runTest } from './common-test/forge-fee-common-test';

describe('aave-forge-fee ', async () => {
  if (checkDisabled(Mode.AAVE_V2)) return;
  runTest(Mode.AAVE_V2);
});

describe('sushi-complex-forge-fee', async () => {
  if (checkDisabled(Mode.SUSHISWAP_COMPLEX)) return;
  runTest(Mode.SUSHISWAP_COMPLEX);
});

describe('sushi-simple-forge-fee', async () => {
  if (checkDisabled(Mode.SUSHISWAP_SIMPLE)) return;
  runTest(Mode.SUSHISWAP_SIMPLE);
});

describe('benqi-forge-fee', async () => {
  if (checkDisabled(Mode.BENQI)) return;
  runTest(Mode.BENQI);
});

describe('trader-joe-forge-fee', async () => {
  if (checkDisabled(Mode.TRADER_JOE)) return;
  runTest(Mode.TRADER_JOE);
});

describe('xJOE-forge-fee', async () => {
  if (checkDisabled(Mode.XJOE)) return;
  runTest(Mode.XJOE);
});

describe('Wonderland-forge-fee', async () => {
  if (checkDisabled(Mode.WONDERLAND)) return;
  runTest(Mode.WONDERLAND);
});
