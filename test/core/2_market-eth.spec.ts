import { runTest } from './common-test/marketEth-common-test';
import { Mode } from './fixtures/TestEnv';

describe('aaveV2-marketEth @skip-on-coverage', function () {
  runTest(Mode.AAVE_V2);
});
describe('compound-marketEth @skip-on-coverage', function () {
  runTest(Mode.COMPOUND);
});
