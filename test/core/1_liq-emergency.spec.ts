import { runTest } from './common-test/liq-emergency-common-test';
import { Mode } from './fixtures/TestEnv';
describe('aaveV2-liquidityMining-emergency @skip-on-coverage', function () {
  runTest(Mode.AAVE_V2);
});
describe('compound-liquidityMining-emergency @skip-on-coverage', function () {
  runTest(Mode.COMPOUND);
});
