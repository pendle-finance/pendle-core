import { runTest } from './common-test/liq-rewards-common-test';
import { Mode } from './fixtures/TestEnv';
describe('aaveV2-liquidity-mining-rewards', function () {
  runTest(Mode.AAVE_V2);
});
describe('compound-liquidity-mining-rewards', function () {
  runTest(Mode.COMPOUND);
});
