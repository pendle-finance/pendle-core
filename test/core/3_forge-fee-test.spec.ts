import { runTest } from './common-test/forge-fee-common-test';
import { Mode } from './fixtures';

describe('aave-forge-fee @skip-on-coverage', async () => {
  runTest(Mode.AAVE_V2);
});

describe('sushi-complex-forge-fee', async () => {
  runTest(Mode.SUSHISWAP_COMPLEX);
});

describe('sushi-simple-forge-fee', async () => {
  runTest(Mode.SUSHISWAP_SIMPLE);
});
