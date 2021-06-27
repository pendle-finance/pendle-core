import { runTest } from './common-test/liq-rewards-common-test';
import { Mode } from './fixtures/TestEnv';
describe('aaveV2-liquidity-mining-rewards @skip-on-coverage', function () {
  runTest(Mode.AAVE_V2);
});
describe('compound-liquidity-mining-rewards @skip-on-coverage', function () {
  runTest(Mode.COMPOUND);
});
