import { runTest } from './common-test/forge-fee-common-test';
import { Mode, checkDisabled } from './fixtures';

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
