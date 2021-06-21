import { runTest } from './common-test/withdrawal-common-test';
import { Mode } from './fixtures/TestEnv';
describe.only('aaveV2-withdrawal', function () {
  runTest(Mode.AAVE_V2);
});

describe('compound-withdrawal', function () {
  runTest(Mode.COMPOUND);
});
