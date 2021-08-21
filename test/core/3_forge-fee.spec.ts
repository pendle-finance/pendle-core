import { checkDisabled, Mode } from '../fixtures';
import { runTest } from './common-test/forge-fee-common-test';

describe('aave-forge-fee @skip-on-coverage', async () => {
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

describe('compound-v2-forge-fee', async () => {
  if (checkDisabled(Mode.COMPOUND_V2)) return;
  runTest(Mode.COMPOUND_V2);
});
