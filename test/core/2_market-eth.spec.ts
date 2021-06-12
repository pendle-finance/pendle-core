import { runTest } from './common-test/marketEth-common-test';
import { Mode } from './fixtures/TestEnv';

describe('aaveV2-marketEth', function () {
  runTest(Mode.AAVE_V2);
});
describe('compound-marketEth', function () {
  runTest(Mode.COMPOUND);
});
